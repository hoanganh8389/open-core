# PHASE-005 · 40 — View Framework: `defineScreen`

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — View Framework cho vibe coding: một khai báo màn ⇒ list / form / detail / nhập / xuất / hoạt động, khớp mockup f1–f20. -->

## 1. Mục tiêu

Developer, hoặc agent, viết **một khối** cho mỗi thực thể:

```ts
export const ItemScreen = defineScreen({
  entity: 'masterdata.item',
  views: ['list', 'form', 'detail'],
  searchable: ['code', 'name', 'barcode'],
  filters: ['category', 'brand', 'status'],
  columns: ['code', 'name', 'category', 'uom', 'status'],      // bỏ trống ⇒ lấy trường có `list: true` trong registry
  actions: ['create', 'edit', 'archive'],                       // tên action đã có trong registry (SC-ENT-4)
  bulk: ['archive'],
  import: true,
  export: ['csv', 'xlsx', 'json', 'ndjson'],
  activities: true,
  menu: { group: 'ban-hang', label: 'Mặt hàng', order: 30 },
});
```

Web-shell tự vẽ đúng các màn đã duyệt. Không viết React cho màn phổ thông.

## 2. Khai báo ⇒ màn (khớp mockup)

| Phần trong khai báo | Ra cái gì | Mockup |
|---|---|---|
| `views: ['list']` + `searchable` + `filters` + `columns` | **ListScreen**: các phần dưới đây | f1, f16 · ảnh "Đơn bán hàng" |
| | — ô tìm; | |
| | — chip lọc có ✕; | |
| | — "+ Thêm lọc" / "Tất cả bộ lọc"; | |
| | — chọn cột; | |
| | — sắp theo cột; | |
| | — cuộn con trỏ; | |
| | — dòng tổng "Tổng theo bộ lọc"; | |
| | — trạng thái nằm trên URL (`f.<cột>.<phép>`, `sort`) — F5 về đúng chỗ, gửi link được. | |
| `bulk` | thanh "N đã chọn · Duyệt · In · Xuất dòng đã chọn" | ảnh "Đơn bán hàng" |
| `export` | menu Xuất: CSV (Excel mở thẳng tiếng Việt) · XLSX · JSON (`bizcity_list_export@1`) · NDJSON (chạy nền, báo ở chuông). Cùng bộ lọc đang xem, cần quyền Xuất, ghi nhật ký | ảnh "Đơn bán hàng", S003-4 |
| `import: true` | màn nhập: tải tệp → tự ghép cột theo registry → **chạy thử**, báo lỗi từng dòng / trường → ghi | f4, S003-10 |
| `views: ['form']` + `actions: ['create', 'edit']` | **FormSheet** (tấm trượt phải) | f3 · ảnh "Thêm khách hàng" |
| | — ô theo kiểu trường; | |
| | — lỗi ngay dưới ô, kiểu "… — Cách sửa: …" (`remedy` của `bizcity_errors@1`); | |
| | — cảnh báo trùng do validator; | |
| | — Esc để đóng, Huỷ / nút chính cố định đáy. | |
| `views: ['detail']` + `activities: true` | **DetailScreen** | f2 · ảnh "DB-2026-0142" |
| | — khối Thông tin; | |
| | — bảng dòng (chứng từ); | |
| | — cột phải Hoạt động · Việc · Tệp · Lịch sử: ghi chú, @nhắc, đính kèm, "sửa ⇒ phiên bản @2" tự ghi từ nhật ký thao tác. | |
| thực thể `document` | thêm trên DetailScreen, tất cả lấy từ workflow + `document_links`: | ảnh "DB-2026-0142" |
| | — nhãn trạng thái theo sáu nhóm; | |
| | — nút chuyển trạng thái ("Trả lại người lập", "Duyệt"); | |
| | — **Chuỗi chứng từ** (`source →`, `ledger →`, "chưa lập", "chưa ghi sổ"); | |
| | — phiên bản `@n`. | |
| `menu` | mục trong thanh trái theo nhóm, có số đếm | mọi ảnh |
| — (luôn có) | bốn trạng thái: đang tải · rỗng · lỗi có cách sửa · không có quyền; che dữ liệu nhạy cảm theo quyền (`0909•••567`); nhãn "Dữ liệu minh hoạ" khi tenant mẫu | `bizcity_ux@1` |

## 3. Cách chạy

```text
module (máy chủ)                     lõi                                     web-shell (trình duyệt)
defineEntity ─┐                                                                
defineScreen ─┼─► registry ─► GET /api/v1/meta/screens/<key> ─► ScreenRenderer ─► ListScreen / FormSheet / DetailScreen
defineAction ─┘               (đã lọc theo module bật + quyền)        │
                               <key>.list / .export / .get  ◄─────────┘ (action-client, có kiểu)
```

- **Khai ở máy chủ** (Q-P5-5 ①):
  - một nguồn cho web-shell, MCP, agent và bộ kiểm;
  - quyền được lọc trước khi tới trình duyệt — nút không có quyền thì không có trong metadata.
- Metadata màn có phiên bản (`screenVersion`). Web-shell đệm theo phiên bản, không gọi lại mỗi lần chuyển trang.
- **S003-3 (`registerScreens`, menu) bị chặn vì claim NT-HT-003 của open-ketoan.**
  - Đề xuất Q-P5-7 ①: lõi làm `defineScreen` mới, có bí danh `registerScreens`.
  - Không dời mã từ open-ketoan.
  - open-ketoan chuyển màn của mình khi claim trả.

## 4. Lối thoát — khi màn phổ thông không đủ

| Cần | Cách | Không được |
|---|---|---|
| ô hiện đặc biệt (2 Thùng × 24) | `cells: { qty: 'qtyWithUnit' }` — bộ vẽ ô có tên ở ui-kit, hoặc ô riêng của module đăng ký `registerCell('cake.qty_pack', Component)` | tự vẽ cả bảng |
| khối riêng trên chi tiết | `sections: [{ after: 'info', component: 'cake.order.delivery' }]` | |
| nút nghiệp vụ riêng | `actions: ['cake.order.confirm_address']` — nút gọi action đã khai; dialog tham số sinh từ zod của action | nút gọi `fetch` thẳng |
| màn hoàn toàn riêng (POS bán hàng, sổ cái) | `views: ['custom']` + `component` — vẫn đi qua shell, menu, quyền, URL route | màn ngoài shell |

**Luật:** lối thoát chỉ đổi **cách hiện**. Mọi thao tác ghi vẫn là action (SC-ENT-4).

## 5. Vì sao quan trọng với vibe coding

- Agent chỉ phải sinh **hai khai báo**: `defineEntity` và `defineScreen`, khoảng 40 dòng, thay vì khoảng 8 tệp (route, zod, ListDef, React list, React form, React detail, importer, menu). Khai báo sai thì Conformance Gate báo đúng chỗ (SC-ENT-*). Màn tự viết thì không ai kiểm được.
- `cli scaffold entity <key>` sinh sẵn hai khai báo + test mẫu ([50](50-MODULE-LIFECYCLE.md)).
- `cli doctor` đọc `/api/v1/meta/*` và so với mockup / chuẩn UX: thiếu bốn trạng thái, thiếu quyền, cột không có chỉ mục.
- Màn sinh ra **giống nhau ở mọi app**. Người dùng học một lần, dùng ở Cake, Kế toán, Kiot.
