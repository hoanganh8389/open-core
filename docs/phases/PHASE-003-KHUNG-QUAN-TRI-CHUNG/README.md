# PHASE-003 — Khung quản trị chung: người dùng, vai, hook, menu, danh sách / lọc / xuất
<!-- [2026-11-28 06:33 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 — chủ (2026-11-28): "universal user, user role, hook, menu register, chuẩn list table data và các công cụ filter, lọc, export… — ok, chuẩn hoá về open-core, đồng ý phase 003". -->

> **Áp dụng cho:** open-core (`@bizcity/platform`, `@bizcity/server`, `@bizcity/web-shell`, `@bizcity/module-sdk`) · mọi app · **Trạng thái:** ☐ — kế hoạch
> **Chuẩn:** [`bizcity_list@1`](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-LIST-v1.md) (mới) · [USERS-ROLES](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-USERS-ROLES-v1.md) · [AUTHORIZATION](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-AUTHORIZATION-v1.md) · [EXTENSION](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-EXTENSION-v1.md) · [MODULE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-MODULE-v1.md) · [WEB](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-WEB-v1.md)
> **Trạng thái từng việc:** [CHECKLIST.md](CHECKLIST.md)

## 0. Một câu

**App khai, lõi chạy:** người dùng, vai, quyền theo màn × thao tác, menu, hook, danh sách có lọc / sắp xếp / xuất — mỗi thứ một registry ở lõi, một màn chung ở web-shell. Kế toán, POS, HRM, cake không tự dựng lại.

## 1. Hiện trạng → đích

| Mảng | Có hôm nay | Đích ở open-core |
|---|---|---|
| Người dùng | `users` ở `0001` lõi, `sub = wp:<id>` (`external_sub`, 0.3.1), SSO vé WordPress | giữ; **`user_meta`** (tuỳ chọn cá nhân, ≈ `wp_usermeta`) vào migration lõi — đang chỉ ở open-cake `0103_flex.sql` |
| Vai, quyền, phạm vi | `registerRoles`, `registerModulePermissions`, `user_role_assignments` (tenant / chi nhánh / kho / org_unit × mục đích), `tenant_roles`, `authz-manifest.ts` | giữ; thêm **màn × thao tác** chung (mẫu NT-HT-003 của open-ketoan: `extensions.screens[]`, kiểu thao tác `xem · ghi · huy · xuat`) — `registerScreens` ở lõi, `GET /api/v1/man-hinh` |
| Hook | danh sách đóng `HOOKS = ['masterdata.referenceCheck']`, chỉ đọc; sự kiện qua `registerSubscribers` | giữ nguyên tắc (lõi hỏi, module trả lời; muốn "sau khi…" ⇒ sự kiện outbox); thêm hook lõi chung: `document.beforeTransition`, `user.beforeDeactivate`, `setting.validate` |
| Menu | open-ketoan: manifest `extensions.menu` + `WebModule.groups`; open-cake: viết cứng trong app | **`registerMenu`** (từ manifest) ⇒ web-shell dựng menu: lọc theo quyền thao tác `xem` của màn, ẩn module tắt ở tenant, mỗi mục có trang trợ giúp (SC-DOC-6) |
| Danh sách / lọc / xuất | open-ketoan: `DataGrid`, `FilterLayout`, bộ tham số đã lưu, `getPage` có tổng, add-in `excel-export` (CSV qua HTTP); open-cake: con trỏ keyset, `useInfiniteQueryAction`, bộ lọc trên URL | **`bizcity_list@1`**: `defineListAction` ⇒ API danh sách (`q`, `f.<cột>.<phép>`, `sort`, `cursor`, `count`, `sums`) + xuất CSV / XLSX (quyền xuất riêng, bằng chứng, chạy nền khi lớn) + tool MCP chỉ đọc; `<ListScreen>` ở web-shell |

## 2. Đầu ra

| # | Gói | Việc |
|---|---|---|
| S003-1 | open-platform | chuẩn `bizcity_list@1` 0.1.0-draft (bizcity-platform #39) → 0.2 kèm schema + vector `schema/list/` (cú pháp `f.<cột>.<phép>`, con trỏ, lỗi) |
| S003-2 | `@bizcity/platform` | migration lõi **0005** `user_meta` (hình như open-cake `0103`, RLS) + `ctx.userMeta.get / set` + đăng ký khoá (`registerUserMeta`, khớp `user_meta[]` của `bizcity.authz.json`); `coveredBy` cho open-cake; `kiem-luoc-do` thêm bảng |
| S003-3 | `@bizcity/platform` | **`registerScreens` / `registerMenu`** + `GET /api/v1/man-hinh`, `GET /api/v1/menu` (đã lọc quyền, module bật); dời từ open-ketoan (NT-HT-003 GĐ4) khi dòng giữ chỗ trả, giữ khuôn manifest |
| S003-4 | `@bizcity/platform` | **`defineListAction`**: cột → zod truy vấn, Kysely tham số hoá, giao phạm vi vai, con trỏ, `count` / `sums`; đầu xuất CSV / XLSX + công việc nền + Storage `exports`; tool MCP chỉ đọc; test vector `bizcity_list@1` |
| S003-5 | `@bizcity/platform` | hook lõi mới (danh sách đóng): `document.beforeTransition`, `user.beforeDeactivate`, `setting.validate` |
| S003-6 | `@bizcity/web-shell` (gói mới) | `ListScreen` · `FilterBar` (dựng từ cột) · `SavedViews` (`user_meta`) · nút Xuất · menu chung · màn bốn bước (`bizcity_hub_setup@1`) — tách view / model theo WEB |
| S003-7 | open-cake | danh sách Khách / Hội thoại / Đơn yêu cầu chuyển sang `defineListAction` + `ListScreen`; `user_meta` của lõi thay bản `0103` (baseline bằng `coveredBy`); ma trận xanh |
| S003-8 | open-ketoan (sau PHASE-001) | `DataGrid` / `FilterLayout` / `excel-export` ⇒ `ListScreen` / xuất chung theo từng màn, qua R-FLOW |
| S003-9 | `@bizcity/platform` + web-shell | **Hoạt động (chatter)** — bảng lõi `activities` gắn `doc_ref` (ghi chú, việc có hạn + người nhận, thay đổi tự sinh từ `audit_logs`, tệp), chỉ thêm; khối `<Activity>` ở `DetailScreen`; "Việc của tôi" là một `ListScreen` ([NC-005](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-005-LOI-ERP-HOC-WP-ODOO.md) §2.1) | <!-- [2026-11-28 06:54 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 — chủ đồng ý NC-005 (2026-11-28): thêm chatter, nhập chung, việc nền, bizcity_ux@1, scoreboard -->
| S003-10 | `@bizcity/platform` + web-shell | **Nhập chung** — `POST …/import` cùng cột `ListDef`; **chạy thử bắt buộc** (từng dòng: tạo / sửa / bỏ / lỗi + `field`), chạy thật cùng `Idempotency-Key`; mỗi dòng qua action ghi của module; lớn ⇒ việc nền; `ImportScreen` (NC-005 §2.2) |
| S003-11 | `@bizcity/platform` | **Việc nền + định kỳ** — bảng `jobs`, lấy việc `FOR UPDATE SKIP LOCKED`, thử lại giãn dần, `registerJob` / `registerSchedule`, chạy trong ngữ cảnh tenant + `traceparent`; dùng cho xuất / nhập lớn, gửi lại chứng từ, nhắc việc (NC-005 §2.3) |
| S003-12 | `@bizcity/ui-kit` + web-shell | **`bizcity_ux@1`** — token một nguồn (bản mẫu open-cake), khung app, tám màn mẫu; **mockup f1–f13 chủ đã duyệt (2026-11-28)**; f14–f20 (nhóm hàng nguồn kế toán · mặt hàng + thanh công cụ · Tất cả bộ lọc + cây đơn vị · lưu trữ & thùng rác · nhật ký & trace · lỗi & sửa lỗi · media R2/S3 — NC-007) chủ đã duyệt 2026-11-28; f7–f13 (Người dùng · Vai & quyền · Cài đặt chung theo bậc · Danh mục & mặt hàng · Hệ thống & nhật ký · Tên miền & Workspace · Tìm chứng từ ⌘K, theo NC-006 đa chi nhánh) chờ duyệt — `[2026-11-28 07:10 PM Johnny Chu - Chu Hoàng Anh] S003-12`: [`docs/ui/mockup-src/web-shell.html`](../../ui/mockup-src/web-shell.html), ảnh ở [`docs/ui/mockup-shots/`](../../ui/mockup-shots/) |
| S003-13 | open-core | **Scoreboard** ERP-12 × app (mức 0–4 + bằng chứng): [`docs/scoreboard/`](../../scoreboard/SCOREBOARD.md) (`scoreboard.json` máy đọc, `tools/scoreboard.mjs` sinh bảng); hiện trong app ở **Cài đặt hệ thống › Tình trạng nền tảng** (màn `PlatformStatus`) |

## 3. Nguyên tắc (đã chốt cùng NC-004 / Q-DD)

- **Một API, một quy tắc cho mọi app** — app không viết route danh sách tay, không tự làm xuất Excel, không tự dựng menu.
- **Quyền xuất tách quyền xem** (`kind: 'xuat'` ở màn × thao tác) — xuất là rò dữ liệu tiềm năng, luôn ghi bằng chứng.
- **Tuỳ chọn cá nhân ở `user_meta`**, cài đặt dùng chung ở `setting_values` — không bảng riêng cho bộ lọc / cột.
- **Hook danh sách đóng**: thêm hook = PR vào lõi + chuẩn EXTENSION; module không tự đặt tên hook.

## 4. Xong khi

open-cake có ít nhất ba danh sách chạy bằng `defineListAction` + `ListScreen` (lọc, sắp xếp, con trỏ, bộ lọc đã lưu, xuất CSV / XLSX có bằng chứng), menu dựng từ registry; ma trận open-ketoan × open-cake xanh; vector `bizcity_list@1` qua.

## Nhật ký

- 2026-11-28: mở phase (kế hoạch) — chủ đồng ý chuẩn hoá về open-core.
- 2026-11-28: <!-- [2026-11-28 06:54 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 — chủ đồng ý NC-005 (2026-11-28): thêm chatter, nhập chung, việc nền, bizcity_ux@1, scoreboard --> thêm S003-9…13; mockup web-shell 6 khung (danh sách, chi tiết + hoạt động, sheet, nhập chạy thử, tình trạng nền tảng, bốn bước) chờ duyệt.
