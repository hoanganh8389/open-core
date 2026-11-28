# PHASE-002 — Dòng dữ liệu xuyên app trên open-core (chứng từ, đồng bộ danh mục, truy nguồn)
<!-- [2026-11-28 05:18 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 — chủ (2026-11-28): "tính xuyên suốt về mặt dữ liệu đối với các repo sử dụng chung open-core sẽ thế nào?" → "tiếp": đưa ba thiếu sót lớn (bảng chứng từ ở lõi, đường gửi / nhận chứng từ chung, khung changefeed chung) + truy nguồn liên app thành phase. -->

> **Áp dụng cho:** open-core · mọi app trên open-core (open-cake, open-ketoan, POS, HRM, MRP…) · **Trạng thái:** ☐ — kế hoạch; Q-DD-1…4 chốt theo đề xuất (một API, một quy tắc cho mọi app)
> **Trên:** canon R-CANON-13 (mỗi app một CSDL), R-CANON-18 (trụ cột) · bizcity-platform [NC-004](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-004-TRU-COT-XUYEN-DOANH-NGHIEP.md) §3, §11 · chuẩn [SPINE 1.2](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-SPINE-v1.md), [DOCUMENT](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-DOCUMENT-v1.md), [LINEAGE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-LINEAGE-v1.md), [EVENT](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-EVENT-v1.md), [ORDER-FLOW](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-ORDER-FLOW-v1.md)
> **Trạng thái từng việc:** [CHECKLIST.md](CHECKLIST.md) · **Đi sau:** [PHASE-001](../PHASE-001-OPEN-KETOAN-TREN-OPEN-CORE/README.md) (S002-1 cần `coveredBy` của S001-3)

## 0. Mô hình

Các app **không dùng chung bảng**: mỗi app một CSDL cho mỗi instance (`kt_<slug>`, `cake_<slug>`, `pos_<slug>`…). Liền mạch nhờ ba lớp, đều do open-core bảo đảm:

| Lớp | Nghĩa | Hôm nay |
|---|---|---|
| **Hình giống nhau** | mọi CSDL có cùng bảng lõi (migration của open-core): `tenants`, `users` (`sub = wp:<id>`), `setting_values`, `audit_logs`, `outbox`, `tenant_secrets`, **bốn bảng chứng từ** | bốn bảng chứng từ chỉ có ở open-ketoan (G-1) |
| **Định danh chung** | `tenant` (↔ `blog_id`) · `item_id` · `partner.code` ↔ `contact_id` · `branch_code` · `doc_ref@version` · `QtyLine` (đơn vị nhỏ nhất) | chuẩn có (spine 1.2), kiểu TS chưa có (G-5) |
| **Đường chuyển có hợp đồng** | **xuống** (chủ → bản sao): changefeed `GET /api/v1/sync/<trục>?since=` + `digest` · **ngang** (chứng từ): outbox → app nhận, `Idempotency-Key = <doc_ref>@<version>`, app nhận ghi `document_links` · **truy nguồn**: `traceparent` + `audit_logs` | changefeed chỉ open-ketoan (G-3); gửi / nhận chứng từ mỗi app tự viết (G-2); truy nguồn chỉ trong một CSDL (G-4) |

```text
cake.order_request:01J…@1 ─source→ pos.sale:8812@1 ─source→ inventory.issue:XK-1@1 ─ledger→ ledger.event:pos:CN01:sale:8812@1
(open-cake)                         (POS: qty nhỏ nhất)       (kho)                            (open-ketoan: partner.code)
mỗi mũi tên = outbox bên gửi + document_links bên nhận · sửa trước ghi sổ = @2 · sau ghi sổ = adjusts / reverses
```

## 1. Thiếu sót và phương án

| # | Thiếu | Phương án ở open-core |
|---|---|---|
| G-1 | Bốn bảng chứng từ (`business_documents`, `document_versions`, `document_links`, `document_attachments`) + `document_sequences` chỉ ở open-ketoan; `core/documents.ts` đã ở lõi nhưng app khác không có bảng | **migration lõi 0005** tạo bốn bảng + `document_sequences` theo đúng hình open-ketoan (RLS, chỉ thêm cho `document_links`); open-ketoan: `coveredBy` (đã có từ `0045`, `0158`, `0164`, `0166`…) |
| G-2 | Gửi / nhận chứng từ sang app khác: mỗi app tự viết outbox → HTTP, kiểm `Idempotency-Key`, ghi liên kết | `@bizcity/platform`: **`registerDocumentPeer`** (app đích, URL, khoá) + bộ gửi từ outbox (thử lại có giãn, cùng khoá) + **đầu nhận chung** `POST /api/v1/documents/inbound` (kiểm chữ ký, `<doc_ref>@<version>` đã nhận ⇒ trả lại kết quả cũ, ghi `document_links` vai `source`); app chỉ khai loại nhận và hàm xử lý |
| G-3 | Changefeed: chỉ open-ketoan (`/api/v1/sync/:axis` cho `items`, `partners`, `branches`; con trỏ `<updated_at>|<id>`, `digest`) | **khung chung** `registerSyncFeed(axis, { table, permission, project })` + route `/api/v1/sync/:axis` và `/digest` ở lõi, cùng con trỏ; open-cake mở `contacts`, HRM mở `employees` (khi có); open-ketoan chuyển ba trục sang khung (C6) |
| G-4 | Truy nguồn chỉ trong một CSDL | **`core.trace.lookup`** (action, quyền đọc): nhận `doc_ref` / `traceId` / `requestId`, trả chuỗi `document_links` + phiên bản + lần gửi **trong CSDL này** và **gợi ý app kế** (`doc_ref` của app khác ⇒ app nào); bàn điều tra web-shell gọi lần lượt các app cùng Workspace (registry open-setup) |
| G-5 | Kiểu TS cho định danh chung | `@bizcity/contracts`: `ContactRef`, `PartnerRef`, `ItemRef`, `BranchRef`, `DocRef`, `DocLink`, `QtyLine` (zod, khớp `schema/spine/refs.schema.json` 1.2 — vector dùng chung làm test) |
| G-6 | Regex `doc_ref` 1.2 chưa đối chiếu dữ liệu thật | `tools/kiem-doc-ref.mjs`: đếm `doc_ref` / `doc_no` ngoài bộ ký tự hoặc > 200 ký tự trên **bản sao** CSDL (chỉ đọc) — chạy trước khi open-ketoan áp |

## 2. Nguyên tắc chung (chốt)
<!-- [2026-11-28 05:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 — chủ (2026-11-28): "Q-DD không cần hỏi sâu, xuyên suốt để thống nhất api, quy tắc, nguyên tắc là ok" ⇒ chốt theo đề xuất -->

| Mã | Câu hỏi | Chốt (theo đề xuất) |
|---|---|---|
| Q-DD-1 | Chữ ký giữa hai app cùng Workspace | HMAC bằng khoá máy-máy do open-setup cấp mỗi cặp instance (không dùng khoá `biz-…` của Hub — R-STD-KEY-2) |
| Q-DD-2 | App nhận tắt / chưa bật | bộ gửi giữ trong outbox, thử lại có giãn; quá hạn ⇒ trạng thái "chưa gửi được" hiện ở bàn điều tra, **không** tự huỷ chứng từ nguồn |
| Q-DD-3 | Một chứng từ gửi nhiều app (bán ⇒ kho + kế toán) | mỗi app đích một dòng outbox, cùng `doc_ref@version`, khoá riêng theo đích |
| Q-DD-4 | Truy nguồn qua nhiều CSDL cần quyền ở từng app | bàn điều tra gọi bằng vé SSO của người dùng ⇒ mỗi app tự kiểm quyền; app không có quyền ⇒ hiện "không xem được", không lộ dữ liệu |

## 3. Đầu ra

| # | Việc |
|---|---|
| S002-1 | migration lõi 0005: bốn bảng chứng từ + `document_sequences`; `coveredBy` cho open-ketoan; test tạo / nâng cấp |
| S002-2 | `@bizcity/contracts`: kiểu `*Ref`, `DocLink`, `QtyLine` (zod) + test bằng vector `refs.vectors.json` của open-platform |
| S002-3 | khung changefeed `registerSyncFeed` + `/api/v1/sync/:axis` (+ `digest`) |
| S002-4 | gửi / nhận chứng từ: `registerDocumentPeer`, bộ gửi outbox, `POST /api/v1/documents/inbound` (sau khi chốt Q-DD-1…3) |
| S002-5 | `core.trace.lookup` + gợi ý app kế; màn bàn điều tra dùng ở web-shell (cùng PHASE web-shell) |
| S002-6 | `tools/kiem-doc-ref.mjs` + chạy trên bản sao open-ketoan |
| S002-7 | open-cake dùng S002-1…3 (đơn yêu cầu → POS bằng đường chung thay mã riêng; mở `contacts` changefeed) — ma trận xanh |

## 4. Xong khi

Một chuỗi mẫu cake → POS → kho → kế toán chạy trên bốn CSDL bằng **đường chung của lõi**; nhập một mã bất kỳ ở bàn điều tra ra đủ chuỗi, mọi phiên bản, mọi lần gửi; ma trận open-ketoan × open-cake xanh.

## Nhật ký

- 2026-11-28: mở phase (kế hoạch), từ phân tích dòng dữ liệu xuyên app.
- 2026-11-28: <!-- [2026-11-28 05:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 — chủ (2026-11-28): "Q-DD không cần hỏi sâu, xuyên suốt để thống nhất api, quy tắc, nguyên tắc là ok" ⇒ chốt theo đề xuất --> Q-DD-1…4 chốt theo đề xuất; S002-4 hết chặn.
- 2026-11-28: <!-- [2026-11-28 05:25 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 S002-2 --> **S002-2 ☑** — `packages/contracts/src/spine.ts`: zod một bản cho mọi app; test bằng vector spine 1.2 của open-platform (một nguồn sự thật); `qtyMatchesUnits` kiểm `qty = unitQty × unitRatio` bằng số nguyên. Khuôn `doc_ref` trên dây là tập con của khuôn lưu open-ketoan ⇒ không phá CSDL đang chạy. Test 22 / 22; ma trận không lỗi mới.
