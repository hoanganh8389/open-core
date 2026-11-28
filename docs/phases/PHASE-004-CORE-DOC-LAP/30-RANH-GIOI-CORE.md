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
| B-6 | `core/errors.ts` — `classifyLedgerTriggerError` | đổi lỗi trigger bảng sổ sang mã chuẩn | open-ketoan Kernel | lõi giữ **móc** `registerDbErrorClassifier(fn)` (gọi từ `errors.ts` và `http.ts`); mã `UNBALANCED_ENTRY`, `POSTING_FAILED` vẫn trong danh mục lỗi chung — đã có `category: ledger`, `owner: kernel` (Q-P4-3, chốt); `PERIOD_LOCKED` là của lõi (khoá ngày chứng từ chung — `date-rules.ts`) |
| B-7 | `documents/signature.routes.ts` — `SIGN_ROLES = preparer, cashier, chief_accountant, director` | vai ký của chứng từ kế toán | app khai | `registerSignRoles([...])`; lõi chỉ giữ cơ chế ký theo vai + phiên bản |
| B-8 | `core/settings.ts` — bậc `accounting_unit` cứng trong thang | thang cài đặt kế toán | thang lõi `install → site → tenant → branch → user` (Q-PIL-6) + bậc app khai | lõi **0006** bỏ ràng buộc `setting_values_scope_type_check` liệt kê cứng; `registerSettingScopes([{ key: 'accounting_unit', between: ['tenant', 'branch'], resolve }])` (Q-P4-4, chốt) |
| B-9 | `config/env.ts` — `BOOK_MODE` | chế độ sổ nội bộ / thuế | open-ketoan cấu hình | dời biến + kiểm sang app |
| B-10 | `core/authz-ketoan-legacy.ts`, `db/migrate-ketoan-legacy.ts` | tệp chuyển tiếp (preset vai kế toán, hook migration cũ) | open-ketoan `apps/api` | giữ ở lõi tới B4 (S001-9) để kế toán chuyển một lần; xoá khỏi lõi ngay sau |
| B-11 | `system/diagnostics.ts` | **đã sạch** — chỉ mục chung (`MIGRATIONS_PENDING`, `DB_WRITABLE`, `EVIDENCE_CHAIN`, `TENANT_ISOLATION`, `EVENT_DEAD`); mục kiểm sổ (Nợ = Có, công nợ ↔ 331…) đang ở open-ketoan | — | thêm móc `registerDiagnostic({ code, run })` để app gắn mục của mình vào cùng màn / API (thay đường riêng) |

**Không phải rò rỉ (giữ ở lõi):** `quy-tac.ts` (lỗi theo quy tắc khai báo — cơ chế), `catalog-warn.ts` (cảnh báo mềm có lý do — cơ chế), `libraries/*` (thư viện có băm nội dung — cơ chế; nội dung thư viện VN ở `vn-rulepacks` của kế toán), `date-rules.ts` (khoá ngày chứng từ), `evidence-export.ts`, 12 quyền nền.

## 2. Bộ kiểm ranh giới (chạy trong `pnpm test`)

`tools/kiem-ranh-gioi.mjs` (việc S004-W2-1) — **KHÔNG ĐẠT** khi `packages/*/src` của lõi:
- nhắc tên bảng nằm trong danh sách bảng nghiệp vụ (`ledger_`, `accounting_`, `inventory_`, `stock_`, `tax_`, `debt_`, `purchase_`, `sales_`, `warehouses`, `items`, `partners`, `period_locks`, `cost_`, `voucher_`) ở mã chạy (không tính chú thích / tài liệu);
- import `@ketoan/*` hoặc đường dẫn của app;
- khai quyền / vai / vai ký có tiền tố nghiệp vụ;
- có tệp `*-ketoan-*` sau mốc B4.

Có danh sách **nợ ranh giới** (`docs/scoreboard/ranh-gioi.json`) liệt kê B-1…B-10 còn mở; mỗi PR chỉ được giảm, không được thêm (như `no-chuan` của open-platform).

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
| W2-1 | bộ kiểm ranh giới + danh sách nợ (đo, chưa chặn) | không |
| W2-2 | `CoreDatabase` + app mở rộng kiểu (B-1) | không — chỉ kiểu |
| W2-3 | cơ chế cổng + `@bizcity/ledger-port` + bí danh `ctx.ledger` (B-2) | không — cùng hàm, đổi đường gọi |
| W2-4 | móc khai báo: thang cài đặt, vai ký, bộ phân loại lỗi CSDL, mục chẩn đoán (B-6, B-7, B-8, B-11); `BOOK_MODE` (B-9) | không |
| W2-5 | `masterdata/*` sang Kernel kế toán (B-3…B-5) | không — dời nguyên tệp |
| W2-6 | bộ kiểm ranh giới chuyển sang **chặn**; phát hành lõi **0.7.0** | — |
| W2-7 (sau B4) | xoá `*-ketoan-legacy` khỏi lõi (B-10) | — |

Mỗi bước kiểm bằng ma trận `--chay-that`: open-cake + open-ketoan 0 lỗi kiểu mới, test đạt — mã kế toán đi ra từ lõi phải có mặt ở kế toán **cùng PR / cùng bản phát hành** (gộp ở open-ketoan theo R-FLOW trước khi lõi xoá).
