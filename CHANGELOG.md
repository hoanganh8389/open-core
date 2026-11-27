# Changelog

## [Chưa phát hành]

## [0.3.0] — 2026-11-27

### Thêm
- **C2 dời mã** (<!-- [2026-11-27 11:31 PM Johnny Chu - Chu Hoàng Anh] C2 -->): `packages/platform` (219 commit) và `packages/contracts` (138 commit) từ bizcity-platform bằng `git subtree`, giữ lịch sử; cả hai lên **0.3.0** (một số, R-CORE-1); `@bizcity/contracts` dùng `workspace:*`; schema chuẩn (`packages/contracts/schema`) **ở lại** open-platform (không nằm trong gói phát hành); `tools/dong-goi.mjs` + `gom-migration-nen.cjs` dời theo, Release ở repo open-core; CI + release có Postgres 16; test `authz-manifest` đọc `users-check` từ open-platform (`BIZCITY_PLATFORM_DIR`). Test gói 11/11; open-cake 199/199 trên tgz 0.3.0. Nội dung = HEAD bizcity-platform `32cc32c` (gồm `authz-manifest` chưa có ở v0.2.0), không đổi hành vi.
- 2026-11-27 — **C1 khung repo** (<!-- [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] C1 -->): pnpm workspace, `.gitattributes eol=lf`, `tools/kiem-khung.mjs` (R-CORE-1 một số phiên bản, R-PLAT-1 cảnh báo tới C4), CI chạy kiểm khung + bộ kiểm của open-platform, AGENTS (R-PLAT-1…5, R-CORE-1…3). Chưa có gói — dời ở C2, phát hành 0.3.0.
