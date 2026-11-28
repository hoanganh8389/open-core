# Changelog

## [Chưa phát hành]

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
