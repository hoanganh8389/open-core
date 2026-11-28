# Changelog

## [Chưa phát hành]

### Thêm (tài liệu — PHASE-004)
- 2026-11-28 — **PHASE-004 Core độc lập** (<!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — R-CORE-8 (chủ 2026-11-28) -->): R-CORE-8 (Core sở hữu hạ tầng chứng từ, app sở hữu loại chứng từ và nghiệp vụ) ở AGENTS + ARCHITECTURE; năm hạng mục W1–W5 có điều kiện xong đo được; **10 — bản đồ tương thích open-ketoan** (đo: nền riêng 0.1 có 65 tệp, 38 giống / 27 khác / 9 chỉ lõi; 18 tệp khác chỉ là đường import; 0 commit kế toán sửa nền sau mốc tách; gói, API E-1…E-7 / R-1…R-11 / N-1…N-3, migration lõi 0001–0005 ↔ kế toán, cấu hình); **20 — diễn tập nâng cấp trên bản sao CSDL** (bất biến sổ cái L-1…L-8, chứng từ D-1…D-7, lịch sử / quyền H-1…H-5, danh sách trắng, 11 bước có quay lui); **30 — ranh giới Core** (kiểm kê B-1…B-11, cổng `definePort` thay `ctx.ledger`, bộ kiểm ranh giới, thứ tự W2 tới 0.7.0). Sửa: ghi chú `coveredBy` của lõi 0005 trỏ đúng `0187_truc_chung_tu.sql` (open-ketoan đã tới 0186).

## [0.6.0] — 2026-11-28
<!-- [2026-11-28 09:36 PM Johnny Chu - Chu Hoàng Anh] S004-W0 — phát hành 0.6.0: gom S003-20 (tìm chứng từ) + S003-4 (defineListAction). Số phiên bản: thêm API, không đổi API đã phát hành 0.5.0. -->

> **Lưu ý khi nâng từ 0.5.0:** `core.document.list` trả hàng theo **tên cột** (`doc_no`, `total_fc`…) và `sums` theo tên cột — kiểu này chưa có app nào dùng ở 0.5.0 (open-cake chỉ dùng `documentSpine.mirror`). Không có migration mới (lõi vẫn 0001–0005).

### Thêm (S003-4 — defineListAction)
- 2026-11-28 — **`defineListAction`** (<!-- [2026-11-28 09:15 PM Johnny Chu - Chu Hoàng Anh] S003-4 -->, `bizcity_list@1`): `core/list.ts` — khai một danh sách (nguồn + cột + quyền xem / xuất + phạm vi vai) ⇒ lõi sinh **action danh sách** (`<id>`, GET, MCP chỉ đọc) và **action xuất** (`<module>.<thực thể>.export`, quyền xuất riêng, ghi bằng chứng gồm số dòng + băm bộ lọc, không mở cho AI): `q` · `f.<cột>.<phép>` · `sort` ≤ 3 khoá · con trỏ keyset gắn chữ ký sắp xếp · `count` · `sums` (có `sumOnlyWith`) · phạm vi vai giao với bộ lọc · **che cột theo quyền xem cột** (R-STD-LIST-11: thiếu quyền ⇒ che, không bỏ cột, `meta.masked`). Xuất **csv** (BOM, nhãn cột, số thuần, thoát dấu phẩy / nháy kép), **json** (`bizcity_list_export@1` có bộ lọc + cột + tổng) và **ndjson** (dòng đầu là header); ≤ 10 000 dòng, lớn hơn ⇒ `NOT_READY` nêu cách xử lý (xuất nền: S003-11; xlsx: cần quyết định thư viện). `listDefJson` sinh ListDef JSON hợp lệ theo schema của bizcity-platform; `validateListDef` chặn khai sai lúc khai (định danh SQL, cột trùng, defaultSort). **Cột là định danh do mã khai — không bao giờ lấy từ người dùng.**
- **Đổi:** `core.document.list` nay là một `defineListAction` (cùng hành vi, thêm `core.document.export`); hàng trả về theo **tên cột** (`doc_no`, `total_fc`…) thay vì camelCase; `sums` theo tên cột (`total`, `total_fc`). Test 57 / 57 có CSDL; open-cake chạy thật 199 / 199 trên lõi này.

### Thêm (S003-20 — tìm chứng từ chuẩn hoá)
- 2026-11-28 — **`core.document.list`** (<!-- [2026-11-28 08:48 PM Johnny Chu - Chu Hoàng Anh] S003-20 -->, NC-006 §3, R-DOCX-6): `core/list-query.ts` (tham số URL ⇄ ListQuery của `bizcity_list@1`, chạy cùng vector với bizcity-platform), `core/document-search.ts` — `documentSearch.list` trên trục chứng từ: `q`, `f.<cột>.<phép>` (16 cột, phép khai theo cột), `sort` tới 3 khoá, con trỏ keyset gắn chữ ký sắp xếp (đổi cách sắp xếp mà giữ con trỏ cũ ⇒ báo rõ), `count=exact`, `sums` (tính theo tiền hạch toán; nguyên tệ khi lọc một tiền tệ); mặc định ẩn chứng từ lưu trữ; phạm vi vai (đơn vị / module) giao với bộ lọc, không mở rộng được. `documentListAction` (GET /api/v1/documents, MCP chỉ đọc) — app đưa vào `mountActions`. Chứng từ của mọi app ghi qua document-spine (quản lý hoặc phản chiếu) có mặt ở đây — palette ⌘K, danh sách chéo module. Test 6 ca. `pnpm test` có CSDL 51 / 51.

## [0.5.0] — 2026-11-28
<!-- [2026-11-28 08:18 PM Johnny Chu - Chu Hoàng Anh] S003-14b — phát hành 0.5.0: trục chứng từ (quản lý + phản chiếu), đa tiền tệ, test runtime lõi -->

### Thêm (S003-14b — loại chứng từ phản chiếu)
- 2026-11-28 — `defineDocumentType` khai **đúng một** cách ghi: `workflow` (lõi cấp số, giữ trạng thái — `create` / `update` / `transition`) hoặc `mirror: { statuses }` (app giữ bảng nguồn + trạng thái, vd yêu cầu đặt hàng của open-cake do cửa hàng báo trạng thái). `documentSpine.mirror()` thêm / cập nhật đầu phiếu `<type>:<key>`, đổi trạng thái ⇒ hoạt động `transition`; gọi lặp không ghi thêm. Loại chứng từ nhận gạch dưới ở phần loại (khớp doc_ref spine 1.2: `cake.order_request`). Test 7 ca.

### Thêm (S003-14, S003-19 — trục chứng từ + đa tiền tệ)
- 2026-11-28 — **Trục chứng từ chung** (<!-- [2026-11-28 08:12 PM Johnny Chu - Chu Hoàng Anh] S003-14 -->, NC-007 §3): migration lõi `0005_platform_truc_chung_tu.sql` (đầu phiếu thêm `currency`, `fx_rate`, `total_fc`, `org_unit_code`, `archived_at`; bảng `document_activities` chỉ thêm + RLS; `doc_type` nhận gạch nối); `core/document-spine.ts` — `defineDocumentType` (loại + dãy số + workflow YAML + khoá meta zod), `create` / `get` / `update` (chỉ nháp) / `transition` (workflow.plan) / `note` / `archive` (chỉ khi đã kết thúc, cần lý do) / `restore` / `activities`; `ctx.documents.*` trong action (chỉ loại của module mình). Không chạy 0005 trên CSDL open-ketoan lúc này (`CORE_COVERED_BY_KETOAN`, PHASE-001 R-4): `business_documents` của open-ketoan sinh ở 0156.
- 2026-11-28 — **Đa tiền tệ** (S003-19, Q-ERP-1, NC-007 §8): contracts `CURRENCY_RE`, `BASE_CURRENCY`, `Money`, `currencyDigits`, `roundCurrency`, `toBaseAmount` (theo quy ước R-MONEY: số tiền là number); `resolveMoney` — cùng tiền ⇒ tỷ giá 1; ngoại tệ cần tỷ giá + nguyên tệ, tổng tiền hạch toán do máy chủ tính; đóng băng khi rời nháp.
- `tools/ma-tran-app.mjs`: vitest dừng trước dòng tổng thì in đuôi lỗi thay vì NaN.
- Kiểm: `pnpm test` có CSDL 44 / 44; ma trận `--chay-that` open-cake 199 / 199 trên lõi mới; open-ketoan 7 lỗi kiểu MỚI giống hệt trên main (lệch có sẵn của PHASE-001, không do thay đổi này).

### Thêm (S001-T — test lõi chạy thật)
- 2026-11-28 — **Test runtime lõi trên Postgres** (<!-- [2026-11-28 07:41 PM Johnny Chu - Chu Hoàng Anh] S001-T -->): `test/_csdl.mjs` (CSDL mới mỗi tệp, migration lõi, vai `oc_app` để RLS có hiệu lực), `workflow.test.mjs` (chép từ open-ketoan), `actions-runtime.test.mjs` (quyền, khuôn input, Idempotency-Key gửi lặp / xung đột, bằng chứng thành công + thất bại, huỷ giao dịch, chạy thử, vùng tên sự kiện), `documents-events.test.mjs` (cấp số, phiên bản, DocLink, RLS, outbox → subscriber, thử lại → dead). `pnpm test` có CSDL: 38 / 38.

### Sửa
- 2026-11-28 — **Bộ đếm số chứng từ mặc định ở lõi** (S001-T): `documents.nextNumber` trước đây ném lỗi nếu app chưa `registerDocumentNumberer` (open-cake chưa có) dù bảng `document_sequences` là bảng lõi; nay lõi có `defaultNumberer` (chép cách của open-ketoan Kernel — cùng bảng, cùng khoá), open-ketoan vẫn đăng ký bộ đếm của mình như cũ.

### Thêm (S003-12, S003-13)
- 2026-11-28 — **Scoreboard + kiến trúc + mockup** (<!-- [2026-11-28 06:57 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 S003-13 -->): `docs/scoreboard/scoreboard.json` (20 mục × open-core / open-cake / open-ketoan, mức 0–4 có bằng chứng, 10 khoảng trống lớn) + `tools/scoreboard.mjs` (kiểm + sinh `SCOREBOARD.md` + dữ liệu màn Tình trạng nền tảng; `--check` trong `pnpm test`); `docs/ARCHITECTURE.md`; mockup web-shell 6 khung (`docs/ui/mockup-src/web-shell.html`, ảnh `docs/ui/mockup-shots/`) chờ chủ duyệt. Đo lần đầu: open-core 44 %, open-cake 48 %, open-ketoan 65 %.

### Thêm (tài liệu)
- 2026-11-28 — **PHASE-003 khung quản trị chung** (<!-- [2026-11-28 06:33 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 -->): người dùng + `user_meta`, vai / màn × thao tác, menu, hook danh sách đóng, danh sách / lọc / xuất theo `bizcity_list@1`, web-shell; việc S003-1…8.

## [0.4.0] — 2026-11-28

<!-- [2026-11-28 05:45 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-5 -->
**Lõi sẵn sàng cho open-ketoan chuyển sang (PHASE-001 phía open-core xong) + định danh chung trên dây (PHASE-002).** Không phá API của 0.3.x: tên export giữ nguyên; migration lõi không thêm tệp mới.

### Thêm (S001-5)
- Ma trận app: làn **chạy thật** `--chay-that` — đóng lõi thành tgz, cài vào bản tạm của open-cake, chạy đủ test trên Postgres (`CAKE_TEST_DATABASE_URL`); báo số qua / hỏng / bỏ qua. 0.4.0: open-cake **199 / 199**, 0 bỏ qua; open-ketoan khớp tên 646 / 646, không lỗi kiểu mới ngoài 7 lỗi đã biết (PHASE-001 §1.1, sửa phía app ở S001-6).

### Thêm (S002-1)
- 2026-11-28 — **`tools/kiem-luoc-do.mjs`** (<!-- [2026-11-28 05:34 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 S002-1 -->): dựng CSDL chỉ có migration lõi và CSDL của app (open-ketoan: dãy riêng + `ketoanLegacyHooks`), so **cột · ràng buộc · trigger · RLS** của mọi bảng lõi; khác biệt có chủ ý ghi kèm lý do (`DA_BIET`), khác lạ ⇒ KHÔNG ĐẠT. Lần đầu: 28 bảng, 547 mục, 12 khác có chủ ý (ràng buộc vai kế toán, khoá ngoại / trigger kế toán), **0 khác lạ** — bốn bảng chứng từ, `document_sequences`, `document_signatures`, `mcp_confirm_tokens`, `event_outbox` đã có trong `0001` lõi và khớp từng cột với open-ketoan.

### Thêm (S002-2)
- 2026-11-28 — **`@bizcity/contracts` spine.ts** (<!-- [2026-11-28 05:25 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 S002-2 -->): zod cho định danh chung trên dây theo spine 1.2 — `tenantSchema`, `siteSchema`, `blogRefSchema`, `subSchema`, `ulidSchema`, `uomSchema`, `branchCodeSchema`, `partnerCodeSchema`, `spineDocRefSchema` (`SPINE_DOC_REF_RE`), `qtySchema`, `ratioSchema`, `itemRefSchema`, `partnerRefSchema`, `contactRefSchema`, `branchRefSchema`, `uomRefSchema`, `qtyLineSchema`, `docLinkSchema`, `envelopeSchema`, `qtyMatchesUnits` (số nguyên, không số thực). Test chạy **vector của open-platform** (`refs.vectors.json`): mọi ca hợp lệ / sai khớp; thêm trục ở spine mà chưa có zod ⇒ test đỏ. `DOC_REF_RE` (khuôn lưu, CHECK 0045 open-ketoan) giữ nguyên — khuôn trên dây là tập con.

### Thêm (tài liệu)
- 2026-11-28 — **PHASE-002 dòng dữ liệu xuyên app** (<!-- [2026-11-28 05:18 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 -->): ba lớp liền mạch (hình giống nhau · định danh chung · đường chuyển có hợp đồng), sáu thiếu sót G-1…G-6 và phương án, Q-DD-1…4, việc S002-1…7.

### Thêm (S001-4)
- 2026-11-28 — **`schema_migrations.source`** (<!-- [2026-11-28 05:17 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-4 -->): trình chạy tự thêm cột `source` (mặc định `app`, dòng cũ giữ `app`) và `module` (trước chỉ open-ketoan có, từ 0053) — chạy lại vô hại; mỗi dòng mới ghi đúng nguồn (`platform` / `app` / `mod_<key>`), kể cả dòng ghi nhận bằng `coveredBy`. Khoá chính giữ `name` (planMigrations đã chặn trùng tên giữa các nguồn). Thử lại 183 migration open-ketoan: cài mới / nâng cấp như S001-3.

### Thêm (S001-3)
- 2026-11-28 — **hook `coveredBy`** (<!-- [2026-11-28 05:11 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-3 -->): migration của nguồn khác mà app đã có sẵn nội dung ⇒ ghi nhận, không chạy (trình chạy + `pendingMigrations`); `ketoanLegacyHooks` khai `CORE_COVERED_BY_KETOAN` (lõi 0001 / 0002 ⇐ dãy gốc open-ketoan, 0003 ⇐ 0183, 0004 ⇐ 0184). Thử thật với 183 migration của open-ketoan trên Postgres 16: cài mới — 183 tệp chạy, 4 tệp lõi ghi nhận, pending 0; nâng cấp — bản cũ 139 bảng, bật lõi chạy thêm 0 tệp, vẫn 139 bảng.

### Thêm (S001-2)
- 2026-11-28 — **`appRoot()` / PlatformConfig** (<!-- [2026-11-28 05:03 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-2 -->): `core/app-root.ts` — gốc app theo thứ tự `BIZCITY_APP_ROOT` → gói trong repo app (cách cũ) → gói trong `node_modules` thì đi lên tới `bizcity.app.json`; năm chỗ tính "lùi N cấp" (`db/paths.ts`, `core/settings.ts`, `core/version.ts`, `core/libraries/{index,context}.ts`) dùng chung; `CONTROL_MIGRATIONS_DIR` ghi đè được bằng biến môi trường. Tên export giữ nguyên (R-CORE-2). Test 5 ca (repo, npm, pnpm, Docker, biến môi trường). Ma trận: open-ketoan không lỗi mới (vẫn 7 lỗi §1.1), open-cake 0; **chạy thật**: tgz cài vào bản tạm của open-cake ⇒ `appRoot` đúng gốc open-cake, 199 / 199 test.

### Thêm
- 2026-11-28 — **S001-1 ma trận app** (<!-- [2026-11-28 04:52 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-1 -->): `pnpm run ma-tran` (`tools/ma-tran-app.mjs`) — chép open-ketoan / open-cake vào thư mục tạm, đo khớp tên (import ↔ export lõi) và khớp kiểu (`tsc` trên lõi đang sửa so với mốc), báo lỗi MỚI; `--strict` chặn khi có lỗi mới. Lần đầu: open-ketoan 646 / 646 tên, 7 lỗi kiểu mới (PHASE-001 §1.1); open-cake 65 / 65, 0 lỗi mới.
- 2026-11-28 — **PHASE-001 open-ketoan chạy trên open-core** (tài liệu; <!-- [2026-11-28 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 -->): đo khớp tên 646 / 646 import, khớp kiểu 7 lỗi mới (đều do P2b), 11 vấn đề lúc chạy R-1…R-11, phương án B (lớp chuyển tiếp trước), việc S001-1…9.

## [0.3.1] — 2026-11-28

### Thêm (C3 — gom bản nền mới của open-ketoan)
- <!-- [2026-11-28 12:18 AM Johnny Chu - Chu Hoàng Anh] C3 --> Gộp ba chiều (gốc = open-ketoan `6ad77b6`, ta = open-core 0.3.0, họ = open-ketoan `dev` `4e5cbc8`): **platform.secrets** (`core/secrets.ts`, `ctx.secrets`, quyền `secrets:read:<module>`, migration lõi **0004** `tenant_secret_keys` + `tenant_secrets`, bỏ GRANT vai `ketoan_app`), **`users.external_sub`** (migration lõi **0003**), `config/env.ts`, `core/apps.ts`, `security/tool-password.ts`, `core/actions.ts` + `db/types.ts` gộp tự động, `core/auth.ts` gỡ tay, contracts `errors.ts` (`KHO_STOCK_SHORT`, `SECRETS_*`). Test gói 11/11; open-cake 199/199 trên tgz 0.3.1.

## [0.3.0] — 2026-11-27

### Thêm
- **C2 dời mã** (<!-- [2026-11-27 11:31 PM Johnny Chu - Chu Hoàng Anh] C2 -->): `packages/platform` (219 commit) và `packages/contracts` (138 commit) từ bizcity-platform bằng `git subtree`, giữ lịch sử; cả hai lên **0.3.0** (một số, R-CORE-1); `@bizcity/contracts` dùng `workspace:*`; schema chuẩn (`packages/contracts/schema`) **ở lại** open-platform (không nằm trong gói phát hành); `tools/dong-goi.mjs` + `gom-migration-nen.cjs` dời theo, Release ở repo open-core; CI + release có Postgres 16; test `authz-manifest` đọc `users-check` từ open-platform (`BIZCITY_PLATFORM_DIR`). Test gói 11/11; open-cake 199/199 trên tgz 0.3.0. Nội dung = HEAD bizcity-platform `32cc32c` (gồm `authz-manifest` chưa có ở v0.2.0), không đổi hành vi.
- 2026-11-27 — **C1 khung repo** (<!-- [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] C1 -->): pnpm workspace, `.gitattributes eol=lf`, `tools/kiem-khung.mjs` (R-CORE-1 một số phiên bản, R-PLAT-1 cảnh báo tới C4), CI chạy kiểm khung + bộ kiểm của open-platform, AGENTS (R-PLAT-1…5, R-CORE-1…3). Chưa có gói — dời ở C2, phát hành 0.3.0.
