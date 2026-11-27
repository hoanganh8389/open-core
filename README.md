# open-core — lõi chạy của Bizcity Open

<!-- [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] C1 — chủ chốt Q-CORE-1…7 (bizcity-platform NC-003): repo mã lõi riêng, mọi gói @bizcity/* chung một số phiên bản. -->

> **Trạng thái:** 🟡 **C2 — mã đã dời** (2026-11-27): `@bizcity/platform` và `@bizcity/contracts` chuyển từ [bizcity-platform](https://github.com/hoanganh8389/bizcity-platform) sang đây bằng `git subtree` (giữ lịch sử), **0.3.0** = nội dung HEAD của bizcity-platform, không đổi hành vi. Schema chuẩn máy đọc ở lại open-platform. Bước kế: C3 gom bản nền mới của open-ketoan. Kế hoạch: [NC-003](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-003-TACH-OPEN-CORE.md). <!-- [2026-11-27 11:31 PM Johnny Chu - Chu Hoàng Anh] C2 -->

**open-core là "WordPress core" của Bizcity Open viết bằng TypeScript.** Mỗi app nghiệp vụ = open-core + module: open-cake (+crm, +catalog), open-ketoan (+ketoan), open-pos, open-hrm, open-mrp…

## Ba vai nền (canon R-CANON-17)

| Vai | Repo | Giữ |
|---|---|---|
| open-platform (luật) | [bizcity-platform](https://github.com/hoanganh8389/bizcity-platform) | chuẩn `BIZCITY-*`, schema hợp đồng nền, bộ kiểm |
| **open-core (lõi)** | **repo này** | mã lõi `@bizcity/*`, migration lõi, bản phát hành |
| open-setup (cấp instance) | [bizcity-open-setup](https://github.com/hoanganh8389/bizcity-open-setup) | registry Workspace × app, ghi `core_version` |

Luật cấp hệ: [canon open-hub §2.2](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md).

## Gói (đích)

| Gói | Chứa | Từ bước |
|---|---|---|
| `@bizcity/platform` | kernel: Workspace / Instance / Tenant, Identity + Authz, Settings, Meta + Records, Storage, Cache, khung Documents, Secrets, Event / Outbox, Audit, Migration, Database Router, log / metric / trace | C2 (từ bizcity-platform), C3 (bản mới của open-ketoan), C5 (từ open-cake) |
| `@bizcity/contracts` | hợp đồng nền: phong bì API, mã lỗi chung, khuôn sự kiện, bằng chứng, authz, settings, module, MCP | C2, tách phần kế toán ở C4 |
| `@bizcity/server` | Fastify: site theo `Host`, `ctx`, nạp module, action → REST + MCP, `/_sites/v1` khung | C5 |
| `@bizcity/web-shell` · `ui-kit` · `action-client` | giao diện khung, thành phần chung, `useAction` | C5 |
| `@bizcity/module-sdk` · `cli` | `defineModule`, manifest; `bizcity site …`, `create-app` | C5, C8 |

## Phiên bản

- **Một số chung** cho mọi gói (`open-core 0.3.0` = `@bizcity/platform@0.3.0` = `@bizcity/contracts@0.3.0`…), nối tiếp dòng 0.2.0 của bizcity-platform; **1.0** ở bước C8. Kiểm: `pnpm test` (`tools/kiem-khung.mjs`).
- Phát hành: tag `vX.Y.Z` ⇒ tệp `.tgz` đính kèm GitHub Release (Q-CORE-7); app cài bằng URL.
- App ghim `^MAJOR.MINOR`; module khai `requires: { "open-core": "^1.0" }`.

## Cài

```json
"@bizcity/contracts": "https://github.com/hoanganh8389/open-core/releases/download/v0.3.0/bizcity-contracts-0.3.0.tgz",
"@bizcity/platform":  "https://github.com/hoanganh8389/open-core/releases/download/v0.3.0/bizcity-platform-0.3.0.tgz"
```

Test (Postgres 16 thật, `bizcity-platform` cạnh repo cho `users-check`): `TEST_DATABASE_URL=postgres://… pnpm test`. Đóng gói: `pnpm run build && node tools/dong-goi.mjs 0.3.0`.

## Giấy phép

GPL-2.0-or-later ([LICENSE](LICENSE)). Nhãn hiệu BizCity: [TRADEMARK.md](TRADEMARK.md).
