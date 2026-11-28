# PHASE-003-KHUNG-QUAN-TRI-CHUNG — checklist

<!-- [2026-11-28 06:33 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 — nguồn trạng thái từng việc của phase. -->

> Ký hiệu: ☐ chưa làm · ◐ đang / có một phần · ☑ xong (có bằng chứng ở README) · ⛔ bị chặn.

| Mã | Việc | Trạng thái |
|---|---|---|
| S003-1 | chuẩn `bizcity_list@1` (0.1 bản nháp → 0.2 schema + vector) | ◐ |
| S003-2 | `user_meta` ở migration lõi + `ctx.userMeta` | ☐ |
| S003-3 | `registerScreens` / `registerMenu` + `/api/v1/man-hinh`, `/api/v1/menu` | ⛔ dời từ open-ketoan khi NT-HT-003 trả chỗ |
| S003-4 | `defineListAction` + xuất CSV / XLSX + MCP chỉ đọc | ☐ |
| S003-5 | hook lõi mới (danh sách đóng) | ☐ |
| S003-6 | `@bizcity/web-shell`: ListScreen, FilterBar, SavedViews, menu, màn bốn bước | ☐ |
| S003-7 | open-cake dùng khung chung | ☐ |
| S003-8 | open-ketoan dùng khung chung | ☐ |
| S003-9 | hoạt động (chatter) — `document_activities` + `ctx.documents.note / activities` (lõi xong, chờ màn) | ◐ |
| S003-10 | nhập chung có chạy thử | ☐ |
| S003-11 | việc nền + định kỳ | ☐ |
| S003-12 | `bizcity_ux@1` — token, khung, màn mẫu (f1–f20 chủ đã duyệt 2026-11-28; Q-UX-1 theo mockup) | ◐ |
| S003-13 | scoreboard + màn Tình trạng nền tảng | ◐ |
| S003-14 | trục chứng từ: `defineDocumentType`, meta đầu phiếu (`business_documents.meta`, khoá khai trong loại — không thêm bảng), `document_versions`, `document_activities` (NC-007 §3) | ◐ lõi xong: 0005, `document-spine.ts`, `ctx.documents.create / update / transition / note / archive / restore`, test 6 ca; còn màn + open-cake / open-ketoan dùng |
| S003-15 | thanh công cụ + "Tất cả bộ lọc" + cây đơn vị trong `<ListScreen>`; `archive / restore / purge` (NC-007 §4) | ☐ |
| S003-16 | `bizcity_issues@1` + màn Nhật ký & trace, Lỗi & sửa lỗi (NC-007 §5) | ☐ |
| S003-17 | `media` + trình điều khiển S3-compatible (R2 / S3 / MinIO) + màn Media (NC-007 §6) | ☐ |
| S003-18 | `ledger_ref {book, org_unit_code}` + cây đơn vị + catalog feed / đề xuất từ kế toán (NC-007 §1–2) | ☐ |
| S003-19 | `Money` + `fx_rate` ở trục chứng từ (đa tiền tệ, Q-ERP-1 chốt có — NC-007 §8) | ◐ lõi xong: `currency` / `fx_rate` / `total_fc` (0005), contracts `currencyDigits` / `roundCurrency` / `toBaseAmount`, `resolveMoney`; còn bảng tỷ giá phía kế toán, spine 1.3 |
| S003-20 | tìm chứng từ chuẩn hoá `core.document.list` + `list-query.ts` (NC-006 §3, NC-007 §3) | ◐ lõi xong (51 / 51); còn palette ⌘K ở web-shell, app đưa action vào mountActions |
