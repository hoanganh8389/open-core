# Scoreboard DX — developer còn phải tự viết bao nhiêu

<!-- sinh bởi tools/scoreboard-dx.mjs từ dx.json — đừng sửa tay tệp này -->

> **Đo lúc:** 2026-11-29 · **open-core:** open-core @ 4dde504 (0.6.0 + 0007) · **Nguồn:** [`dx.json`](dx.json) · **Phương pháp:** [PHASE-005 · 60](../phases/PHASE-005-KHUNG-UNG-DUNG-KHAI-BAO/60-SCOREBOARD-DX.md)
> **Thang:** D0 viết tay toàn bộ · D1 có helper, vẫn ráp nhiều · D2 khai một dòng / khối · D3 tự sinh

| App | Điểm DX | Repo đo |
|---|---|---|
| open-core | **31 %** | origin/main @ 4dde504 |
| open-cake | **20 %** | D:/projects/open-cake @ 1024200 |
| open-ketoan | **27 %** | bản làm việc open-ketoan-main @ af5305ec (đang dở merge README — chỉ đọc) |

## Tính năng vàng (module mẫu `golden`)

- **177 dòng viết tay** (đếm thật, bỏ dòng trống / chú thích) trong 3 tệp: `packages/platform/test/golden/0001_golden.sql`, `packages/platform/test/golden/nhom-khach.mjs`, `packages/platform/test/golden/phieu-yeu-cau.mjs`. Mốc bánh cóc: 177.
- Chạy thật: `TEST_DATABASE_URL=… node --test packages/platform/test/golden.test.mjs (3 / 3 ĐẠT trên Postgres 16)`.
- Chỉ phần máy chủ (đo thật). Giao diện chưa đo được vì lõi chưa có web-shell: màn danh sách + form tương đương hôm nay tốn ≈ 108 dòng (open-cake catalog/item-table + item-sheet) đến 118 dòng (open-ketoan WarehousesPage) cho MỖI thực thể, chưa kể màn chi tiết ⇒ tính năng vàng hôm nay ≈ 177 + ~350 ≈ 530 dòng (phần giao diện là ước theo số đối chiếu).

## Nợ viết tay ở app (đo thật, bánh cóc: không được tăng)

| App | route Fastify viết tay | tệp React tự vẽ `<table` | SHA đo | Ghi chú |
|---|---|---|---|---|
| open-cake | 17 | 8 | `1024200` | 1 trong 17 là vòng lặp sinh route theo spec (runtime.ts:131); 66 spec defineActionSpec riêng của Cake, 0 defineAction lõi |
| open-ketoan | 211 | 108 | `af5305ec` | 204 defineAction; 80 tệp dùng DataGrid |

## Ba mươi thao tác × app

| # | Thao tác | open-core | open-cake | open-ketoan |
|---|---|---|---|---|
| TP-01 | schema kiểm dữ liệu tạo / sửa | D1 | D2 | D1 |
| TP-02 | kiểu TS chung API ↔ giao diện | D1 | D2 | D1 |
| TP-03 | API danh sách (lọc, tìm, sắp, con trỏ) | D1 | D1 | D0 |
| TP-04 | API chi tiết theo ID | D0 | D1 | D0 |
| TP-05 | xuất CSV / XLSX / JSON / NDJSON | D2 | D0 | D1 |
| TP-06 | nhập: ghép cột, chạy thử, lỗi từng dòng | D0 | D0 | D1 |
| TP-07 | màn danh sách (chip lọc, cột, URL, bulk) | D0 | D1 | D1 |
| TP-08 | form tạo / sửa (lỗi dưới ô) | D0 | D1 | D1 |
| TP-09 | màn chi tiết | D0 | D0 | D0 |
| TP-10 | hoạt động / ghi chú / @nhắc / tệp | D1 | D0 | D1 |
| TP-11 | lịch sử phiên bản | D1 | D0 | D1 |
| TP-12 | đánh số chứng từ | D2 | D0 | D1 |
| TP-13 | workflow + nút chuyển trạng thái | D2 | D1 | D1 |
| TP-14 | chuỗi chứng từ | D1 | D0 | D1 |
| TP-15 | quyền đọc / ghi + ẩn nút | D2 | D1 | D1 |
| TP-16 | phạm vi vai (chi nhánh / kho) | D2 | D0 | D1 |
| TP-17 | che dữ liệu nhạy cảm | D1 | D0 | D0 |
| TP-18 | menu + số đếm + route URL | D0 | D0 | D1 |
| TP-19 | REST + MCP cho action | D2 | D1 | D2 |
| TP-20 | idempotency + audit cho ghi | D3 | D3 | D2 |
| TP-21 | sự kiện / outbox | D1 | D0 | D1 |
| TP-22 | chống trùng + cảnh báo | D0 | D1 | D1 |
| TP-23 | lưu trữ / khôi phục | D1 | D1 | D0 |
| TP-24 | bốn trạng thái + lỗi có cách sửa | D0 | D2 | D1 |
| TP-25 | màn Cài đặt + nguồn giá trị + lịch sử | D1 | D0 | D1 |
| TP-26 | trường phụ thuộc tổ chức | D1 | D0 | D0 |
| TP-27 | thông báo theo sự kiện + kênh | D1 | D0 | D1 |
| TP-28 | việc (task) có hạn | D0 | D0 | D0 |
| TP-29 | tìm đa thực thể + saved views | D1 | D0 | D0 |
| TP-30 | báo cáo (tham số, nhóm, drill-down, PDF / Excel) | D0 | D0 | D1 |

## Bằng chứng

### TP-01 schema kiểm dữ liệu tạo / sửa
- **open-core** (D1): zod viết tay trong input mỗi defineAction — test/golden/nhom-khach.mjs (NhomKhachInput)
- **open-cake** (D2): packages/contracts/src/cake/*.ts — một khối zod mỗi spec, dùng chung server / mock / client; flex/records.ts:9-27 sinh tự động (3 loại)
- **open-ketoan** (D1): apps/api/src/modules/warehouses/warehouse.routes.ts:23-35 bodySchema / patchSchema viết tay

### TP-02 kiểu TS chung API ↔ giao diện
- **open-core** (D1): @bizcity/contracts — interface viết tay; chưa có Infer từ registry
- **open-cake** (D2): packages/contracts/src/cake/entities.ts + z.infer; base/action.ts:72-73
- **open-ketoan** (D1): @ketoan/contracts; DTO danh mục chép tay hai nơi (WarehouseDto ↔ WarehousesPage.tsx:17)

### TP-03 API danh sách (lọc, tìm, sắp, con trỏ)
- **open-core** (D1): core/list.ts defineListAction — cột / phép lọc khai lại tay (golden nhomKhachList)
- **open-cake** (D1): apps/api/src/care/inbox.ts:62-122 Kysely tay, con trỏ tự viết; runtime.ts:26-28 paged()
- **open-ketoan** (D0): warehouse.routes.ts:155 r.get + Kysely tay; con trỏ riêng catalog.service.ts:409

### TP-04 API chi tiết theo ID
- **open-core** (D0): golden getNhomKhach + findById viết tay
- **open-cake** (D1): care/inbox.ts:124 cake.contact.get — handler tay, route / kiểm từ spec
- **open-ketoan** (D0): mỗi service tự select().where()

### TP-05 xuất CSV / XLSX / JSON / NDJSON
- **open-core** (D2): defineListAction exportPermission ⇒ csv / json / ndjson (core/list.ts); chưa có xlsx
- **open-cake** (D0): không có (grep text/csv | xlsx = 0)
- **open-ketoan** (D1): DataGrid xuất .xlsx phía trình duyệt; CSV máy chủ viết tay addins/excel-export/index.ts (17 route)

### TP-06 nhập: ghép cột, chạy thử, lỗi từng dòng
- **open-core** (D0): lõi chưa có — golden importNhomKhach viết tay ~40 dòng
- **open-cake** (D0): không có (grep dryRun | columnMap = 0)
- **open-ketoan** (D1): components/ExcelImport.tsx + catalog-import.ts:31 importProducts(dryRun); mỗi thực thể tự viết /import (8 endpoint)

### TP-07 màn danh sách (chip lọc, cột, URL, bulk)
- **open-core** (D0): lõi chưa có web-shell / ListScreen (S003-6)
- **open-cake** (D1): screens/Contacts.tsx, catalog/item-table.tsx — bảng tay ở 8 tệp; ui-kit Chip / Search / Pager; useRoute().setQuery
- **open-ketoan** (D1): components/DataGrid.tsx (637 dòng) + CatalogToolbar.tsx; trang ráp tay; bộ lọc không lên URL

### TP-08 form tạo / sửa (lỗi dưới ô)
- **open-core** (D0): lõi chưa có FormSheet
- **open-cake** (D1): catalog/item-sheet.tsx — Sheet + ActionErrorNote; lỗi một chỗ, không dưới ô
- **open-ketoan** (D1): ui.tsx Field / Modal, FormBlocks.tsx; lỗi qua alert; WarehousesPage.tsx:93-128 ráp tay

### TP-09 màn chi tiết
- **open-core** (D0): lõi chưa có DetailScreen
- **open-cake** (D0): screens/Contact360.tsx 129 dòng viết tay
- **open-ketoan** (D0): modal viewFirst; mỗi thực thể tự dựng (HoSoNccPage.tsx)

### TP-10 hoạt động / ghi chú / @nhắc / tệp
- **open-core** (D1): ctx.documents.note / activities / attach (chỉ chứng từ, chưa có giao diện)
- **open-cake** (D0): care/inbox.ts:151 timeline riêng của khách; không có ghi chú / @nhắc
- **open-ketoan** (D1): ctx.documents.attach + TepDinhKem.tsx (chỉ mua hàng); không có ghi chú / @nhắc

### TP-11 lịch sử phiên bản
- **open-core** (D1): documents.saveVersion có nhưng spine chưa tự gọi (NC-008 AUDIT)
- **open-cake** (D0): flex chỉ có type_version
- **open-ketoan** (D1): ctx.documents.saveVersion — gần như không dùng (asset.service.ts:780)

### TP-12 đánh số chứng từ
- **open-core** (D2): defineDocumentType.series ⇒ YC-2026-0001 (golden PhieuYeuCau)
- **open-cake** (D0): cake/orders.ts:116 YC-<6 ký tự cuối ULID> — không có dãy số
- **open-ketoan** (D1): ctx.documents.nextNumber(series) gọi tay mỗi loại

### TP-13 workflow + nút chuyển trạng thái
- **open-core** (D2): workflow YAML + ctx.documents.transition, tách nhiệm sod (golden); nút giao diện chưa có
- **open-cake** (D1): orders/service.ts:120-135 rẽ nhánh tay; orders/document.ts:10-15 bảng trạng thái phản chiếu
- **open-ketoan** (D1): core/workflow.ts plan(); chỉ 2 tệp workflow.yaml; action tự ghi trạng thái; không có nút chung

### TP-14 chuỗi chứng từ
- **open-core** (D1): document_links + ctx.documents.link; chưa có core.trace.lookup / màn
- **open-cake** (D0): không có
- **open-ketoan** (D1): ctx.documents.link / links + lineage mặt hàng; không có màn chuỗi

### TP-15 quyền đọc / ghi + ẩn nút
- **open-core** (D2): defineAction.permission; che cột theo ListColumn.permission
- **open-cake** (D1): runtime.ts:133 requirePermission theo spec; useCan gọi tay ~21 chỗ
- **open-ketoan** (D1): defineAction.permission (95); useAuth().can ở 57 tệp, ẩn nút tay

### TP-16 phạm vi vai (chi nhánh / kho)
- **open-core** (D2): ctx.branchScope + defineListAction.scope (core/list.ts)
- **open-cake** (D0): care/scope.ts — phạm vi hội thoại viết tay, không có chi nhánh / kho
- **open-ketoan** (D1): authz scope kinds (core/authz/types.ts:40); chỉ một chỗ dùng (bao-cao-kho.ts)

### TP-17 che dữ liệu nhạy cảm
- **open-core** (D1): maskValue theo quyền cột ở list (core/list.ts); không có ở API chi tiết
- **open-cake** (D0): Contacts.tsx:60 hiện SĐT nguyên; chỉ flex pii
- **open-ketoan** (D0): không có che trường

### TP-18 menu + số đếm + route URL
- **open-core** (D0): lõi chưa có registerScreens / menu (S003-3)
- **open-cake** (D0): app/Shell.tsx:15-31 NAV tay; main.tsx:46-58 if-chain
- **open-ketoan** (D1): phan-he/<x>/{manifest,menu,routes}; defineWebModule (module-sdk/src/web.ts)

### TP-19 REST + MCP cho action
- **open-core** (D2): defineAction.expose { http, mcp } (golden)
- **open-cake** (D1): runtime.ts:126-155 sinh REST theo spec; expose.mcp khai nhưng không có máy chủ MCP
- **open-ketoan** (D2): defineAction.expose; mcp.routes.ts sinh tool từ registry (14 action bật)

### TP-20 idempotency + audit cho ghi
- **open-core** (D3): actions.ts — action_requests + audit_logs chuỗi băm tự động mọi action ghi
- **open-cake** (D3): runtime.ts:95-124 tự động mọi command
- **open-ketoan** (D2): actions.ts tự động; mã cũ còn writeAudit tay (warehouse.routes.ts:86)

### TP-21 sự kiện / outbox
- **open-core** (D1): ctx.events.emit gọi tay mỗi action (golden phát 4 chỗ)
- **open-cake** (D0): chỉ pg_notify gợi ý (stream.ts:20-22); emits khai nhưng không phát; không có outbox
- **open-ketoan** (D1): ctx.events.emit + outbox; chỉ ~3 tệp phát

### TP-22 chống trùng + cảnh báo
- **open-core** (D0): golden assertCodeFree viết tay
- **open-cake** (D1): care-kernel/src/identity.ts (chỉ khách); trùng SKU / email viết tay
- **open-ketoan** (D1): partner.hints.ts, item.hints.ts, catalog-warn.ts (chỉ đối tượng / hàng)

### TP-23 lưu trữ / khôi phục
- **open-core** (D1): documentSpine.archive / restore cho chứng từ; thực thể khác viết tay (golden archiveNhomKhach)
- **open-cake** (D1): records.ts:61-67 core.record.archive (chỉ flex); còn lại tay
- **open-ketoan** (D0): xoá cứng deleteFrom (warehouse.routes.ts:128)

### TP-24 bốn trạng thái + lỗi có cách sửa
- **open-core** (D0): lõi chưa có bộ vẽ màn
- **open-cake** (D2): app/QueryView.tsx:10-31 bọc mỗi truy vấn
- **open-ketoan** (D1): ui.tsx Loading / ErrorBox / Empty + RemedyView.tsx; ráp tay mỗi màn

### TP-25 màn Cài đặt + nguồn giá trị + lịch sử
- **open-core** (D1): core/settings.ts registry có phiên bản / nguồn / lịch sử; chưa có màn
- **open-cake** (D0): screens/Settings.tsx + 3 màn cài đặt viết tay
- **open-ketoan** (D1): settings.ts (đọc); lịch sử chỉ AccountingProfilePage.tsx:88

### TP-26 trường phụ thuộc tổ chức
- **open-core** (D1): registerSettingScopes (0006) cho cài đặt; chưa có cho trường
- **open-cake** (D0): không có
- **open-ketoan** (D0): bảng riêng theo tính năng (stock_levels, bảng giá theo chi nhánh)

### TP-27 thông báo theo sự kiện + kênh
- **open-core** (D1): core/notify.ts sendNotification gọi tay; chỉ in_app
- **open-cake** (D0): chuông chưa có xử lý (Shell.tsx:84)
- **open-ketoan** (D1): ctx.notify.send in_app; không có quy tắc / kênh

### TP-28 việc (task) có hạn
- **open-core** (D0): không có
- **open-cake** (D0): không có (NotYet)
- **open-ketoan** (D0): không có

### TP-29 tìm đa thực thể + saved views
- **open-core** (D1): core.document.list tìm chứng từ (chỉ một thực thể)
- **open-cake** (D0): không có; user_meta cake.inbox.filters khai nhưng không dùng
- **open-ketoan** (D0): MenuSearch.tsx chỉ tìm chức năng

### TP-30 báo cáo (tham số, nhóm, drill-down, PDF / Excel)
- **open-core** (D0): không có
- **open-cake** (D0): không có (NotYet)
- **open-ketoan** (D1): ReportPanel.tsx + print/*; mỗi báo cáo route + trang tay (report.routes.ts 24 route)
