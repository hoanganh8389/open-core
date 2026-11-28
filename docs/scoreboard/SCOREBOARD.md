# Scoreboard — mã đáp ứng tài liệu tới đâu (ERP-12 × app)

<!-- sinh bởi tools/scoreboard.mjs từ scoreboard.json — đừng sửa tay tệp này -->

> **Đo lúc:** 2026-11-28 · **open-core:** 0.4.0 · **Nguồn:** [`scoreboard.json`](scoreboard.json) · **Màn trong app:** Cài đặt hệ thống › Tình trạng nền tảng ([mockup](../ui/mockup-shots/f5-tinh-trang-nen-tang.png))
> **Thang:** 0 chưa có · 1 mới tài liệu · 2 có một phần · 3 có mã + test ở app · 4 ở open-core, có test, app dùng

| App | Mức trung bình |
|---|---|
| open-core | **51 %** |
| open-cake | **48 %** |
| open-ketoan | **65 %** |

| # | Thứ dùng chung | open-core | open-cake | open-ketoan | Còn thiếu chính |
|---|---|---|---|---|---|
| P1 | Người dùng · danh tính (sub = wp:<id>, SSO, external_sub) | **2** | **3** | **3** | test SSO ở lõi; open-cake ghép theo external_sub |
| P2 | Vai · quyền · phạm vi · màn × thao tác | **3** | **3** | **3** | màn × thao tác lên lõi (S003-3, chờ NT-HT-003) |
| P3 | Cài đặt + thang phạm vi | **2** | **1** | **3** | registerSettingScopes (Q-PIL-6), test ở lõi |
| P4 | user_meta + lớp mềm (entity_meta, record_types, records) | **1** | **3** | **2** | dời lên lõi (S003-2) |
| P5 | Chứng từ: 4 bảng, đánh số, phiên bản, liên kết, workflow YAML | **3** | **0** | **3** | open-cake dùng trục chứng từ thay order_requests riêng; open-ketoan lên 0005 qua R-FLOW |
| P6 | Danh sách · lọc · con trỏ · xuất (bizcity_list@1) | **1** | **2** | **3** | defineListAction + ListScreen + xuất chung (S003-4, S003-6) |
| P7 | Nhập chung (ghép cột + chạy thử) | **0** | **0** | **3** | nhập chung ở lõi (S003-10) |
| P8 | Hoạt động (chatter) trên doc_ref | **3** | **0** | **1** | bảng activities + khối Hoạt động (S003-9) |
| P9 | Tệp / Storage (đường dẫn ký) | **2** | **3** | **2** | Storage của open-cake lên lõi (C5) |
| P10 | Việc nền + định kỳ | **3** | **2** | **3** | registerJob / registerSchedule (S003-11); open-cake bỏ setInterval |
| P11 | Đệm (Redis tuỳ chọn) | **1** | **2** | **2** | module đệm chung (C5) |
| P12 | Bí mật (platform.secrets) | **2** | **0** | **3** | test ở lõi; khoá Hub lưu bằng secrets |
| P13 | Sự kiện / outbox / gửi xuyên app / changefeed | **3** | **2** | **3** | changefeed + gửi / nhận chứng từ chung (S002-3, S002-4) |
| P14 | Bằng chứng · audit chuỗi băm · trace | **4** | **3** | **3** | core.trace.lookup xuyên app (S002-5) |
| P15 | Menu · màn · khung app (web-shell) | **1** | **2** | **3** | @bizcity/web-shell + registerMenu |
| P16 | Hook danh sách đóng + registry module, bật theo tenant | **2** | **2** | **3** | module-sdk lõi; hook chung mới (S003-5) |
| P17 | Nhiều site: registry, /_sites/v1, migration theo nguồn | **3** | **2** | **3** | /_sites/v1 khung vào @bizcity/server (NC-003 C7) |
| P18 | API: defineAction → REST + MCP, Idempotency-Key, danh mục lỗi | **3** | **3** | **3** | test lõi; open-cake chuyển sang defineAction của lõi (C5) |
| P19 | Bốn bước kết nối open-hub (bizcity_hub_setup@1) | **1** | **2** | **1** | /api/v1/setup/* + SetupScreen |
| P20 | Hệ thiết kế giao diện: token, ui-kit, bốn trạng thái, i18n | **1** | **3** | **2** | @bizcity/ui-kit + token một nguồn (S003-12) |

## Bằng chứng

### P1 Người dùng · danh tính (sub = wp:<id>, SSO, external_sub)
- **open-core** (2): packages/platform/src/core/auth.ts, security/tokens.ts, db/migrations/0003_platform_external_sub.sql — open-cake đang dùng; chưa test SSO ở lõi
- **open-cake** (3): apps/api/src/auth/routes.ts (/api/v1/auth/wp-sso), test/auth.http.test.ts — chưa dùng external_sub
- **open-ketoan** (3): apps/api/src/modules/auth/wp-sso.ts, 0183_nguoi_dung_external_sub.sql, test/wp-sso-sub-aud.test.ts

### P2 Vai · quyền · phạm vi · màn × thao tác
- **open-core** (3): core/authz/*, roles.ts, 0002_platform_vai_theo_app.sql, test/roles.test.mjs, open-cake dùng (vai: mức 4) — màn × thao tác chưa có ở lõi (mức 1, S003-3 ⛔)
- **open-cake** (3): apps/api/src/auth/authz.ts, staff.ts, care/scope.ts, test/scope.http.test.ts
- **open-ketoan** (3): modules/access/man-hinh.ts, man-hinh-module.ts, test/phan-quyen-man-hinh.test.ts

### P3 Cài đặt + thang phạm vi
- **open-core** (2): core/settings.ts, setting_values ở 0001 — chưa test, thang còn cứng accounting_unit
- **open-cake** (1): db/migrations/0103_flex.sql (chỉ ghi chú dùng setting_values)
- **open-ketoan** (3): 0074_gia_tri_cau_hinh.sql, test/cau-hinh-gia-tri.test.ts

### P4 user_meta + lớp mềm (entity_meta, record_types, records)
- **open-core** (1): chỉ nhắc ở core/authz-manifest.ts; S003-2 ☐
- **open-cake** (3): 0103_flex.sql, apps/api/src/records.ts, test/records.http.test.ts
- **open-ketoan** (2): entity_attributes theo ngày (0087, 0168), chưa có lớp mềm

### P5 Chứng từ: 4 bảng, đánh số, phiên bản, liên kết, workflow YAML
- **open-core** (3): core/documents.ts, document-spine.ts (defineDocumentType, tạo / sửa nháp / chuyển / lưu trữ, tiền tệ + tỷ giá), workflow.ts, 0005 — test/document-spine.test.mjs, test/workflow.test.mjs, test/documents-events.test.mjs (cấp số, phiên bản, DocLink, RLS) chạy thật trên Postgres; open-cake chưa dùng
- **open-cake** (0): —
- **open-ketoan** (3): test/documents-common.test.ts, workflow.test.ts, dinh-kem-chung-tu.test.ts

### P6 Danh sách · lọc · con trỏ · xuất (bizcity_list@1)
- **open-core** (1): chuẩn bizcity_list@1 0.2 (bizcity-platform #39), S003-4 ☐
- **open-cake** (2): con trỏ ở care/inbox.ts, screens/Contacts.tsx — chưa xuất
- **open-ketoan** (3): apps/web/src/components/DataGrid.tsx (xuất xlsx), test/excel-export-all.test.ts — khuôn riêng, chưa theo bizcity_list@1

### P7 Nhập chung (ghép cột + chạy thử)
- **open-core** (0): —
- **open-cake** (0): —
- **open-ketoan** (3): modules/catalog/catalog-import.ts (dryRun), NhapExcelWizard.tsx, test/catalog-import.test.ts — riêng danh mục

### P8 Hoạt động (chatter) trên doc_ref
- **open-core** (3): document_activities (0005, chỉ thêm) + documentSpine.note / activities, ctx.documents — test/document-spine.test.mjs; chưa màn web-shell
- **open-cake** (0): —
- **open-ketoan** (1): chỉ notifications + document_attachments, chưa ghi chú / việc

### P9 Tệp / Storage (đường dẫn ký)
- **open-core** (2): documents.ts lưu đĩa DATA_DIR — chưa đường dẫn ký
- **open-cake** (3): apps/api/src/storage/{local,s3,routes,sniff}.ts, 0109_files.sql, test/storage.test.ts, files.http.test.ts
- **open-ketoan** (2): đính kèm có test, chưa lớp storage / đường dẫn ký

### P10 Việc nền + định kỳ
- **open-core** (3): core/events.ts (tickClock, thử lại, dead) — thử lại → dead có test (test/documents-events.test.mjs); chưa API việc / lịch
- **open-cake** (2): 3 vòng setInterval ở apps/api/src/server.ts:87-91 (trái luật 'chỉ một đồng hồ')
- **open-ketoan** (3): test/events.test.ts, modules/system/loi-he-thong.ts

### P11 Đệm (Redis tuỳ chọn)
- **open-core** (1): BIZCITY-CACHE-v1; chỉ đệm lẻ (module-registry 30 s, authz)
- **open-cake** (2): đệm lẻ ở orders/link.ts, partner.ts
- **open-ketoan** (2): đệm lẻ, test/site-cache.test.ts

### P12 Bí mật (platform.secrets)
- **open-core** (2): core/secrets.ts, 0004_platform_secrets.sql — chưa test ở lõi
- **open-cake** (0): —
- **open-ketoan** (3): 0184_tenant_secrets.sql, test/secrets.test.ts

### P13 Sự kiện / outbox / gửi xuyên app / changefeed
- **open-core** (3): core/events.ts (outbox, SKIP LOCKED) — outbox, dedupeKey, giao một lần, thử lại → dead có test chạy thật (test/documents-events.test.mjs); chưa registerSyncFeed
- **open-cake** (2): outbox riêng channel_commands (0106), chưa /api/v1/sync
- **open-ketoan** (3): modules/sync/sync.routes.ts, test/spine-changefeed.test.ts

### P14 Bằng chứng · audit chuỗi băm · trace
- **open-core** (4): chuỗi băm ở 0001, test/nen-tang.test.mjs; core/tracing.ts, audit.ts — open-cake dùng tracing
- **open-cake** (3): apps/api/src/runtime.ts ghi audit_logs, test/evidence.http.test.ts
- **open-ketoan** (3): test/evidence.test.ts, evidence-seal.test.ts, truy-vet.test.ts

### P15 Menu · màn · khung app (web-shell)
- **open-core** (1): mockup docs/ui/mockup-src/web-shell.html (chờ duyệt); S003-3 ⛔, S003-6 ☐
- **open-cake** (2): apps/web/src/app/Shell.tsx, route.ts, permissions.tsx
- **open-ketoan** (3): apps/web/src/layout/menu.ts, SideNav.tsx, API man-hinh có test — khuôn riêng

### P16 Hook danh sách đóng + registry module, bật theo tenant
- **open-core** (2): core/hooks.ts (1 hook), module-registry.ts — chưa test, open-cake chưa dùng
- **open-cake** (2): bizcity.app.json, bizcity.authz.json, test/authz-manifest.test.ts — chưa hook / bật module
- **open-ketoan** (3): test/module-lifecycle.test.ts, sdk-module-host.test.ts, packages/module-sdk

### P17 Nhiều site: registry, /_sites/v1, migration theo nguồn
- **open-core** (3): db/migrate.ts (source, coveredBy), test/migrate.test.mjs 8 ca, open-cake dùng (migration: mức 4) — route /_sites/v1 còn ở app (mức 2)
- **open-cake** (2): dùng migrate / site của lõi, chưa cấp site
- **open-ketoan** (3): modules/sites/provisioning.routes.ts, test/site-provisioner.test.ts, site-migrate.test.ts

### P18 API: defineAction → REST + MCP, Idempotency-Key, danh mục lỗi
- **open-core** (3): core/actions.ts, errors.ts, http.ts — test/actions-runtime.test.mjs chạy thật (quyền, khuôn input, Idempotency-Key, bằng chứng, huỷ giao dịch, chạy thử); open-cake chỉ dùng errors / http
- **open-cake** (3): runtime.ts riêng (spec → REST, action_requests), packages/action-client test — chưa MCP
- **open-ketoan** (3): test/actions.test.ts, action-meta.test.ts, mcp.test.ts

### P19 Bốn bước kết nối open-hub (bizcity_hub_setup@1)
- **open-core** (1): chuẩn HUB-SETUP 0.1; chưa @bizcity/server, chưa /api/v1/setup/*
- **open-cake** (2): apps/web/src/screens/channel-setup/SetupSteps.tsx (4 bước Zalo) — chưa API chuẩn
- **open-ketoan** (1): chỉ thiết kế (CELL-CONNECT)

### P20 Hệ thiết kế giao diện: token, ui-kit, bốn trạng thái, i18n
- **open-core** (1): bizcity_ux@1 0.1 + mockup chờ duyệt; chưa gói ui-kit
- **open-cake** (3): packages/ui-kit/src/tokens.css, i18n/vi/*, test/i18n.test.ts, sc-cake-web.test.ts
- **open-ketoan** (2): packages/ui-kit/src/{grid,steps,doc-sheet}.tsx — chưa i18n

## Mười khoảng trống lớn nhất (theo tác động ERP)

1. Mã chạy của lõi chưa có test ở open-core (actions, events, documents, workflow, settings, secrets, hooks) — chỉ được kiểm ở bản chép của open-ketoan ⇒ phát hành lõi có thể gãy âm thầm
2. open-cake chưa dùng runtime action / sự kiện / chứng từ của lõi (runtime.ts, outbox channel_commands, 3 setInterval riêng) ⇒ chuỗi cake → POS → kế toán chưa có đường chung
3. Chưa có khung changefeed ở lõi (registerSyncFeed) — /api/v1/sync chỉ ở open-ketoan
4. Danh sách chung (defineListAction, ListScreen, xuất CSV / XLSX / JSON) chưa có ở đâu theo bizcity_list@1
5. Chưa có web-shell / registry menu / màn ở lõi — khung và ui-kit của open-ketoan và open-cake đã tách nhau
6. Màn × thao tác chỉ có ở open-ketoan
7. Bốn bước kết nối open-hub chưa có API ở đâu
8. Lớp mềm (user_meta …) và Storage chỉ ở open-cake, chưa vào migration lõi
9. Nhập chung chỉ ở danh mục open-ketoan; chatter chưa có ở đâu
10. Hạ tầng chéo chưa đủ: đệm chung, API việc nền / lịch, thang phạm vi cài đặt cứng accounting_unit, /_sites/v1 còn ở app
