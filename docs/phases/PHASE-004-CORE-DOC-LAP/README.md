# PHASE-004 — Core độc lập: open-ketoan lên Core release, ranh giới sạch, Server / Module SDK, Document Kernel, Event / Sync
<!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — chủ (2026-11-28): "Cần phải bảo đảm Core quản lý business_documents, document_versions, liên kết, hoạt động và vòng đời chung. Cake định nghĩa chứng từ yêu cầu đặt hàng. Kế toán định nghĩa chứng từ mua hàng, thanh toán và các quy tắc ghi sổ. Cách này vừa dùng chung Document Kernel vừa không làm mất ranh giới nghiệp vụ. Tách rõ ranh giới, nâng cấp core độc lập." + năm hạng mục: chuyển open-ketoan sang Core release (làm trước bản đồ tương thích và diễn tập nâng cấp trên bản sao CSDL), làm sạch ranh giới Core, Server / Module SDK chung, chuẩn hoá Document Kernel, chuẩn hoá Event / Sync. -->

> **Đọc kèm:** [10 — Bản đồ tương thích open-ketoan](10-BAN-DO-TUONG-THICH-OPEN-KETOAN.md) · [20 — Diễn tập nâng cấp trên bản sao CSDL](20-DIEN-TAP-NANG-CAP.md) · [30 — Ranh giới Core](30-RANH-GIOI-CORE.md) · [CHECKLIST](CHECKLIST.md) · [PHASE-001](../PHASE-001-OPEN-KETOAN-TREN-OPEN-CORE/README.md) (bước B2–B4 của W1 nằm ở đó) · [PHASE-002](../PHASE-002-DONG-DU-LIEU-XUYEN-APP/README.md) (W5) · [ARCHITECTURE](../../ARCHITECTURE.md)

## 0. Nguyên tắc gốc — R-CORE-8

**Core sở hữu hạ tầng chứng từ; ứng dụng sở hữu loại chứng từ và nghiệp vụ của mình.**

| Lớp | Sở hữu | Ví dụ |
|---|---|---|
| **open-platform** (bizcity-platform) | chuẩn `BIZCITY-*`, canon, schema hợp đồng, bộ kiểm tuân thủ | `bizcity_document@1`, `bizcity_list@1`, vector |
| **open-core** — runtime dùng chung, phiên bản riêng | Workspace / Instance · Identity / RBAC · Settings / Meta · **Document Infrastructure** · Storage / Media · Events / Outbox · Database / Migration · REST / MCP / SDK · Web Shell / UI Kit · Audit / Observability | `business_documents`, `document_versions`, `document_links`, `document_activities`, vòng đời 6 nhóm, workflow YAML, tìm chứng từ, outbox |
| **open-cake** — Care Kernel | Contact · Touch · CRM · Inbox · **loại chứng từ Yêu cầu đặt hàng** | `cake.order_request` (phản chiếu), bảng `order_requests` |
| **open-ketoan** — Accounting Kernel | Ledger · Tax · Cost · Inventory · AP / AR · **loại chứng từ mua hàng, thanh toán… và quy tắc ghi sổ** | `accounting_events`, `ledger_*`, `purchase_documents`, quy tắc hạch toán |
| **open-setup** (ngoài luồng nghiệp vụ) | tạo instance, gắn Workspace, cấp CSDL, theo dõi phiên bản Core | `core_version` mỗi instance |

Hai app trao đổi bằng **định danh + sự kiện + chứng từ** (contract / event / API), **không** đọc CSDL của nhau.

## 1. Năm hạng mục và điều kiện xong

| W | Hạng mục | Xong khi (đo được) | Tài liệu |
|---|---|---|---|
| **W1** | Chuyển open-ketoan sang Core release | open-ketoan không còn `packages/platform` 0.1 riêng; cài `@bizcity/platform` + `@bizcity/contracts` từ release open-core; **toàn bộ test open-ketoan đạt**; **diễn tập nâng cấp trên bản sao CSDL thật đạt** (bất biến sổ cái / chứng từ / lịch sử = 0 lệch) | [10](10-BAN-DO-TUONG-THICH-OPEN-KETOAN.md), [20](20-DIEN-TAP-NANG-CAP.md), PHASE-001 B2–B4 |
| **W2** | Làm sạch ranh giới Core | Core **không** chứa logic ledger, costing, kho, đối tượng công nợ, vai / vai ký kế toán, thang cài đặt kế toán; mỗi thứ có chỗ ở mới ở open-ketoan qua **cổng (port)** hoặc **mở rộng khai báo**; bộ kiểm ranh giới chạy trong `pnpm test` | [30](30-RANH-GIOI-CORE.md) |
| **W3** | Server / Module SDK chung | `@bizcity/server` (`createServer`) và `@bizcity/module-sdk` phát hành từ open-core; open-cake và open-ketoan khởi động qua `createServer`; `module-sdk` không còn import `@ketoan/contracts` | §3 |
| **W4** | Chuẩn hoá Document Kernel | Cả hai app khai loại chứng từ bằng `defineDocumentType`; chứng từ của cả hai có mặt ở `core.document.list`; vòng đời 6 nhóm, phiên bản (`document_versions`), liên kết (`document_links`, 9 vai), hoạt động (`document_activities`) và truy vết (`core.trace.lookup`) dùng chung | §4 |
| **W5** | Chuẩn hoá Event / Sync | Đồng bộ chéo app chỉ qua contract: envelope `bizcity_event@1`, idempotency phía nhận (hộp vào chung), outbox, **replay**, **đối soát (reconciliation)** khai bằng SDK; cake ↔ POS / kế toán dùng đường chung thay mã riêng | §5, PHASE-002 |

**Thứ tự:** W1-a (bản đồ tương thích, kịch bản diễn tập — tài liệu, làm ngay) → W2 (dọn ranh giới trước khi kế toán chuyển, để kế toán chuyển một lần lên lõi đã sạch) → W1-b (kế toán đổi nguồn gói, diễn tập, đóng băng bản riêng) → W4 → W3 → W5. W2 không chạm hành vi sổ: chỉ đổi **chỗ ở** của mã; mã kế toán ra khỏi lõi đi thẳng vào open-ketoan.

## 2. Đo hiện trạng (2026-11-28 · open-core `main` sau #21 · open-ketoan `dev` `0237a4d`)

| Đo | Kết quả |
|---|---|
| Nền riêng của open-ketoan | `packages/platform` **0.1.0** (65 tệp), `contracts` 0.1.0, `kernel` 0.1.0, `module-sdk` 1.0.0, `cli`, `ui-kit`, `vn-rulepacks`; 237 tệp import `@bizcity/platform` |
| So với open-core `packages/platform` (74 tệp) | **38 giống hệt · 27 khác · 9 chỉ lõi có · 0 chỉ kế toán có**. 18 / 27 tệp khác chỉ lệch 1–3 dòng import (`@ketoan/contracts` → `@bizcity/contracts`, `Role`); thay đổi thật ở 7 tệp — chi tiết [10 §2](10-BAN-DO-TUONG-THICH-OPEN-KETOAN.md#2-tệp-nền-65--74) |
| open-ketoan sửa nền sau mốc tách `4e5cbc8` | **0 commit** chạm `packages/platform` (38 commit lên `dev` từ đó) ⇒ chưa phải gộp ba chiều (R-11 PHASE-001 đang sạch) |
| Lỗi kiểu khi biên dịch open-ketoan trên lõi (`ma-tran`) | 7 lỗi E-1…E-7 (PHASE-001 §1.1) — chạy lại trên `main` hiện tại ra đúng 7, không thêm |
| Migration | open-ketoan tới **0186**; lõi 0001–0004 có bản tương đương ở kế toán; lõi **0005** (trục chứng từ) **chưa** — kế toán thêm bản tương đương **≥ 0187** (sau 0156) |
| Claim đang giữ tệp nền ở open-ketoan (R-FLOW) | NT-HT-003 (`core/auth.ts`, `actions.ts`, `authz/*`, `module-sdk/**`, `app.ts`…), NT-MH-011 (`core/http.ts`), HT20 (`security/tool-password.ts`) — W1-b chờ các dòng này nhả (R-FLOW-6: quá 3 ngày không commit coi như nhả) |
| Rò rỉ kế toán trong lõi | ≈ 50 kiểu bảng kế toán trong `db/types.ts`, `ctx.ledger` + 3 cổng đăng ký sổ, `masterdata/*` (kho mặc định, đối tượng công nợ, bảo đảm danh mục), mã lỗi sổ, vai ký kế toán, thang `accounting_unit`, `BOOK_MODE`, 2 tệp chuyển tiếp `*-ketoan-legacy` — danh sách đủ ở [30](30-RANH-GIOI-CORE.md) |
| Quyền cứng ở lõi | 12 quyền nền, **không** quyền kế toán (đã sạch từ P2b-3) |

## 3. W3 — Server / Module SDK chung

Hiện mỗi app tự dựng máy chủ: open-ketoan `apps/api/src/app.ts` (268 dòng: Fastify, xử lý lỗi, CORS, Swagger, auth, đăng ký cổng sổ, bộ đếm số, mount action, nạp module / add-in); open-cake `apps/api/src/server.ts` làm lại phần tương tự. `module-sdk` 1.0.0 nằm ở open-ketoan và còn import `@ketoan/contracts` (kiểu `LedgerQuery`, `IngestResult`, hàm tiền).

| Gói | Nội dung | Từ đâu |
|---|---|---|
| `@bizcity/server` | `createServer({ app, migrations, actions, modules, ports, authz, hooks })`: Fastify + xử lý lỗi chuẩn + CORS / Swagger + auth + `/health`, `/ready` (kiểm migration) + `mountActions` + nạp module theo `tenant_modules` + chạy event runtime + đóng êm | phần chung của `app.ts` kế toán + `server.ts` cake |
| `@bizcity/module-sdk` | `defineAction`, `defineSubscriber`, `defineHook`, `defineDocumentType`, `defineListAction`, `Errors`, workflow, `z`, `sql`, tiền (`@bizcity/contracts`); manifest `bizcity.module.json` + màn × thao tác | dời từ open-ketoan `packages/module-sdk` (bỏ kiểu sổ — sang gói cổng sổ của kế toán, [30 §3](30-RANH-GIOI-CORE.md#3-cổng-port-thay-cho-ctxledger)) |
| `bizcity` CLI (phần chung) | `module check`, `event check`, `flow check` | `packages/cli` kế toán (phần `module-accounting.mjs` ở lại kế toán) |

Xong khi: hai app khởi động bằng `createServer`; `server.ts` / `app.ts` của app chỉ còn đăng ký thứ của app (cổng, module, vai); module-sdk phát hành cùng số phiên bản lõi (lockstep).

## 4. W4 — Document Kernel chung

| Core cấp (đã có ở 0.5 / sau #20, #21) | App khai |
|---|---|
| `business_documents` (đầu phiếu), `document_versions`, `document_links` (9 vai), `document_activities` (chỉ thêm), `document_attachments`, `document_signatures`, `document_sequences` + bộ đếm mặc định | `defineDocumentType({ type, label, workflow \| mirror, meta })` |
| Vòng đời 6 nhóm (`draft · pending · approved · in_progress · done · cancelled`), không xoá: huỷ nháp / đảo / phiên bản mới / lưu trữ | trạng thái riêng → nhóm (YAML hoặc `mirror.statuses`) |
| Hai cách ghi: **quản lý** (lõi giữ trạng thái — `create / update / transition`) và **phản chiếu** (app giữ bảng nguồn — `mirror`) | bảng dòng chi tiết, quy tắc nghiệp vụ, **quy tắc ghi sổ (chỉ kế toán)** |
| Tìm chứng từ `core.document.list` / `export`, đa tiền tệ đầu phiếu | — |

Việc còn lại để hai app **cùng** dùng:
- **open-ketoan:** migration ≥ 0187 tương đương lõi 0005; khai `defineDocumentType` (phản chiếu) cho các loại đang đồng bộ bằng trigger 0156 (mua hàng, bán hàng, thu / chi, phiếu kế toán…) để lõi biết nhóm trạng thái, nhãn, meta; trigger 0156 **giữ** (là cách phản chiếu ở tầng CSDL) nhưng ghi thêm `document_activities` khi đổi trạng thái; phiên bản chứng từ sổ (`accounting_event_versions`) nối `document_versions` bằng `DocLink ledger` — không chuyển bảng sổ vào lõi.
- **open-cake:** đã phản chiếu `cake.order_request` (0.5.0, `cbe14a0`).
- **Lõi:** `core.trace.lookup` (S002-5) — từ một `doc_ref` đi theo `document_links` qua hai app (yêu cầu đặt hàng → đơn bán POS → chứng từ kế toán → bút toán), chỉ đọc, giao phạm vi vai.

## 5. W5 — Event / Sync chung (nối PHASE-002)

| Có ở lõi | Thiếu (làm ở W5) |
|---|---|
| outbox `event_outbox` + giao `event_deliveries` (SKIP LOCKED), `dedupeKey`, thử lại → `dead`, `replayEvents`, đồng hồ `tickClock` | **envelope `bizcity_event@1` có phiên bản + schema** (đăng ký loại sự kiện, kiểm lúc phát) |
| | **hộp vào chung** `event_inbox (tenant, source, event_id)` — idempotency phía nhận (cake đang tự làm bằng `order_request_events`) |
| | **đường chéo app:** đẩy (webhook ký HMAC — cake ↔ POS đang tự làm) và kéo (changefeed `registerSyncFeed`, con trỏ — kế toán `catalog/feed/*` đang tự làm) |
| | **đối soát** `defineReconciler({ every, find, check, repair })` — cake `reconcileSentOrders` đang tự làm; chạy trên việc nền (PHASE-003 S003-11) |
| | **replay theo nguồn + khoảng thời gian** có quyền + bằng chứng; màn Nhật ký & trace / Lỗi (f18, f19) đọc cùng dữ liệu |

Xong khi: cake ↔ POS và cake ↔ kế toán chạy trên hộp vào / changefeed / đối soát của lõi; mã riêng của cake cho việc này bỏ; một sự kiện gửi lặp, đến muộn, mất rồi phát lại đều cho cùng kết quả (test).

## 6. Quyết định (chủ chốt 2026-11-28) <!-- [2026-11-28 09:33 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — chủ chốt Q-P4-1…5 (2026-11-28, "đồng ý") theo phương án cụ thể -->

Đo thêm trước khi chốt: `ctx.ledger` có **49 chỗ gọi trong 25 tệp, tất cả ở open-ketoan** (`modules/pos` 8, `phieu-ban`, `xuat-dieu-chinh`, kernel, test) ⇒ cổng chỉ chạy trong cùng tiến trình; app ngoài nộp sổ qua cửa nạp HTTP. Lõi **đã có** cơ chế mở rộng kiểu bảng (`AppDatabase` + `declare module`, bài kiểm `test/types/app-database.ts`, P2b-4). Mã lỗi sổ đã mang `category: 'ledger'`, `owner: 'kernel'`.

| Mã | Quyết định | Cách làm cụ thể |
|---|---|---|
| **Q-P4-1** | `ctx.ledger` rời lõi bằng **cổng chung**; kiểu sổ nằm trong `@bizcity/ledger-port` do kế toán phát hành | lõi: `definePort<T>(name)`, `providePort(key, make)` với `PortCall = { tx, auth, tenantId, actionId, effect, dryRun }`, `ctx.port(key)` (thiếu nhà cung cấp ⇒ `CAPABILITY_MISSING`). Kế toán: `LEDGER` + nhà cung cấp mang nguyên luật cũ (action đọc không nộp / huỷ; `docKey` mang tiền tố module — `ownDocument`). **Chuyển tiếp:** `ctx.ledger` là bí danh của `ctx.port(LEDGER)` ở 0.7 (deprecated, không đụng 25 tệp), codemod `ctx.ledger.` → `ctx.port(LEDGER).` (49 chỗ), xoá bí danh ở 0.8. Kiểu `LedgerQuery` / `IngestResult` xuất lại từ `ledger-port` trước, dời hẳn ở bước cuối W2 |
| **Q-P4-2** | lõi chỉ khai kiểu bảng lõi; app tự mở rộng | dùng cơ chế **đã có** `AppDatabase` + `declare module '@bizcity/platform/db/types'`; dời ≈ 50 kiểu bảng kế toán sang `apps/api/src/db/types.ts` của kế toán; lõi xuất kiểu trợ giúp (`Json`, `Generated`, `Timestamp`…); 237 chỗ `import { db }` không đổi; mở rộng bài kiểm kiểu có bảng giả kế toán + `@ts-expect-error` |
| **Q-P4-3** | mã lỗi sổ **ở lại** danh mục chung; bộ phân loại lỗi trigger sổ sang kế toán | lõi: `registerDbErrorClassifier(fn)` — `errors.ts` và `http.ts` (hai chỗ đang gọi `classifyLedgerTriggerError`) gọi lần lượt các bộ đã đăng ký; kế toán đăng ký bộ phân loại + bảng thông điệp trigger. Mã `UNBALANCED_ENTRY`, `POSTING_FAILED` giữ (app khác nhận lỗi từ API kế toán cần đúng mã + gợi ý); `PERIOD_LOCKED` giữ ở lõi (khoá ngày chứng từ là chung — `date-rules.ts`, `documents:bypass-date-lock`) |
| **Q-P4-4** | bậc `accounting_unit` do kế toán tự khai | **vướng ở CSDL:** lõi 0001 có ràng buộc `setting_values_scope_type_check` liệt kê cứng `accounting_unit` ⇒ lõi thêm migration **0006**: bỏ ràng buộc liệt kê cứng, thay bằng kiểm theo sổ đăng ký bậc (giữ `scope_type = 'tenant' ⇔ scope_id rỗng`); `registerSettingScopes([{ key: 'accounting_unit', between: ['tenant', 'branch'], resolve }])` — `resolve` đổi chi nhánh → đơn vị hạch toán (`branches.accounting_unit_id`); `CORE_COVERED_BY_KETOAN['0006…']` = "không chạy" (ràng buộc cũ của kế toán vẫn hợp lệ) |
| **Q-P4-5** | kế toán đổi nguồn **một lần ở 0.7.0**, sau khi ranh giới sạch và diễn tập đạt | **0.6.0** = phát hành cái đã gộp (tìm chứng từ, danh sách + xuất); **0.7.0** = W2 (kiểm ranh giới chặn, kiểu bảng dời, cổng + bí danh, móc khai báo, 0006). **Điều kiện tối thiểu để đổi nguồn:** làm xong kiểu bảng (Q-P4-2) **và** 0006 *trước* khi đổi (dời sau thì lõi xoá kiểu kế toán đang dùng ⇒ gãy); `masterdata/*` sang Kernel và xoá bí danh `ctx.ledger` làm **sau** đổi nguồn được (tương thích nguồn) |

## Nhật ký

- 2026-11-28: mở PHASE-004; đo hiện trạng; viết 10 (bản đồ tương thích), 20 (diễn tập), 30 (ranh giới).
- 2026-11-28: chủ chốt Q-P4-1…5 (§6) theo phương án cụ thể; sửa tên mã lỗi `UNBALANCED` → `UNBALANCED_ENTRY`.
