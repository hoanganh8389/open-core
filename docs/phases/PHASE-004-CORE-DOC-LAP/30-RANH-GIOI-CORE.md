# PHASE-004 · 30 — Ranh giới Core: kế toán ra khỏi lõi, lõi giữ hạ tầng
<!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 W2 — chủ: "Làm sạch ranh giới Core: không chứa logic ledger, costing, kho và vai kế toán đặc thù… Tách rõ ranh giới, nâng cấp core độc lập." Kiểm kê đo trên open-core main sau #21. -->

> **Luật (R-CORE-8):** lõi chỉ chứa **cơ chế** dùng được cho mọi app (chứng từ, sự kiện, quyền, cài đặt, danh sách, tệp, bằng chứng…). **Nội dung nghiệp vụ** — sổ cái, giá vốn, kho, công nợ, thuế, vai / vai ký kế toán — thuộc app sở hữu nó. Khi lõi cần gọi nghiệp vụ của app thì gọi qua **cổng (port)** app đăng ký lúc khởi động; khi cần dữ liệu của app thì app **mở rộng khai báo** (kiểu, thang cài đặt, mã lỗi, vai ký).

## 1. Kiểm kê — thứ kế toán còn trong lõi

| # | Chỗ | Là gì | Đi đâu | Cách |
|---|---|---|---|---|
| B-1 | `db/types.ts` | kiểu Kysely của ≈ 50 bảng kế toán (`ledger_*`, `accounting_*`, `inventory_*`, `stock_*`, `tax_*`, `debt_*`, `purchase_*`, `sales_*`, `warehouses`, `items`, `partners`, `period_locks`, `cost_norms`, `voucher_*`…) | open-ketoan `apps/api/src/db/types.ts` | dùng cơ chế **đã có** `AppDatabase` + `declare module '@bizcity/platform/db/types'` (P2b-4): lõi chỉ khai bảng lõi, kế toán gộp ≈ 50 kiểu của mình; không đổi 237 chỗ `import { db }` (Q-P4-2, chốt) |
| B-2 | `core/actions.ts` — `ctx.ledger.{query, submit, cancel, get, allocateDebt}` + `registerLedgerReader / Submitter / CancelGate` + kiểu `LedgerQuery`, `IngestResult` | cổng sổ trong ngữ cảnh action của **mọi** app | cổng chung của lõi + gói cổng sổ của kế toán | §3 (Q-P4-1) |
| B-3 | `masterdata/default-warehouse.ts` | kho mặc định theo chi nhánh | open-ketoan Kernel (chủ danh mục theo R-CHAIN-0) | dời nguyên; app khác đọc qua API / changefeed của kế toán |
| B-4 | `masterdata/partner.repository.ts` | đối tượng công nợ (`PartnerAccountingInfo`…) | open-ketoan Kernel | như B-3 |
| B-5 | `masterdata/catalog-ensure.ts` | bảo đảm danh mục hàng / ĐVT | open-ketoan Kernel | như B-3 |
| B-6 | `core/errors.ts` — `classifyLedgerTriggerError` | đổi lỗi trigger bảng sổ sang mã chuẩn | open-ketoan Kernel | **đã làm (S004-W2-4a):** lõi giữ **móc** `registerDbErrorClassifier(fn, { replaceDefaults? })` (gọi từ `errors.ts` và `http.ts`); mã `UNBALANCED_ENTRY`, `POSTING_FAILED` vẫn trong danh mục lỗi chung — đã có `category: ledger`, `owner: kernel` (Q-P4-3, chốt); `PERIOD_LOCKED` là của lõi (khoá ngày chứng từ chung — `date-rules.ts`) |
| B-7 | `documents/signature.routes.ts` — `SIGN_ROLES = preparer, cashier, chief_accountant, director`, `signProblem` kiểm theo quyền `periods:lock`, `payments:approve-final`, bảng `document_signatures` theo `event_id` | **cả tệp là tính năng "ký phiếu kế toán"**, không phải hạ tầng ký | open-ketoan `apps/api` (dời nguyên tệp) | **đo lại 2026-11-28: không cần móc `registerSignRoles`** — lõi đã có `documents.sign(docRef, role)` chung (vai theo `SIGN_ROLE_RE`, gắn phiên bản lúc ký); chỉ dời tệp route sang kế toán (S004-W2-4b) |
| B-8 | `core/settings.ts` — bậc `accounting_unit` cứng trong thang | thang cài đặt kế toán | thang lõi `install → site → tenant → branch → user` (Q-PIL-6) + bậc app khai | **đã làm (S004-W2-4a):** lõi **0006** bỏ ràng buộc `setting_values_scope_type_check` liệt kê cứng; `registerSettingScopes([{ key: 'accounting_unit', between: { wider: 'tenant', narrower: 'branch' }, exists }])` — `exists` kiểm bản ghi có thật (thay cho tra bảng `accounting_units` cứng) (Q-P4-4, chốt) |
| B-9 | `config/env.ts` — `BOOK_MODE` | chế độ sổ nội bộ / thuế | open-ketoan cấu hình | dời biến + kiểm sang app |
| B-10 | `core/authz-ketoan-legacy.ts`, `db/migrate-ketoan-legacy.ts` | tệp chuyển tiếp (preset vai kế toán, hook migration cũ) | open-ketoan `apps/api` | giữ ở lõi tới B4 (S001-9) để kế toán chuyển một lần; xoá khỏi lõi ngay sau |
| B-11 | `system/diagnostics.ts` | **đã sạch** — chỉ mục chung (`MIGRATIONS_PENDING`, `DB_WRITABLE`, `EVIDENCE_CHAIN`, `TENANT_ISOLATION`, `EVENT_DEAD`); mục kiểm sổ (Nợ = Có, công nợ ↔ 331…) đang ở open-ketoan | — | **không cần móc mới:** `registerDiagnostics(checks)` đã có (mục chung `PLATFORM_DIAGNOSTICS` + app đăng ký thêm) |

| B-12 | `@bizcity/contracts` (31 tệp) <!-- [2026-11-28 09:37 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 W2-1 — bộ kiểm ranh giới đo thêm: contracts cũng chứa nội dung kế toán --> | **rò rỉ chưa kiểm kê ở bản đầu:** vai kế toán (`ROLES`, `chief_accountant`) và `owner: 'chief_accountant'` trong danh mục khắc phục, khuôn chứng từ kế toán nhập tay (`vouchers`), hoá đơn (`invoices`), công thức giá vốn (`costing-formula`), truy vấn / nộp sổ (`ledger-query`, `IngestResult` ở `documents`), phát hiện nhập sổ (`intake-findings`, 375 dòng), căn cứ pháp lý (`legal-basis`), hồ sơ / mẫu in kế toán (`print-profile`, `print-templates`), bộ quy tắc VN (`quy-tac/*`: đối tượng, nhóm hàng, tổ chức ngân hàng) | gói **`@bizcity/accounting-contracts`** do open-ketoan phát hành (đề xuất Q-P4-6); lõi giữ phần dùng chung (liệt kê dưới) | giữ xuất lại từ `@bizcity/contracts` một bản phát hành (deprecated) rồi bỏ; vai: `Role = string` đã làm (P2b-3) — chỉ cần dời bảng `ROLES` + nhãn |

**Giữ ở `@bizcity/contracts` (hợp đồng dùng chung nhiều app):** `spine`, `doc-refs`, `documents` (phần `DocRef`, `DocLink`, đầu phiếu — trừ `IngestResult`), `api`, `errors`, `remedy`, `findings`, `money`, `module`, `connections`, `ket-noi`, `ma-tra-cuu`, `loi-trinh-duyet`, `ban-dieu-tra`, `lineage` (`bizcity_lineage@1`), `item-master` / `dvt` / `entity-codes` (trụ cột mặt hàng, đơn vị nhỏ nhất, mã — R-CANON-18), `catalog-hint` (`bizcity_catalog_hint@1`, chuẩn danh mục dùng chung; bộ `quy-tac/*` nó đọc là dữ liệu VN → sang `accounting-contracts`, `catalog-hint` nhận bộ quy tắc qua đăng ký), `library-*`.

**Không phải rò rỉ (giữ ở lõi):** `quy-tac.ts` (lỗi theo quy tắc khai báo — cơ chế), `catalog-warn.ts` (cảnh báo mềm có lý do — cơ chế), `libraries/*` (thư viện có băm nội dung — cơ chế; nội dung thư viện VN ở `vn-rulepacks` của kế toán), `date-rules.ts` (khoá ngày chứng từ), `evidence-export.ts`, 12 quyền nền.

## 2. Bộ kiểm ranh giới (chạy trong `pnpm test`)

`tools/kiem-ranh-gioi.mjs` (S004-W2-1, **đã có**) — đo từng (tệp, luật) trong `packages/*/src` (bỏ chú thích), so với sổ nợ `docs/scoreboard/ranh-gioi.json`. Chế độ: không cờ = in số đo; `--check` (trong `pnpm test`) **chặn khi số vi phạm TĂNG**; `--ghi` cập nhật sổ (từ chối nếu tăng); `--strict` chặn mọi vi phạm (S004-W2-6). Luật đo: R-BANG (tên bảng kế toán), R-IMPORT (`@ketoan/*`), R-SO (`ctx.ledger` / `registerLedger*` / `LedgerQuery`), R-VAI (vai / vai ký / quyền kế toán), R-THANG (`accounting_unit`), R-ENV (`BOOK_MODE`), R-TEP (tệp `*-ketoan-*`). **Đo lần đầu 2026-11-28: 158 vi phạm / 22 tệp** (R-BANG 65 · R-VAI 65 · R-SO 19 · R-THANG 6 · R-TEP 2 · R-ENV 1). Ý định ban đầu của bộ kiểm — **KHÔNG ĐẠT** khi `packages/*/src` của lõi:
- nhắc tên bảng nằm trong danh sách bảng nghiệp vụ (`ledger_`, `accounting_`, `inventory_`, `stock_`, `tax_`, `debt_`, `purchase_`, `sales_`, `warehouses`, `items`, `partners`, `period_locks`, `cost_`, `voucher_`) ở mã chạy (không tính chú thích / tài liệu);
- import `@ketoan/*` hoặc đường dẫn của app;
- khai quyền / vai / vai ký có tiền tố nghiệp vụ;
- có tệp `*-ketoan-*` sau mốc B4.

Sổ nợ `ranh-gioi.json` liệt kê số vi phạm còn mở theo tệp; mỗi PR chỉ được giảm, không được thêm (như `no-chuan` của open-platform). Phân bố nợ lần đầu: `db/types.ts` (R-BANG 42), `core/authz-ketoan-legacy.ts` (R-VAI 23), `contracts/intake-findings.ts` (R-VAI 21), `core/actions.ts` (R-SO 17), `masterdata/*` (R-BANG 16), `documents/signature.routes.ts` (R-VAI 8 + R-BANG 3).

## 3. Cổng (port) thay cho `ctx.ledger`

```ts
// lõi — cơ chế chung, không biết "sổ"
export function definePort<T>(name: string): PortKey<T>;
export function providePort<T>(key: PortKey<T>, make: (c: PortCall) => T): void;
// PortCall = { tx, auth, tenantId, actionId, effect: 'read' | 'write', dryRun } — bên cấp tự kiểm luật (action đọc không nộp / huỷ; docKey mang tiền tố module)
// trong action: ctx.port(key) — thiếu nhà cung cấp ⇒ CAPABILITY_MISSING (đã có trong danh mục lỗi)

// gói cổng sổ do open-ketoan phát hành: @bizcity/ledger-port
export const LEDGER = definePort<{ query(q: LedgerQuery): Promise<LedgerQueryRow[]>; submit(doc): Promise<IngestResult>; cancel(docKey, reason): …; get(docKey): …; allocateDebt(…): … }>('ledger');
// open-ketoan khởi động: providePort(LEDGER, (tx, auth) => ({ query: (q) => ledgerQuery.query(tx, auth.tenantId, q), submit: … }))
// module của kế toán: ctx.port(LEDGER).submit(doc)
```

- Luật sở hữu giữ như cũ nhưng **do bên cấp kiểm**: `ownDocument(module, doc)` (docKey `<module>:…`), action đọc không nộp / huỷ — lõi chỉ truyền `effect` + `actionId` trong `PortCall`.
- Đo: `ctx.ledger` có **49 chỗ gọi / 25 tệp, đều ở open-ketoan** (`modules/pos` 8, `phieu-ban`, `xuat-dieu-chinh`, kernel, test) ⇒ cổng chỉ cần chạy cùng tiến trình.
- App khác (POS, cake) muốn ghi sổ: **không** gọi cổng trực tiếp xuyên tiến trình — gửi chứng từ qua cửa nạp của kế toán (`bizcity_ledger_intake@1`, W5). Cổng chỉ dùng trong cùng tiến trình với Accounting Kernel.
- Chuyển tiếp: `ctx.ledger` giữ ở 0.7 dưới dạng bí danh của `ctx.port(LEDGER)` (deprecated, **không đụng 25 tệp**); codemod `ctx.ledger.` → `ctx.port(LEDGER).` (49 chỗ); xoá bí danh ở 0.8. Kiểu `LedgerQuery` / `IngestResult` xuất lại từ `@bizcity/ledger-port` trước, dời hẳn ở bước cuối W2.

## 4. Thứ tự làm (W2)

| Bước | Việc | Chạm hành vi sổ? |
|---|---|---|
| W2-1 | bộ kiểm ranh giới + sổ nợ (đo; `--check` chặn tăng) — **xong** | không |
| W2-2 | `CoreDatabase` + app mở rộng kiểu (B-1) | không — chỉ kiểu |
| W2-3 | cơ chế cổng + `@bizcity/ledger-port` + bí danh `ctx.ledger` (B-2) | không — cùng hàm, đổi đường gọi |
| W2-4 | **4a xong:** thang cài đặt mở + 0006, bộ phân loại lỗi CSDL (B-6, B-8). **4b:** dời `signature.routes.ts` (B-7). **4c:** `BOOK_MODE` (B-9). Chẩn đoán (B-11) đã sạch | không |
| W2-5 | `masterdata/*` sang Kernel kế toán (B-3…B-5) | không — dời nguyên tệp |
| W2-6 | bộ kiểm ranh giới chuyển sang **chặn**; phát hành lõi **0.7.0** | — |
| W2-7 (sau B4) | xoá `*-ketoan-legacy` khỏi lõi (B-10) | — |

Mỗi bước kiểm bằng ma trận `--chay-that`: open-cake + open-ketoan 0 lỗi kiểu mới, test đạt — mã kế toán đi ra từ lõi phải có mặt ở kế toán **cùng PR / cùng bản phát hành** (gộp ở open-ketoan theo R-FLOW trước khi lõi xoá).
