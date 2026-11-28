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
| S003-9 | hoạt động (chatter) | ☐ |
| S003-10 | nhập chung có chạy thử | ☐ |
| S003-11 | việc nền + định kỳ | ☐ |
| S003-12 | `bizcity_ux@1` — token, khung, màn mẫu (f1–f13 chủ đã duyệt 2026-11-28; f14–f20 nhóm hàng, mặt hàng, bộ lọc, lưu trữ, nhật ký, lỗi, media chờ duyệt — NC-007) | ◐ |
| S003-13 | scoreboard + màn Tình trạng nền tảng | ◐ |
| S003-14 | trục chứng từ: `defineDocumentType`, `document_meta`, `document_versions`, `document_activities` (NC-007 §3) | ☐ |
| S003-15 | thanh công cụ + "Tất cả bộ lọc" + cây đơn vị trong `<ListScreen>`; `archive / restore / purge` (NC-007 §4) | ☐ |
| S003-16 | `bizcity_issues@1` + màn Nhật ký & trace, Lỗi & sửa lỗi (NC-007 §5) | ☐ |
| S003-17 | `media` + trình điều khiển S3-compatible (R2 / S3 / MinIO) + màn Media (NC-007 §6) | ☐ |
| S003-18 | `ledger_ref {book, org_unit_code}` + cây đơn vị + catalog feed / đề xuất từ kế toán (NC-007 §1–2) | ☐ |
