# ADR-0001 — Ranh giới Master Data Framework

<!-- [2026-11-29 12:26 AM Johnny Chu - Chu Hoàng Anh] ADR-0001 — chủ chốt 2026-11-29 (PHASE-004, R-CORE-8, R-CHAIN-0) -->

**Trạng thái:** Chấp nhận — chủ chốt 2026-11-29.
**Liên quan:**
- R-CANON-18 (trụ cột xuyên doanh nghiệp, NC-004);
- R-CHAIN-0 và R-CAT-1…4 ([NC-007](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-007-TRUC-CHUNG-TU-KE-TOAN-LA-NGUON.md));
- R-CORE-8;
- [PHASE-004 · 30](../phases/PHASE-004-CORE-DOC-LAP/30-RANH-GIOI-CORE.md): B-1, B-3…B-5, B-15;
- Q-P4-6.

## 1. Bối cảnh

Mọi app dùng chung một bộ danh mục: mặt hàng, mã hàng, đơn vị tính (ĐVT), nhóm hàng, cây đơn vị (chi nhánh, kho, phân kho) và đối tượng. Danh mục này phải có **một chủ** (R-CHAIN-0: kế toán quyết).

Đo ở PHASE-004 W2-2 cho thấy lõi đang lẫn ba thứ khác nhau:
- **Hợp đồng định danh dùng chung:** `item_id` ULID, mã có phiên bản, ĐVT nhỏ nhất.
- **Bảng và mã nghiệp vụ của open-ketoan:** kiểu của `items`, `products`, `product_units`, `branches`, `warehouses`…, cùng `masterdata/*` (nay ở khu cách ly).
- **Truy vấn thẳng vào bảng của kế toán:** phạm vi vai đọc `branches` / `warehouses` (B-15).

Ngoài ra, open-cake có bảng `catalog_items` riêng, còn POS và HRM sẽ cần đúng các định danh trên. Nếu không chốt ranh giới, mỗi app sẽ tự dựng một bản danh mục, hoặc lõi lại phình theo kế toán.

## 2. Quyết định

### D1. Ba vai

| Vai | Ai | Sở hữu | Không được |
|---|---|---|---|
| **Khung** (framework) | open-core | Xem bảng chi tiết dưới đây | Tạo bảng danh mục; biết luật SKU, ngành / nhãn / nhóm, nhóm hạch toán, thuế suất; đọc bảng danh mục bằng SQL |
| **Chủ dữ liệu** (owner) | open-ketoan Kernel, theo tenant / sổ (R-CHAIN-0) | Bảng, migration và luật của danh mục (bảng chi tiết dưới đây); cài đặt cổng; phát sự kiện đổi | Để app khác ghi thẳng vào bảng của mình |
| **App tiêu thụ** (consumer) | open-cake, POS, HRM… | **Bản chiếu** đọc, khoá theo `item_id` / `EntityRef` (vd `catalog_items` của cake), cập nhật từ sự kiện; trường cục bộ (giá bán, đang bán, ảnh kênh) | Tự sinh nhóm hoặc mã hàng (R-CAT-1); ghi bảng của chủ; đọc CSDL của chủ |

**Khung (open-core) sở hữu:**
- **Hợp đồng ở `@bizcity/contracts`:**
  - `bizcity_item_master@1` — `ItemRef`, `ULID_RE`, `ItemCodeInfo` có `validFrom` / `validTo`;
  - `entity-codes` — `EntityRef` cho partner / branch / warehouse, mã và thuộc tính có phiên bản;
  - `dvt` — `UnitRatio`, đúng một đơn vị gốc tỷ lệ 1;
  - khuôn phát hiện `bizcity_catalog_hint@1`.
- **Cơ chế:**
  - móc `masterdata.referenceCheck`;
  - vòng đời không xoá (nháp → dùng → ngừng; lưu trữ / khôi phục);
  - danh sách `bizcity_list@1`, bằng chứng, cài đặt.
- **Cổng `masterdata`** (D5).
- **Giao thức đồng bộ** (W5): sự kiện, idempotency, outbox, phát lại, đối chiếu.

**Chủ dữ liệu (open-ketoan) sở hữu:**
- **Bảng:**
  - mặt hàng và mã: `items`, `item_codes`, `products`;
  - ĐVT: `product_units`, `unit_names`;
  - phân loại: `item_classes`, `item_classification`;
  - cây đơn vị và kho: `branches` (cây, `unit_path`), `warehouses`, `warehouse_types` / `warehouse_type_ops` (phân kho);
  - đối tượng: `partners`, `entity_codes`, `entity_attributes`.
- **Luật:**
  - luật SKU `2 + 3 + 1 + 3`;
  - Ngành → Nhãn → Nhóm;
  - nhóm hạch toán, thuế.

### D2. Lõi không tạo bảng danh mục

Trụ cột R-CANON-18 về danh mục được bảo đảm bằng **hợp đồng + bất biến + cổng**, không bằng bảng ở migration lõi. R-CORE-4 ("thiếu trụ thì thêm bảng ở lõi") **không áp dụng** cho dữ liệu danh mục: lược đồ thuộc về chủ dữ liệu, để lõi phát hành độc lập (R-CORE-8). Kiểu bảng danh mục chỉ có trong khu cách ly `ketoan-legacy` (đến 0.8), sau đó ở Kernel của kế toán.

### D3. Bất biến định danh — không thương lượng

Mọi chủ dữ liệu phải giữ, và diễn tập nâng cấp đo được (nhóm M của bộ đo):

| Mã | Bất biến |
|---|---|
| MD-1 | `item_id` là ULID, **bất biến, không tái dùng, không xoá**: chỉ ngừng (`retired_at`). Mỗi biến thể có một `item_id` (Q-NC6-3) |
| MD-2 | Mã có phiên bản theo `valid_from` / `valid_to`: không hai khoảng hiệu lực chồng nhau cho cùng (tenant, loại mã, mã); mã đã cấp không cấp lại cho mặt hàng khác (R-CAT-2) |
| MD-3 | Số lượng quy về **đơn vị nhỏ nhất**: mỗi mặt hàng đúng **một** ĐVT tỷ lệ 1; tỷ lệ > 0 (`numeric(18,6)`); đổi tỷ lệ là sự kiện có phiên bản, không sửa lùi chứng từ đã lập |
| MD-4 | Kho thuộc một chi nhánh có thật; cây đơn vị không có vòng; phân kho (`type_code`) thuộc danh mục loại kho của tenant |
| MD-5 | Không xoá cứng danh mục đã có chứng từ tham chiếu (`masterdata.referenceCheck`); ngừng dùng thay xoá |

### D4. App chạy khi chưa có chủ dữ liệu

Ví dụ: open-cake chạy độc lập, chưa nối kế toán.
- App được làm **chủ tạm** cho tenant của mình, với điều kiện:
  - cài cùng cổng `masterdata`;
  - giữ D3: `item_id` ULID, mã có phiên bản, ĐVT gốc.
- Khi nối kế toán:
  - đối chiếu theo mã (`item_codes`, loại `external:<app>` cho mã cũ của app);
  - **kế toán thắng** (R-CHAIN-0): `item_id` của kế toán thay vào;
  - mã cũ của app thành bí danh `external:<app>`;
  - bảng của app chuyển thành bản chiếu.
- Đề xuất mặt hàng hay nhóm mới từ app là **chứng từ** `catalog.proposal:<id>` (R-CAT-4), không phải lệnh ghi.

### D5. Cổng `masterdata` thay cho SQL thô

Lõi khai báo bằng `definePort`, chủ dữ liệu cấp bằng `providePort`, cùng tiến trình. Ngoài tiến trình thì dùng API và changefeed của chủ (R-CAT-3).

```ts
export const MASTERDATA = definePort<{
  resolveItem(ref: ItemRef, at?: string): Promise<ResolvedItem | ResolveFailure>;
  resolveEntity(ref: EntityRef, at?: string): Promise<EntityResolveResult>;
  orgSubtree(nodeIds: string[]): Promise<string[]>;            // phạm vi vai org_unit → mọi chi nhánh con
  warehouseBranch(warehouseIds: string[]): Promise<Record<string, string>>;
}>('masterdata');
```

- Phạm vi vai `branch` / `warehouse` / `org_unit` (`core/authz/scope.ts`, `store.ts`; B-15) sẽ đi qua `orgSubtree` / `warehouseBranch`.
- Chưa có nhà cấp ⇒ `CAPABILITY_MISSING`. Lõi không tự đọc `branches`.

### D6. Vị trí hợp đồng

- `item-master`, `entity-codes`, `dvt` và khuôn `catalog-hint` **ở lại** `@bizcity/contracts`.
- Bộ quy tắc VN (`quy-tac/*`: đối tượng, nhóm hàng, tổ chức ngân hàng) sang `@bizcity/accounting-contracts` (Q-P4-6, S004-W2-8). `catalog-hint` nhận bộ quy tắc qua đăng ký.

## 3. Hệ quả

- **Được:**
  - lõi nâng cấp không chạm lược đồ danh mục;
  - app mới (POS, HRM) có sẵn định danh và cổng, không dựng danh mục riêng;
  - nối kế toán về sau có đường đối chiếu rõ (D4).
- **Phải trả:**
  - app tiêu thụ giữ bản chiếu và đồng bộ (W5);
  - phạm vi vai cần nhà cấp cổng (chưa có ⇒ vai theo chi nhánh / kho không giải được).
- **Việc kéo theo:**
  - **S004-W2-9:** khai `MASTERDATA` ở lõi; `scope.ts` / `store.ts` gọi cổng; kế toán cấp.
  - **S004-W2-5:** đưa `ketoan-legacy/masterdata/*` về Kernel kế toán ở 0.8.
  - **Bộ đo bất biến nhóm M:** đo MD-1…MD-4 trên dữ liệu thật trước và sau nâng cấp.
  - **open-cake:** kiểm `catalog_items` giữ D3 (`item_id` ULID) để sẵn sàng nối kế toán theo D4.

## 4. Phương án đã loại

| Phương án | Lý do loại |
|---|---|
| Lõi sở hữu bảng danh mục (theo chữ R-CORE-4) | Lõi phải biết luật SKU, nhóm hạch toán, thuế ⇒ trái R-CORE-8; mỗi đổi lược đồ của kế toán kéo theo bản phát hành lõi |
| Mỗi app tự giữ danh mục, đồng bộ hai chiều | Trái R-CHAIN-0 và R-CAT-1; xung đột mã, không có nguồn đúng để đối chiếu |
| App đọc thẳng CSDL của kế toán (khung nhìn `bizcity_read.*`) | Dính lược đồ, trái "không đọc CSDL của nhau" (R-CORE-8); khung nhìn chỉ còn dùng **trong** Kernel kế toán |
