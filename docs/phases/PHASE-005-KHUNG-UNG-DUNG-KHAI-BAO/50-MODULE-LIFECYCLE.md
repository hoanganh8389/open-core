# PHASE-005 · 50 — Module Lifecycle Framework

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — vòng đời module và cơ chế quản lý; đặc tả cho lane R làm ở S004-W3 (server, module-sdk, cli). -->

> **Ai làm:** đặc tả này là của lane T. Mã thuộc **lane R** (S004-W3-1 `@bizcity/server`, S004-W3-2 `@bizcity/module-sdk`) + việc mới `S005-ML-*` (CHECKLIST). Đổi đặc tả ⇒ hai lane cùng duyệt (LANES §6).

## 1. Đã có

| Thành phần | Nơi | Làm gì |
|---|---|---|
| manifest `bizcity.module.json` (`bizcity_module@1`) | chuẩn ở bizcity-platform | khoá, phiên bản, năng lực cần, actions |
| `defineModule({ manifest, actions, subscribers, hooks })` | open-ketoan `packages/module-sdk` | kiểm tiền tố / khai báo lúc nạp |
| `module_registry` + `hashModuleDir` + `decideLoad` | lõi `core/module-registry.ts` | bản cài: nạp module `active` có hash khớp; lệch thì bỏ riêng module đó |
| `tenant_modules` + `moduleGate` | lõi | tenant: tắt module ⇒ route trả `MODULE_DISABLED`, sự kiện `skipped` |
| migration theo nguồn (`sources`, `schema_migrations.source`) | lõi `db/migrate.ts` | mỗi module một dãy migration |

**Còn thiếu:**
- các bước của vòng đời (cài / nâng / gỡ) chưa có hook;
- chưa có phụ thuộc giữa module;
- `defineModule` chưa nhận entity / screen / menu / quyền / cài đặt;
- chưa có lệnh CLI thống nhất.

## 2. Vòng đời

```text
            install                enable(tenant)
 declared ───────────► installed ─────────────────► enabled ◄──┐
    ▲                    │   ▲                        │        │ upgrade (bản mới, migration chạy, onUpgrade)
    │ uninstall          │   │ disable(tenant)        │        │
    └────────────────────┘   └────────────────────────┘ ───────┘
                (dữ liệu giữ; gỡ hẳn = xuất + purge có xác nhận)
```

| Trạng thái | Mức | Ghi ở | Ai đổi |
|---|---|---|---|
| `declared` | mã | `defineModule` trong mã đã dựng (không có nạp từ ngoài, ADR-0011 D3) | developer |
| `installed` | bản cài | `module_registry` (+ hash, phiên bản, migration đã áp) | `cli module install` / job cài đặt |
| `enabled` | tenant | `tenant_modules` (không có dòng = bật) | quản trị tenant, màn Cài đặt › Phân hệ |
| `disabled` | tenant | `tenant_modules` | như trên; dữ liệu giữ nguyên, route / menu / MCP / màn ẩn |

## 3. `defineModule` mở rộng

```ts
export default defineModule({
  manifest,                                        // bizcity.module.json
  requires: { core: '^0.8', modules: { masterdata: '^1' } },   // §4
  entities: [Item, ItemClass],                     // defineEntity / extendEntity
  screens: [ItemScreen],                           // defineScreen
  actions: [...], subscribers: [...], hooks: [...], jobs: [...],
  settings: [registerSetting('cake.item.default_uom', …)],
  permissions: ['catalog:read', 'catalog:write'],  // khai một lần ⇒ authz manifest + màn Vai quyền
  migrations: new URL('./migrations', import.meta.url),
  seed: { demo: './seed/demo.json' },              // chỉ nạp vào tenant mẫu / trắng (R-SETUP)
  lifecycle: {
    onInstall:  async (ctx) => {},                 // một lần mỗi bản cài, sau migration
    onUpgrade:  async (ctx, { from, to }) => {},   // sau migration của bản mới; idempotent
    onEnable:   async (ctx, tenantId) => {},       // tạo dữ liệu mặc định cho tenant
    onDisable:  async (ctx, tenantId) => {},       // không xoá dữ liệu
    health:     async (ctx) => ({ ok: true }),     // vào /ready + màn Tình trạng nền tảng
  },
});
```

**Luật kiểm lúc nạp** (SC-MOD-*, mở rộng STD-MOD của `bizcity_module@1`):
- Mọi `entity`, `screen`, `action`, `setting`, `permission` có tiền tố khoá module.
- `requires.core` khớp bản lõi đang chạy; lệch ⇒ module không nạp, `doctor` đỏ.
- `requires.modules` đủ và đã bật; vòng phụ thuộc ⇒ lỗi.
- Hook vòng đời phải idempotent. Test mẫu ở `@bizcity/testing` chạy mỗi hook hai lần.

## 4. Phụ thuộc giữa module

- Khai theo **khoá module + khoảng semver**, không theo gói npm.
- Tắt module A khi B đang bật mà cần A ⇒ chặn, nêu B.
- Thứ tự cài / nâng: theo đồ thị phụ thuộc. Migration theo nguồn, mỗi module một dãy (R-CORE-3).
- Module chỉ phụ thuộc **khoá thực thể / cổng / sự kiện**, không import mã của module khác (R-PLAT-1 mở rộng cho module).

## 5. Lệnh (CLI, lane R)

| Lệnh | Làm |
|---|---|
| `bizcity scaffold module <key>` | khung module: manifest, `defineModule`, migration rỗng, test mẫu |
| `bizcity scaffold entity <module>.<thực thể>` | `defineEntity` + `defineScreen` + test SC-ENT ([40](40-VIEW-FRAMEWORK.md) §5) |
| `bizcity module install / upgrade / list` | ghi `module_registry`, chạy migration + `onInstall` / `onUpgrade` |
| `bizcity module enable / disable <key> --tenant` | `tenant_modules` + `onEnable` / `onDisable` |
| `bizcity doctor` | kiểm phụ thuộc, hash, lược đồ ↔ registry, conformance SC-ENT / SC-MOD, health |
| `bizcity upgrade core <bản>` | đổi bản lõi đã ghim + chạy codemod `tools/doi-nguon` của bản đó (LANES §7.2) |
| `bizcity scoreboard dx` | đo Scoreboard DX của app ([60](60-SCOREBOARD-DX.md)) |

## 6. Màn quản lý

Cài đặt hệ thống › **Phân hệ**: danh sách module là một `defineScreen` của chính lõi, trên thực thể `core.module`.
- Mỗi module hiện phiên bản, trạng thái, phụ thuộc, health.
- Bật / tắt theo tenant là action (`core.module.enable`), có nhật ký.
- Màn này nằm cạnh "Tình trạng nền tảng" (f5).
