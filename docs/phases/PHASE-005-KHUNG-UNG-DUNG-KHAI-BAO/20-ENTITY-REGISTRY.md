# PHASE-005 · 20 — Entity Registry (Model Registry)

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — Model Registry: vai trò, API khai báo, thứ sinh ra, chặn ghi nhạy cảm. -->

## 1. Vai trò — có quan trọng không?

**Có. Đây là mảnh quan trọng nhất của L2.** Không có registry thì mỗi thực thể phải được mô tả lại **tám lần**, ở tám chỗ khác nhau:

| # | Chỗ mô tả lại | Hiện nay viết ở |
|---|---|---|
| 1 | schema kiểm dữ liệu | zod trong action |
| 2 | kiểu TS | interface trong `contracts` |
| 3 | định nghĩa danh sách | `ListDef` của `defineListAction` |
| 4 | cột / ô của form | React |
| 5 | ghép cột khi nhập | bộ nhập riêng |
| 6 | mô tả tool MCP | JSON Schema |
| 7 | nhãn tiếng Việt | rải rác |
| 8 | quyền xem / sửa | authz manifest |

Tám bản lệch nhau là nguồn lỗi lớn nhất khi làm nhanh, nhất là khi **agent viết mã** (vibe coding): agent sửa một bản, quên bảy bản còn lại.

Registry là **một bản mô tả thực thể dạng dữ liệu**. Bảy bản kia được **sinh** từ nó, và bộ kiểm đọc chính nó.

open-core cần registry vì ba lý do:
- **Trụ Danh mục (ADR-0001) cần biết hình của thực thể** để `extendEntity` của app không phá trường của chủ.
- **View Framework** ([40](40-VIEW-FRAMEWORK.md)) vẽ màn từ registry; không có registry thì `defineScreen` lại phải tự khai cột.
- **Conformance Gate** cần biết lớp của thực thể (danh mục / chứng từ / sổ cái…) để chặn CRUD sai chỗ (§5).

## 2. Khai báo

```ts
// module của chủ dữ liệu (open-ketoan) — khai một lần
export const Item = defineEntity({
  key: 'masterdata.item',                 // <module>.<thực thể>; trùng khoá ⇒ lỗi khi nạp
  label: { vi: 'Mặt hàng', en: 'Item' },
  class: 'master',                        // §4: config | record | master | replica | document | ledger
  id: { kind: 'item' },                   // newId('item') — ULID; trục khoá bằng code: { code: true, uid: true }
  storage: { table: 'items' },            // chủ: bảng của chính app; bản sao: replica do lõi sinh; record: bảng records
  fields: {
    code:     field.code({ label: 'Mã hàng', versioned: true, unique: 'tenant', search: true }),
    name:     field.text({ label: 'Tên', max: 200, search: true }),
    barcode:  field.text({ label: 'Mã vạch', search: true, optional: true }),
    category: field.ref('masterdata.item_class', { label: 'Nhóm', filter: 'tree' }),
    brand:    field.ref('masterdata.item_class', { label: 'Nhãn', where: { kind: 'brand' }, filter: 'in' }),
    uom:      field.ref('masterdata.uom', { label: 'ĐVT gốc' }),
    status:   field.enum(['draft', 'active', 'retired'], { label: 'Trạng thái', filter: 'in', default: 'draft' }),
  },
  lifecycle: 'archive',                   // không xoá cứng; ngừng = status retired (ADR-0001 MD-5)
  permissions: { read: 'catalog:read', write: 'catalog:write' },
  activities: true,                       // khối Hoạt động trên bản ghi
});
```

Bốn hàm phụ cho app **không phải chủ**, dùng để thêm vào thực thể của người khác ([30](30-ITEM-MASTER-MO-RONG.md)):

```ts
extendEntity('masterdata.item', { app: 'cake', fields: { … }, relations: { … }, validators: [ … ] });  // gói cả ba
registerField('masterdata.item', 'cake.trade_name', field.text({ label: 'Tên thương mại', storage: 'meta' }));
registerRelation('masterdata.item', 'cake.posts', { to: 'cake.post', kind: 'many', via: 'cake_post_items.item_id' });
registerValidator('masterdata.item', { app: 'cake', on: ['cake.item.update'], check: (v) => … });
```

`field.*` là lớp mỏng trên zod. Mỗi kiểu trường mang sẵn:
- cách kiểm;
- kiểu SQL gợi ý;
- ô nhập;
- toán tử lọc của `bizcity_list@1`;
- cách nhập / xuất.

Các kiểu trường: `text`, `code`, `number`, `money` (R-MONEY), `qty` (đơn vị nhỏ nhất), `date`, `datetime`, `bool`, `enum`, `ref`, `refs`, `json`, `file`, `phone`, `email`, `tags`.

## 3. Thứ sinh ra từ một khai báo

| Đầu ra | Sinh từ | Người dùng | Thay cho cái đang viết tay |
|---|---|---|---|
| zod schema (tạo / sửa / bản vá) | `fields` + `optional` / `max` / `default` | action ghi, bộ nhập | zod trong từng action |
| kiểu TS (`Infer<typeof Item>`) | như trên | mã app, `action-client` | interface ở `contracts` |
| JSON Schema | zod | tool MCP, `record_types.schema`, tài liệu API | schema chép tay |
| **ListDef** `bizcity_list@1` | `search` / `filter` / `sort` của trường | `defineListAction` tự đăng ký `<key>.list` + `<key>.export` | `ListDef` viết tay |
| **API đọc** | key + permissions | `GET /api/v1/e/<key>` (danh sách, con trỏ), `GET /api/v1/e/<key>/:id`, `.../export?format=` ; MCP `<key>.list` / `<key>.get` chỉ đọc | route đọc viết tay |
| **metadata giao diện** | label, kiểu, `filter`, `search` | `GET /api/v1/meta/entities/<key>` ⇒ web-shell vẽ cột, ô, chip lọc, ô tìm | cột / ô trong React |
| **import mapping** | label + `aliases` + parser của kiểu + khoá chống trùng (`unique`) | bộ nhập chạy thử (S003-10): tự ghép cột theo tên, chuẩn hoá số / ngày / SĐT, báo dòng lỗi theo trường | bộ nhập riêng mỗi app |
| bộ chọn tham chiếu | `field.ref` | ô chọn có tìm, tra `EntityRef` qua cổng `MASTERDATA` (ADR-0001 D5) hoặc `entity_links` | ô chọn tự viết |
| nhãn i18n | `label` | toàn bộ trên | chuỗi rải rác |
| quyền | `permissions` | authz manifest, ẩn cột / action | khai lại ở manifest |
| bảng bản sao | `class: 'replica'` + `fields` | `defineAxis` (S004-DM-4) sinh bảng + nhận feed | migration bản sao viết tay |

**Không sinh:**
- migration của bảng chủ. Lược đồ là của chủ (ADR-0001 D2). Registry chỉ **so** lược đồ với khai báo, lệch thì cảnh báo ở `doctor`.
- action ghi cho lớp không an toàn (§5).
- logic nghiệp vụ.

## 4. Sáu lớp thực thể

| `class` | Là gì | Ví dụ | Ai ghi |
|---|---|---|---|
| `config` | danh mục nhỏ của chính app, không ai khác tham chiếu xuyên app | kênh bán, lý do trả hàng | app, **CRUD sinh được** |
| `record` | bản ghi mềm (lớp `records` của open-cake 0103, lõi hoá S003-2) | ghi chú chăm sóc, mẫu tin | app, **CRUD sinh được** |
| `master` | danh mục mà app **là chủ** | `masterdata.item` ở kế toán | **chỉ action của chủ** (luật SKU, nhóm, thuế…); không sinh ghi |
| `replica` | bản chiếu danh mục của chủ ở app khác | `masterdata.item` ở Cake sau khi nối kế toán | **không ai ghi tay**; chỉ feed. Sửa = chứng từ `catalog.proposal` |
| `document` | loại chứng từ (`defineDocumentType`) | `ban-hang.don` | chỉ `documentSpine.create / update (nháp) / transition` |
| `ledger` | sổ cái, bút toán | `ledger_entries` | chỉ cổng sổ của kế toán (`ctx.port(LEDGER)`) |

Một thực thể đổi lớp ở app khác nhau: `masterdata.item` là `master` ở kế toán, là `replica` ở Cake đã nối. Khi Cake còn đứng riêng, nó là `master` với `data_authority.state = local` (ADR-0001 D4).

**Lớp ở runtime lấy từ `data_authority`**, không cứng trong mã. Sau khi chuyển chủ, cùng một khai báo tự thành `replica`.

## 5. Ghi nhạy cảm: Action + Conformance Gate

**Luật sinh ghi (Q-P5-4 ①):**

| `class` | `create` / `edit` / `archive` sinh tự động? |
|---|---|
| `config`, `record` | **có** — sinh thành `defineAction` (`<key>.create`…), mang đủ idempotency, authz, audit, sự kiện `<key>.changed` |
| `master` (đang là chủ, `local`) | **không** — app viết action của mình; registry chỉ cấp sẵn kiểm + tra trùng + sự kiện |
| `replica`, `document`, `ledger` | **không bao giờ** |

**Conformance Gate** gồm các luật `SC-ENT-*`. Chúng chạy hai lần:
- lúc nạp module: lỗi thì module đó không nạp, các module khác vẫn chạy;
- trong `pnpm test` / CI.

| Luật | Chặn |
|---|---|
| SC-ENT-1 | thực thể `document` / `ledger` / `replica` có action ghi sinh tự động, hoặc route ghi không qua `defineAction` |
| SC-ENT-2 | action ghi vào thực thể `master` mà không gọi `dataAuthority.assertWritable` (trục đã chuyển chủ sẽ ghi lén) |
| SC-ENT-3 | `extendEntity` của app B đổi kiểu / bỏ / đổi ràng buộc trường của chủ; khoá trường mở rộng không có tiền tố app (`cake.`) |
| SC-ENT-4 | `defineScreen` gắn nút ghi (`create`, `edit`, `archive`) cho thực thể không có action tương ứng; nút duyệt chứng từ không đi qua `transition` của workflow |
| SC-ENT-5 | trường `money` / `qty` không theo R-MONEY / đơn vị nhỏ nhất; trường tiền / số lượng / trạng thái chứng từ / quyền / bí mật đặt ở `meta` (R-DATA-2 của open-cake) |
| SC-ENT-6 | thực thể có `search` / `filter` trên trường không có chỉ mục (cảnh báo, không chặn); quá 5 khoá `meta` có chỉ mục mỗi app |

**Đọc cũng có cổng:**
- API đọc sinh tự động vẫn qua authz + phạm vi vai (chi nhánh / kho qua `MASTERDATA.orgSubtree`) + RLS tenant.
- Trường đánh dấu `sensitive` (SĐT, MST cá nhân) được che theo quyền, giống ảnh mockup `0909•••567`.

## 6. Registry ở runtime

- `defineEntity` / `extend*` chạy lúc **nạp module**, cùng chỗ với `defineAction`. Không có đường khai báo từ CSDL: không có "tạo thực thể trên giao diện", trừ `record` qua `record_types`.
- `GET /api/v1/meta/entities` trả toàn bộ registry đã gộp phần mở rộng, lọc theo module đang bật cho tenant và theo quyền người gọi. Web-shell, MCP, agent và `cli doctor` đều đọc ở đây.
- Mỗi thực thể có `schemaVersion`. Đổi trường theo kiểu **chỉ thêm** thì cùng phiên bản. Bỏ / đổi kiểu thì tăng phiên bản, kèm bộ chuyển đổi `meta` (R-DATA-7 của open-cake).
- Không đọc CSDL lúc khai báo. Registry thuần trong bộ nhớ, dựng lại được trong test không cần Postgres.

## 7. Quan hệ với cái đã có

| Đã có | Sau phase này |
|---|---|
| `defineListAction(ListDef)` (S003-4) | vẫn dùng được trực tiếp; `defineEntity` **sinh** `ListDef` rồi gọi nó |
| `defineDocumentType` (S003-14) | đăng ký thêm một thực thể `class: 'document'` vào registry để màn / tìm / MCP dùng chung |
| `record_types` + `records` + `entity_meta` của open-cake (0103) | lõi hoá (S003-2): `class: 'record'` và `storage: 'meta'` |
| `bizcity_item_master@1`, `entity-codes`, `dvt` ở contracts | giữ nguyên (ADR-0001 D6); `field.code({ versioned: true })` và `field.qty` dùng chúng |
| authz manifest | quyền đọc / ghi khai ở `permissions`, sinh vào manifest |
