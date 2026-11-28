# PHASE-005 — checklist

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — nguồn trạng thái từng việc; lane theo LANES.md. Mỗi đợt ≤ 4 bước, ra một thứ thấy được. -->

> Ký hiệu: ☐ chưa làm · ◐ đang / có một phần · ☑ xong (có mã + test chạy thật + bằng chứng) · ⛔ bị chặn. Tài liệu không phải "xong".
> Việc mang mã gốc ở phase khác giữ mã đó; cột "Gốc" chỉ chỗ.

| Mã | Việc | Lane | Gốc | Trạng thái |
|---|---|---|---|---|
| **F0** | **Mốc đo** | | | |
| S005-F0-1 | `tools/scoreboard-dx.mjs` + mục `dx` trong `scoreboard.json` + đo điểm D0–D3 cho 3 app (bằng chứng đường dẫn) | T | — | ☐ |
| S005-F0-2 | module mẫu `golden` (nhóm khách + phiếu yêu cầu) viết **bằng API hiện có** ⇒ số dòng / tệp mốc thật | T | — | ☐ |
| **F1** | **Entity Registry** | | | |
| S005-F1-1 | `@bizcity/platform/entity`: `defineEntity`, `field.*`, sáu lớp, registry trong bộ nhớ, `GET /api/v1/meta/entities` | T | — | ☐ |
| S005-F1-2 | `extendEntity` / `registerField` / `registerRelation` / `registerValidator` + SC-ENT-3 | T | — | ☐ |
| S005-F1-3 | `entity_meta` + `records` ở lõi (lõi hoá 0103 của open-cake), `storage: 'meta' / 'extension'` | T | S003-2 | ☐ |
| S005-F1-4 | sinh zod / JSON Schema / `ListDef` / import mapping từ registry; `defineListAction` nhận `ListDef` sinh ra | T | S003-4 | ☐ |
| **F2** | **API đọc + cổng ghi** | | | |
| S005-F2-1 | API đọc sinh tự động `<key>.list / .get / .export` (REST + MCP chỉ đọc), che `sensitive` | T | S003-4 | ☐ |
| S005-F2-2 | ghi sinh cho `config` / `record` (action + sự kiện); Conformance Gate SC-ENT-1…6 lúc nạp + trong `pnpm test` | T | — | ☐ |
| S005-F2-3 | nhập chạy thử chung (tải → ghép → chạy thử → ghi qua action) + XLSX + xuất nền | T | S003-10, S003-11 | ☐ |
| **F3** | **View Framework** | | | |
| S005-F3-1 | `defineScreen` + `GET /api/v1/meta/screens` + bí danh `registerScreens` / menu | T | S003-3 (Q-P5-7) | ☐ |
| S005-F3-2 | `@bizcity/web-shell`: ScreenRenderer, ListScreen, FormSheet, DetailScreen, bốn trạng thái — khớp f1–f3 | T | S003-6, S003-12, S003-15 | ☐ |
| S005-F3-3 | khối Hoạt động + chuỗi chứng từ + nút workflow trên DetailScreen | T | S003-9, S004-W4-4 | ☐ |
| S005-F3-4 | `@bizcity/action-client` (gọi action có kiểu) | T | — | ☐ |
| **F4** | **Module Lifecycle + DX** ([50](50-MODULE-LIFECYCLE.md)) | | | |
| S005-ML-1 | `defineModule` mở rộng (entities, screens, settings, permissions, migrations, lifecycle, requires) | **R** | S004-W3-2 | ☐ |
| S005-ML-2 | phụ thuộc module + hook vòng đời + màn Phân hệ | **R** | S004-W3-1 | ☐ |
| S005-ML-3 | `@bizcity/cli`: scaffold module / entity, module install / enable, doctor, scoreboard dx | **R** | — | ☐ |
| S005-ML-4 | `@bizcity/testing`: CSDL thử, chạy hook hai lần, vector conformance | **R** | — | ☐ |
| **F5** | **Dùng thật** | | | |
| S005-F5-1 | open-cake: một thực thể + một màn chuyển sang khai báo; đo Scoreboard DX trước / sau | T (bàn giao open-cake) | S003-7 | ☐ |
| S005-F5-2 | open-ketoan: theo LANES §7 (sau B1) | R | S003-8 | ⛔ claim NT-HT-003 |
