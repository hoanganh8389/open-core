# PHASE-005 — checklist

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — nguồn trạng thái từng việc; lane theo LANES.md. Mỗi đợt ≤ 4 bước, ra một thứ thấy được. -->

> Ký hiệu: ☐ chưa làm · ◐ đang / có một phần · ☑ xong (có mã + test chạy thật + bằng chứng) · ⛔ bị chặn. Tài liệu không phải "xong".
> Việc mang mã gốc ở phase khác giữ mã đó; cột "Gốc" chỉ chỗ.

| Mã | Việc | Lane | Gốc | Trạng thái |
|---|---|---|---|---|
| **F0** | **Mốc đo** | | | |
| S005-F0-1 | `tools/scoreboard-dx.mjs` + `docs/scoreboard/dx.json` / `DX.md` (tệp riêng, không đụng `scoreboard.json` của lane R) + đo D0–D3 cho 3 app có bằng chứng + nợ viết tay đo thật; `--check` trong `pnpm test` <!-- [2026-11-29 01:14 AM Johnny Chu - Chu Hoàng Anh] S005-F0 — số đo thật --> | T | — | ☑ lõi 31 % · cake 20 % · ketoan 27 %; nợ: cake 17 route / 8 bảng, ketoan 211 / 108; bánh cóc thử đỏ ở 178 > 177 |
| S005-F0-2 | module mẫu `golden` (nhóm khách + phiếu yêu cầu) viết **bằng API hiện có** ⇒ số dòng / tệp mốc thật | T | — | ☑ 177 dòng / 3 tệp máy chủ; `golden.test.mjs` 3 / 3 trên Postgres |
| **F1** | **Entity Registry** | | | |
| S005-F1-1 | `@bizcity/platform/entity`: `defineEntity`, `field.*`, sáu lớp, registry trong bộ nhớ, `GET /api/v1/meta/entities` <!-- [2026-11-29 01:17 AM Johnny Chu - Chu Hoàng Anh] S005-F1 — Entity Registry bản đầu --> | T | — | ☑ `src/entity/entity.ts`; `entity.test.mjs` 5 / 5; golden Nhóm khách 112 ⇒ 13 dòng |
| S005-F1-2 | `extendEntity` / `registerField` / `registerRelation` / `registerValidator` + SC-ENT-3 | T | — | ☐ |
| S005-F1-3 | `entity_meta` + `records` ở lõi (lõi hoá 0103 của open-cake), `storage: 'meta' / 'extension'` | T | S003-2 | ☐ |
| S005-F1-4 | sinh zod / JSON Schema / `ListDef` / import mapping từ registry; `defineListAction` nhận `ListDef` sinh ra | T | S003-4 | ◐ zod, ListDef, ghép cột nhập: có; JSON Schema: chưa |
| **F2** | **API đọc + cổng ghi** | | | |
| S005-F2-1 | API đọc sinh tự động `<key>.list / .get / .export` (REST + MCP chỉ đọc), che `sensitive` | T | S003-4 | ◐ list / get / export có; che `sensitive` chưa |
| S005-F2-2 | ghi sinh cho `config` / `record` (action + sự kiện); Conformance Gate SC-ENT-1…6 lúc nạp + trong `pnpm test` | T | — | ◐ create / update / archive + sự kiện; SC-ENT-1 chặn lúc nạp; SC-ENT-2…6 chưa |
| S005-F2-3 | nhập chạy thử chung (tải → ghép → chạy thử → ghi qua action) + XLSX + xuất nền | T | S003-10, S003-11 | ◐ `<key>.import` (ghép theo nhãn + aliases, chạy thử, lỗi theo dòng); XLSX, ghi theo lô / chạy nền: chưa |
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
| **F6** | **Settings / Meta** ([70](70-SETTINGS-META.md)) <!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-10…15 --> | | | |
| S005-F6-1 | `defineSetting` một tên + màn Cài đặt sinh từ registry | T | — | ☐ |
| S005-F6-2 | bậc `workspace` / `org`; `entity_meta` có phạm vi (trường phụ thuộc tổ chức) — giữ số migration ở CLAIMS | T | S003-2 | ☐ |
| **F7** | **Activity & Notification** ([75](75-ACTIVITY-NOTIFICATION.md)) | | | |
| S005-F7-1 | `entity_activities` + `ctx.activity.{note, task, log}` cho mọi `EntityRef` | T | S003-9 | ☐ |
| S005-F7-2 | `defineNotificationRule` + kênh `email` / `zalo` / `webhook` qua outbox; chuông; Việc của tôi | T | — | ☐ |
| **F8** | **Search / Import / Export** ([80](80-SEARCH-IMPORT-EXPORT.md)) | | | |
| S005-F8-1 | `/api/v1/search` đa thực thể theo quyền + palette Ctrl K | T | S003-20 | ☐ |
| S005-F8-2 | saved views + bulk actions qua action | T | S003-15 | ☐ |
| S005-F8-3 | nhập: ghép cột → xem trước → dry-run từng dòng qua action → ghi theo lô; XLSX (ADR phụ thuộc) | T | S003-10 (= S005-F2-3) | ☐ |
| **F9** | **Reporting** ([85](85-REPORTING.md)) | | | |
| S005-F9-1 | `@bizcity/reporting`: `defineReport`, màn báo cáo, drill-down, PDF / Excel, chạy nền, lineage | T | — | ☐ |
| **UC** | **Upgrade & Conformance** ([90](90-UPGRADE-CONFORMANCE.md)) | | | |
| S005-UC-1 | `bizcity release check` 7 bước + `release-report.json` (`bizcity_conformance_report@1`) | **R** | S004-W1-3, W2-6 | ☐ |
| S005-UC-2 | migration theo phiên bản module (`migrations.since`, `reversible`); bộ CSDL mẫu theo bản (N-1, N-2) | **R** | — | ☐ |
| **BX** | **Bánh xe đóng góp** ([95](95-BANH-XE-DONG-GOP.md)) | | | |
| S005-BX-1 | `tools/ung-vien-loi.mjs` + bảng "Ứng viên lõi" + mục "Đóng góp lõi" trong scoreboard | T | — | ☐ |
| S005-BX-2 | `bizcity dev link-core` (chế độ core-dev) + `bizcity doctor --tim` | R | S005-ML-3 | ☐ |
| S005-BX-3 | đề xuất R-CORE-10 "Lõi trước" + luật SC-STD ở open-platform + bàn giao khối AGENTS / mẫu PR cho từng repo app | T | — | ☐ |
| **F5** | **Dùng thật** | | | |
| S005-F5-1 | open-cake: một thực thể + một màn chuyển sang khai báo; đo Scoreboard DX trước / sau | T (bàn giao open-cake) | S003-7 | ☐ |
| S005-F5-2 | open-ketoan: theo LANES §7 (sau B1) | R | S003-8 | ⛔ claim NT-HT-003 |
