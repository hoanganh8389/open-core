# PHASE-005 · 10 — Gói và lớp: 14 gói hay ít hơn?

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — đánh giá cây 14 gói chủ đề xuất theo tiêu chí lean. -->

## 1. Khi nào một thứ là một gói npm riêng

Tách gói chỉ khi có ít nhất một lý do dưới đây. Tách vì "cho gọn" thì **không** đủ: mỗi gói là thêm một `package.json`, một vòng phát hành, một ma trận phụ thuộc.

| # | Lý do | Ví dụ |
|---|---|---|
| G-1 | **Khác môi trường chạy** (trình duyệt / Node / cả hai) | `ui-kit`, `web-shell` chạy trình duyệt; `platform` chạy Node |
| G-2 | **Khác người dùng**: có app cần cái này mà không được kéo theo cái kia | `action-client` dùng cả ở POS / cell / mobile mà không cần Fastify |
| G-3 | **Chỉ dùng lúc phát triển** (devDependency) | `testing`, `cli` |
| G-4 | **API ổn định cho tác giả module**, che phần ruột hay đổi | `module-sdk` |

**Không phải lý do để tách:**
- "Năng lực bật theo nhu cầu". Bật / tắt là việc của **module** (manifest + migration theo nguồn + `tenant_modules`), không phải việc của gói npm.
- Phân lớp L2 / L3. Lớp được giữ bằng **đường con + bộ kiểm ranh giới** (`kiem-khung`, `kiem-ranh-gioi`), không bằng ranh giới gói.

Ví dụ: `@bizcity/platform/master-data` không được import `@bizcity/platform/documents`. Luật đó viết trong bộ kiểm giống R-PLAT-1.

## 2. Đánh giá 14 gói

| Gói (sơ đồ) | Lý do tách | Đề xuất | Hiện trạng |
|---|---|---|---|
| `contracts` | G-1 (cả hai môi trường), G-2 | **gói** | có, 0.6.0 |
| `platform` | — (lõi Node) | **gói** — L1 + L2 | có, 0.6.0 |
| `entity` | không — cùng runtime, mọi gói khác đều cần, chung giao dịch | **đường con** `@bizcity/platform/entity` | chưa có ([20](20-ENTITY-REGISTRY.md)) |
| `master-data` | không — cần giao dịch / RLS / action của platform | **đường con** `@bizcity/platform/master-data` | có một phần (`core/master-data`, 0007) |
| `documents` | không — như trên | **đường con** `@bizcity/platform/documents` | có (`core/document-spine`, `documents`) |
| `sync` | không — như trên | **đường con** `@bizcity/platform/sync` | chưa có (NC-008 W4 / PHASE-004 W5) |
| `server` | G-2: worker / CLI không cần Fastify | **gói** | chưa có (S004-W3-1, lane R) |
| `module-sdk` | G-4 | **gói** | có ở open-ketoan (S004-W3-2, lane R) |
| `web-shell` | G-1 | **gói** | chưa có (S003-6) |
| `ui-kit` | G-1, G-2: app nhúng / app ngoài tiến trình dùng ui-kit mà không cần shell | **gói** | có ở open-ketoan (`packages/ui-kit`), chuẩn EXTENSION §3b |
| `action-client` | G-1, G-2 | **gói** (nhỏ, sinh kiểu từ registry action) | chưa có |
| `reporting` | chưa có app thứ hai cần | **hoãn** — báo cáo trước mắt là một loại màn (`view: "report"`) trên `defineListAction` + `aggregate` | — |
| `testing` | G-3 | **gói** dev | `test/_csdl.mjs` trong platform |
| `cli` | G-3 | **gói** dev | có ở open-ketoan (`packages/cli`) |

**Kết quả:** 10 gói phát hành + 4 đường con. Đường con được giữ nguyên tên export. Nếu sau này một đường con đủ điều kiện G-1…G-4 thì tách ra thành gói, đường cũ thành tệp chuyển tiếp (R-CORE-2). App không phải sửa ngay.

```text
open-core/packages/
├── contracts/        @bizcity/contracts        kiểu + schema + vector (Node + trình duyệt)
├── platform/         @bizcity/platform         L1 + L2 + L3 (đường con dưới)
│     src/core/*            hạ tầng, action, authz, workflow, event, settings, ports
│     src/entity/*          Entity Registry (mới)          ── PHASE-005 F1
│     src/master-data/*     trụ Danh mục (dời từ core/master-data)
│     src/documents/*       trụ Chứng từ (dời từ core/document-spine, documents)
│     src/sync/*            trụ Đồng bộ (mới)
│     src/ketoan-legacy/*   khu cách ly — lane R, xoá ở 0.8
├── server/           @bizcity/server           createServer (lane R, W3-1)
├── module-sdk/       @bizcity/module-sdk       defineModule + re-export API ổn định (lane R, W3-2)
├── action-client/    @bizcity/action-client    gọi action có kiểu, sinh từ registry
├── ui-kit/           @bizcity/ui-kit           thành phần, token (bizcity_ux@1)
├── web-shell/        @bizcity/web-shell        khung app + bộ vẽ màn từ defineScreen
├── testing/          @bizcity/testing          CSDL thử, dựng module mẫu, vector conformance (dev)
└── cli/              @bizcity/cli              scaffold, module add / upgrade, doctor, scoreboard (dev)
```

## 3. Luật phụ thuộc giữa gói và đường con

Chiều mũi tên là chiều được phép import. Ngược chiều ⇒ `kiem-khung` chặn.

```text
contracts ◄─ platform/core ◄─ platform/entity ◄─ platform/{master-data, documents, sync}
                  ▲                                         ▲
                server ──────────────────────────────────────┘
module-sdk ──► (re-export từ platform + server)
ui-kit ◄─ web-shell ◄─ action-client ◄─ contracts
testing, cli ──► mọi gói (chỉ lúc phát triển)
```

- Ba trụ (`master-data`, `documents`, `sync`) **không import lẫn nhau**. Chúng nối qua `entity` (registry) và `core/events`.
- `web-shell` không import `platform`. Nó chỉ đọc metadata qua HTTP (`/api/v1/meta/*`) và gọi action qua `action-client`.
- Dời `core/master-data.ts` sang `src/master-data/`: giữ `core/master-data` làm tệp chuyển tiếp một bản phát hành (R-CORE-2). Việc này làm cùng lần lane R cắt 0.7.0, không tự làm lẻ.
