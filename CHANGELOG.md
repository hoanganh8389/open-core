# Changelog

## [Chưa phát hành]

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
