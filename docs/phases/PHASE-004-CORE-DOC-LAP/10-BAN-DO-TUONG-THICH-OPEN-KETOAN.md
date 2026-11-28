# PHASE-004 · 10 — Bản đồ tương thích: open-ketoan (nền riêng 0.1) → open-core release
<!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 W1-a — chủ: "Tài liệu làm trước compatibility mapping và diễn tập nâng cấp trên bản sao CSDL để bảo toàn sổ cái, chứng từ và lịch sử kế toán." Số liệu đo 2026-11-28: open-core main (sau #21) × open-ketoan dev 0237a4d. -->

> Mục đích: liệt kê **mọi chỗ** open-ketoan đổi khi bỏ `packages/platform` 0.1 riêng để cài `@bizcity/platform` / `@bizcity/contracts` từ release open-core — gói, tệp, API, CSDL, cấu hình, bộ kiểm — mỗi dòng có **cách xử lý** và **cách kiểm**. Đi cùng [20 — diễn tập](20-DIEN-TAP-NANG-CAP.md). Bước làm (B2–B4) giữ ở [PHASE-001 §3](../PHASE-001-OPEN-KETOAN-TREN-OPEN-CORE/README.md#3-phương-án).

## 1. Gói

| Hiện tại (open-ketoan) | Sau khi chuyển | Ghi chú |
|---|---|---|
| `packages/platform` 0.1.0 (workspace) | `@bizcity/platform` từ release open-core (URL tgz, cùng cách open-cake) | đóng băng ngay lúc đổi nguồn; xoá ở B4 |
| `packages/contracts` 0.1.0 = `@ketoan/contracts` | `@bizcity/contracts` từ release + **alias** `@ketoan/contracts` → `@bizcity/contracts` trong thời gian chuyển (R-6) | phần riêng kế toán của contracts (danh mục hàng VN, thuế…) ở lại gói của kế toán — xem §5 |
| `packages/kernel` 0.1.0 (Accounting Kernel) | **ở lại** open-ketoan | phụ thuộc `@bizcity/platform` release |
| `packages/module-sdk` 1.0.0 | W3: dời sang open-core (`@bizcity/module-sdk`); trong lúc chờ: ở lại, đổi import `@ketoan/contracts` → `@bizcity/contracts` | phần kiểu sổ tách sang cổng sổ của kế toán ([30 §3](30-RANH-GIOI-CORE.md#3-cổng-port-thay-cho-ctxledger)) |
| `packages/cli`, `ui-kit`, `vn-rulepacks` | ở lại (W3 xét phần chung của `cli`, `ui-kit` theo `bizcity_ux@1`) | `vn-rulepacks` là nghiệp vụ VN — luôn ở kế toán |

## 2. Tệp nền (65 → 74)

| Nhóm | Tệp | Lệch | Xử lý phía open-ketoan |
|---|---|---|---|
| **Giống hệt** | 38 tệp | 0 | không làm gì |
| **Chỉ đổi đường import** | `errors.ts`, `http.ts`, `catalog-warn.ts`, `evidence-export.ts`, `quy-tac.ts`, `authz/{index,scope,shadow,store}.ts`, `security/role-assignments.ts`, `libraries/settings.ts`, `masterdata/partner.repository.ts` | 1–2 dòng (`@ketoan/contracts` → `@bizcity/contracts`; `Role` → `../roles.js`) | không làm gì — alias R-6 lo |
| **Gốc thư mục app** (S001-2) | `settings.ts`, `version.ts`, `libraries/{context,index}.ts`, `db/paths.ts`, `db/site-registry.ts` | 2–5 dòng: `appRoot()` thay tính lùi `../../../..` | đặt `bizcity.app.json` ở gốc repo hoặc `BIZCITY_APP_ROOT`; `CONTROL_MIGRATIONS_DIR` ghi đè được (R-2, R-3) |
| **Migration nhiều nguồn** (P2b-1, S001-3, S001-4) | `db/migrate.ts` (+101 −130), `db/module-db.ts` (+5 −1) | đổi chữ ký: `runMigrations(log, { sources, hooks })`, `pendingMigrations(q, opts)`; cột `source` / `module` | tệp chuyển tiếp `apps/api/src/db/migrate.ts` buộc `sources = [lõi, app]` + `ketoanLegacyHooks` (E-1…E-4) |
| **Vai do app đăng ký** (P2b-3) | `auth.ts` (+23 −35), `authz/catalog.ts` (+2 −7), `authz/legacy.ts`, `roles.ts` (mới) | `Role = string`; 6 quyền kế toán (`catalog:*`, `ledger:read`…) rời lõi; `SYSTEM_ROLES` → `systemRoleKeys()` | gọi `ketoanAuthzPreset()` **trước** `buildApp` (R-1 — thiếu là 403 khắp nơi); sửa E-5…E-7 |
| **Trục chứng từ** (0.5) | `documents.ts` (+15 −2: bộ đếm mặc định), `actions.ts` (+24 −1: `ctx.documents.create / transition / …`), `db/types.ts` (+32 −2: cột 0005, `document_activities`), `document-spine.ts`, `document-search.ts`, `list.ts`, `list-query.ts` (mới) | thêm, không đổi hành vi cũ; kế toán vẫn `registerDocumentNumberer` của Kernel (cùng bảng, cùng khoá) | chỉ dùng được sau migration ≥ 0187 (§4) |
| **Chẩn đoán** | `system/diagnostics.ts` (±4) | import + dùng `pool` | không làm gì |
| **Chuyển tiếp — sẽ sang open-ketoan ở B4** | `authz-ketoan-legacy.ts`, `migrate-ketoan-legacy.ts` | chỉ lõi có | kế toán import từ lõi trong thời gian chuyển; B4 dời về `apps/api` và lõi xoá |

## 3. API / hành vi lúc chạy

| Mã | Thay đổi | Ảnh hưởng nếu bỏ sót | Kiểm |
|---|---|---|---|
| E-1…E-4 | `pendingMigrations()` / `runMigrations()` cần `sources` | khởi động / test lỗi kiểu | `ma-tran` 0 lỗi kiểu mới |
| E-5…E-7, R-1 | vai do app đăng ký | **mọi người dùng 403** | test `phan-quyen-*`, `authz-shadow` đạt; diễn tập bước 6 đăng nhập 3 vai |
| R-2, R-3 | `appRoot()` | không thấy migration / seeds / presets / control-migrations | `/ready` báo đủ; `db:migrate --dry` liệt kê đúng |
| R-6 | hai tên một gói contracts | `instanceof AppError` sai, `ErrorCode` lệch | grep `@ketoan/contracts` chỉ còn ở alias |
| R-7 | điều kiện `development` → `src/*.ts` | tsx / vitest biên dịch sai đường | `npm test` + `npm run dev` |
| R-8, R-9 | 33 tệp bộ kiểm / script + Dockerfile trỏ `packages/platform` | selfcheck đỏ, ảnh dựng lỗi | `kiem-chuan.sh` đạt; `docker build` đạt |
| N-1 (mới, 0.5) | `ctx.documents` thêm `create / update / transition / note / archive / restore / activities` | không ảnh hưởng (thêm) | — |
| N-2 (mới, 0.5) | ràng buộc `business_documents.doc_type` nới (cho gạch nối) | không ảnh hưởng (nới) | — |
| N-3 (mới, sau #21) | `core.document.list` hàng theo **tên cột**, có `core.document.export` | kế toán chưa dùng | — |

## 4. CSDL — migration

| Lõi | Bản tương đương ở open-ketoan | Trên CSDL kế toán | Trạng thái |
|---|---|---|---|
| `0001_platform_nen_tang` | `0001_goc_*` … `0067` (26 bảng nền) | ghi nhận, **không chạy** (`coveredBy`) | ✔ |
| `0002_platform_vai_theo_app` | ràng buộc vai của kế toán (`ketoanAuthzPreset`) | ghi nhận | ✔ |
| `0003_platform_external_sub` | `0183_nguoi_dung_external_sub` | ghi nhận | ✔ |
| `0004_platform_secrets` | `0184_tenant_secrets` | ghi nhận | ✔ |
| **`0005_platform_truc_chung_tu`** | **chưa có — kế toán viết `0187_truc_chung_tu.sql`** (nội dung như lõi 0005, chạy sau 0156 nơi `business_documents` sinh ra) | lõi 0005 ghi nhận theo `coveredBy` (giá trị đổi từ "chờ" sang `0187_truc_chung_tu.sql`) | ☐ W1-b |
| `schema_migrations` | thêm cột `source` (mặc định `app`), `module` | nâng tự động, dòng cũ = `app` | ✔ (S001-4) |

Luật: mỗi migration lõi mới phải có quyết định cho CSDL kế toán trong `CORE_COVERED_BY_KETOAN` — test `migrate.test.mjs` chặn nếu thiếu (PHASE-001 R-4).

## 5. Phần kế toán đang nằm trong lõi (W2 dọn trước khi chuyển)

Tóm tắt — đủ ở [30](30-RANH-GIOI-CORE.md): kiểu ≈ 50 bảng kế toán trong `db/types.ts`; `ctx.ledger` + `registerLedgerReader / Submitter / CancelGate`; `masterdata/{default-warehouse,partner.repository,catalog-ensure}.ts`; `classifyLedgerTriggerError`; vai ký `cashier / chief_accountant / director`; thang cài đặt `accounting_unit`; `BOOK_MODE`. **Nguyên tắc:** mã ra khỏi lõi đi thẳng vào open-ketoan (cùng nội dung), nên phía kế toán chỉ đổi đường import — hành vi sổ không đổi.

### 5.1 Đổi nguồn sang lõi 0.7 — codemod <!-- [2026-11-29 12:10 AM Johnny Chu - Chu Hoàng Anh] S004-W2-2 -->

Lõi 0.7 không còn kiểu bảng kế toán trong `Database`; phần chỉ kế toán dùng nằm ở **khu cách ly** `@bizcity/platform/ketoan-legacy/*` (còn phát hành ở 0.7, xoá ở 0.8). Kế toán chạy **một lần** lúc đổi nguồn:

```bash
node <open-core>/tools/doi-nguon/ketoan-0.7.mjs <open-ketoan> --thu   # xem trước: 13 tệp sửa · 3 tệp thêm (đo trên dev 0237a4d)
node <open-core>/tools/doi-nguon/ketoan-0.7.mjs <open-ketoan>
```

| Việc | Ở đâu |
|---|---|
| `import type { Account, LedgerEntriesTable, … } from '@bizcity/platform/db/types'` → tên thuộc khu cách ly đổi sang `@bizcity/platform/ketoan-legacy/db-types` | 11 tệp `packages/kernel` |
| tệp chuyển tiếp `apps/api/src/db/types.ts` thêm `export * from '@bizcity/platform/ketoan-legacy/db-types'` | 1 tệp |
| `src/ketoan-legacy-nap.ts` (nạp kiểu bảng vào `AppDatabase`) ở `apps/api`, `packages/kernel`, `packages/module-sdk`; bản `apps/api` gọi `installKetoanLegacy()` (móc khoá `okti_`) và `main.ts` import ở dòng đầu | 3 tệp mới + `main.ts` |
| `@bizcity/platform/masterdata/*`, `documents/signature.routes`, `core/catalog-warn` | **không sửa** — đường cũ là tệp trỏ tới khu cách ly ở 0.7 |

Ma trận app chạy codemod trên bản tạm trước khi đo (trả tệp gốc sau): open-ketoan sau đổi nguồn = **khớp tên 647 import, thiếu 0; lỗi kiểu MỚI = đúng 7 lỗi cũ E-1…E-7**, không thêm lỗi nào do tách. 0.8: kế toán mang `ketoan-legacy/` về Kernel (đổi import từ `@bizcity/platform/ketoan-legacy/*` sang đường của mình), lõi xoá khu + tệp trỏ (S004-W2-7).

## 6. Cấu hình / triển khai

| Thứ | Đổi |
|---|---|
| `bizcity.app.json` (gốc repo kế toán) | thêm (S001-2) — `appRoot()` tìm thấy khi gói nằm trong `node_modules` |
| `api.Dockerfile` | bỏ chép `packages/{contracts,platform}`; `npm ci` lấy release |
| `.env` | không thêm biến bắt buộc; `CONTROL_MIGRATIONS_DIR`, `BIZCITY_APP_ROOT` tuỳ chọn |
| CI | bước `ma-tran` của open-core chạy lane open-ketoan (`--ketoan`) mỗi PR lõi |

## 7. Kiểm "tương thích" trước khi đổi nguồn (cổng vào W1-b)

1. `node tools/ma-tran-app.mjs --chay-that --ketoan <repo>`: khớp tên 0 thiếu, lỗi kiểu MỚI = 0 (sau B2), làn chạy thật của kế toán đạt.
2. `npm test` của open-ketoan trên gói release đạt đủ (không ít hơn số test trên nền riêng).
3. [20 — diễn tập](20-DIEN-TAP-NANG-CAP.md) đạt trên bản sao CSDL thật: bất biến lệch = 0.
4. Claim R-FLOW trên tệp nền đã nhả (NT-HT-003, NT-MH-011, HT20).
