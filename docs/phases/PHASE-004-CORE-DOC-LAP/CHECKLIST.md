# PHASE-004 — checklist

<!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — nguồn trạng thái từng việc của phase. -->

> Ký hiệu: ☐ chưa làm · ◐ đang / có một phần · ☑ xong (có bằng chứng ở README) · ⛔ bị chặn.

| Mã | Việc | Repo | Trạng thái |
|---|---|---|---|
| **W1** | **open-ketoan lên Core release** | | |
| S004-W1-1 | bản đồ tương thích ([10](10-BAN-DO-TUONG-THICH-OPEN-KETOAN.md)) — đo 65 / 74 tệp, gói, API, migration, cấu hình | open-core | ☑ |
| S004-W1-2 | kịch bản diễn tập trên bản sao CSDL ([20](20-DIEN-TAP-NANG-CAP.md)) — bất biến L / D / H, 11 bước, quay lui | open-core | ☑ |
| S004-W1-3 | bộ đo bất biến `tools/dien-tap/do-bat-bien` (SQL chỉ đọc + JSON + `--chi-tiet`) | open-core | ☐ |
| S004-W1-4 | `0187_truc_chung_tu.sql` ở open-ketoan + `coveredBy` lõi 0005 | open-ketoan (R-FLOW) + open-core | ☐ |
| S004-W1-5 | `scripts/dien-tap-nang-cap.sh` | open-ketoan | ☐ |
| S004-W1-6 | diễn tập: bản sao CSDL dev → bản sao CSDL chạy thật; biên bản | open-ketoan | ☐ |
| S004-W1-7 | B2–B4 của PHASE-001 (sửa E-1…E-7 + R-1, đổi nguồn gói, đóng băng, xoá nền riêng) | open-ketoan | ⛔ claim NT-HT-003 / NT-MH-011 / HT20 |
| **W2** | **Ranh giới Core** ([30](30-RANH-GIOI-CORE.md)) | | |
| S004-W2-1 | `tools/kiem-ranh-gioi.mjs` + `ranh-gioi.json` — đo; `--check` chặn tăng (trong `pnpm test`) | open-core | ☑ 158 vi phạm / 22 tệp |
| S004-W2-8 | tách `@bizcity/accounting-contracts` (B-12, Q-P4-6 — chờ chủ chốt) | open-core + open-ketoan | ☐ |
| S004-W2-2 | dời ≈ 50 kiểu bảng kế toán sang `AppDatabase` của open-ketoan (cơ chế đã có) + xuất kiểu trợ giúp + mở rộng bài kiểm kiểu (B-1) | open-core + open-ketoan | ☐ |
| S004-W2-3a | lõi: `definePort` / `providePort` / `ctx.port` + bí danh `ctx.ledger` → cổng `ledger` (B-2) | open-core | ☑ 62 / 62 |
| S004-W2-3b | open-ketoan: gói `@bizcity/ledger-port` (kiểu + khoá `LEDGER`) + `providePort(LEDGER, …)` mang luật `ownDocument` / effect; codemod 49 chỗ; xuất lại kiểu từ contracts | open-ketoan (R-FLOW) | ☐ |
| S004-W2-4a | lõi: `registerSettingScopes` + **migration 0006**; `registerDbErrorClassifier` (B-6, B-8) | open-core | ☑ 66 / 66 |
| S004-W2-4b | `documents/signature.routes.ts` (ký phiếu kế toán: vai `cashier`, `chief_accountant`, quyền `periods:lock`…) **dời nguyên tệp** sang open-ketoan (B-7) — không cần móc `registerSignRoles`: lõi đã có `documents.sign` chung theo `SIGN_ROLE_RE` | open-core + open-ketoan | ☐ |
| S004-W2-4c | `BOOK_MODE` (B-9): cần cơ chế app mở rộng `env` của lõi (`extendEnv`) — làm cùng S004-W2-6 | open-core | ☐ |
| — | chẩn đoán (B-11): **đã có** `registerDiagnostics` — không cần móc mới | — | ☑ |
| S004-W2-5 | `masterdata/*` sang Kernel kế toán (B-3…B-5) | open-core + open-ketoan | ☐ |
| S004-W0 | phát hành **0.6.0** (tìm chứng từ, danh sách + xuất) | open-core | ☐ |
| S004-W2-6 | kiểm ranh giới chuyển sang chặn; phát hành **0.7.0** | open-core | ☐ |
| S004-W2-7 | xoá `*-ketoan-legacy` khỏi lõi (sau B4) | open-core | ☐ |
| **W3** | **Server / Module SDK** | | |
| S004-W3-1 | `@bizcity/server` — `createServer` (lỗi, CORS, Swagger, auth, health / ready, mount action, nạp module, event runtime) | open-core | ☐ |
| S004-W3-2 | `@bizcity/module-sdk` dời từ open-ketoan, bỏ `@ketoan/contracts` | open-core | ☐ |
| S004-W3-3 | open-cake khởi động qua `createServer` | open-cake | ☐ |
| S004-W3-4 | open-ketoan khởi động qua `createServer` | open-ketoan | ☐ |
| **W4** | **Document Kernel** | | |
| S004-W4-1 | lõi: trục chứng từ, hai cách ghi, vòng đời 6 nhóm, tìm / xuất chứng từ | open-core | ☑ 0.5.0 + #20, #21 |
| S004-W4-2 | open-cake: `cake.order_request` phản chiếu | open-cake | ☑ `cbe14a0` |
| S004-W4-3 | open-ketoan: khai `defineDocumentType` (phản chiếu) cho các loại trigger 0156; trigger ghi `document_activities` | open-ketoan | ☐ |
| S004-W4-4 | `core.trace.lookup` (= S002-5) qua `document_links` hai app | open-core | ☐ |
| **W5** | **Event / Sync** (nối PHASE-002) | | |
| S004-W5-1 | envelope `bizcity_event@1` có phiên bản + đăng ký loại sự kiện | open-core | ☐ |
| S004-W5-2 | hộp vào chung `event_inbox` (idempotency phía nhận) | open-core | ☐ |
| S004-W5-3 | đẩy (webhook ký HMAC) + kéo (`registerSyncFeed` = S002-3) | open-core | ☐ |
| S004-W5-4 | `defineReconciler` trên việc nền (S003-11) | open-core | ☐ |
| S004-W5-5 | cake ↔ POS / kế toán chuyển sang đường chung, bỏ mã riêng (= S002-7) | open-cake | ☐ |
