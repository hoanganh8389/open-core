# PHASE-004 · 20 — Diễn tập nâng cấp open-ketoan lên Core release trên bản sao CSDL
<!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 W1-a (PHASE-001 S001-8) — chủ: "diễn tập nâng cấp trên bản sao CSDL để bảo toàn sổ cái, chứng từ và lịch sử kế toán". Dựa trên công cụ open-ketoan đã có: scripts/sao-luu.sh (--kiem), scripts/kiem-nang-cap.sh (R-DB-15), scripts/doi-chieu-ke-toan.sql, lane diagnostics. -->

> **Mục tiêu:** chứng minh — trên **bản sao** CSDL thật, không bao giờ trên bản đang chạy — rằng đổi open-ketoan từ nền riêng 0.1 sang open-core release **không làm đổi một con số nào** của sổ cái, chứng từ và lịch sử; đo thời gian dừng; và quay lui được. Diễn tập đạt là điều kiện vào W1-b ([10 §7](10-BAN-DO-TUONG-THICH-OPEN-KETOAN.md#7-kiểm-tương-thích-trước-khi-đổi-nguồn-cổng-vào-w1-b)).

## 1. Khác `kiem-nang-cap.sh` ở đâu

`kiem-nang-cap.sh` (R-DB-15) đã kiểm "migration bản mới chạy trên CSDL có dữ liệu của bản trước" với **dữ liệu mẫu** nạp qua API. Diễn tập này bổ sung ba thứ: (1) chạy trên **bản sao dữ liệu thật** (mọi đơn vị, mọi kỳ, kể cả kỳ đã khoá); (2) đo **bất biến trước / sau** bằng băm, không chỉ "có chạy"; (3) đo thời gian + thử **quay lui**.

## 2. Môi trường

| Thứ | Quy định |
|---|---|
| Nguồn | tệp `pg_dump` mới nhất của bản cần nâng (`scripts/sao-luu.sh` + `--kiem` đạt) **và** bản sao `DATA_DIR` (tệp đính kèm, nhật ký JSONL) cùng thời điểm |
| Nơi chạy | máy / container cô lập, Postgres **cùng phiên bản chính** với bản chạy thật (16), không có đường ra mạng tới dịch vụ thật (hoá đơn điện tử, ngân hàng, Hub) — biến môi trường bí mật để trống |
| Mã | bản A = open-ketoan hiện tại (nền riêng 0.1, commit ghi lại); bản B = open-ketoan nhánh đổi nguồn (B3) cài `@bizcity/platform` release `X.Y.Z` |
| Dữ liệu cá nhân | bản sao giữ nguyên (cần để so); máy diễn tập coi như máy chạy thật về quyền truy cập; xoá sau khi xong và ghi biên bản |

## 3. Bất biến phải giữ (lệch = 0)

Đo bằng **`tools/dien-tap/do-bat-bien.mjs`** (S004-W1-3, **đã có** <!-- [2026-11-28 10:08 PM Johnny Chu - Chu Hoàng Anh] S004-W1-3 -->): mọi câu là SELECT trong giao dịch `READ ONLY`; mỗi mục một SAVEPOINT (một câu lỗi không làm hỏng mục khác); băm = md5 từng dòng cộng tiền tố 60 bit (không phụ thuộc thứ tự, nhẹ với bảng lớn) + số dòng; bảng / cột không có ⇒ `khong-ap-dung` / `thieu-cot` (không đoán).

```bash
node tools/dien-tap/do-bat-bien.mjs --db "$DB_A" --nhan "bản A <commit>" --out truoc.json   # bước 2
node tools/dien-tap/do-bat-bien.mjs --db "$DB_A" --nhan "bản B <commit>" --out sau.json     # bước 6 (cùng CSDL, sau migrate)
node tools/dien-tap/do-bat-bien.mjs --so truoc.json sau.json                                  # ĐẠT ⇒ exit 0 · lệch ⇒ exit 1
node tools/dien-tap/do-bat-bien.mjs --db "$DB_A" --chi-tiet L-3                               # tìm chỗ lệch theo đơn vị
```

Luật so: mục `bang` — trước = sau (số dòng + băm); mục `khong` (L-2, L-4, L-6, H-1 chuỗi) — phải 0, **hoặc giữ đúng mốc sai sẵn** của dữ liệu thật (ghi biên bản; nâng cấp làm tăng **hay tự sửa** đều là lệch); mục `sau` (W-1…W-3, danh sách trắng §3.4) — chỉ đo khi có cột / bảng mới, phải 0. **Không có trong bộ đo:** L-8 (chạy `scripts/doi-chieu-ke-toan.sql` của open-ketoan, so cột "lech"), H-4 (quyền hiệu lực — đo qua API ở bước 7), D-5 phần tệp trên đĩa (so sha256 `DATA_DIR/attachments` — việc của `dien-tap-nang-cap.sh`). Mọi mục khác của §3 có mã riêng trong bộ đo. Mỗi mục là một băm hoặc một con số; so trước (bản A) và sau (bản B) — **khác là KHÔNG ĐẠT**, trừ các mục ở §3.4.

### 3.1 Sổ cái

| Mã | Bất biến | Cách đo |
|---|---|---|
| L-1 | số dòng `ledger_entries`, `ledger_lines`, `ledger_links`, `ledger_balances_daily` theo đơn vị | `count(*)` group by `tenant_id` |
| L-2 | **cân sổ**: Σ `debit` = Σ `credit` theo (đơn vị, bút toán) | `ledger_lines` group by `tenant_id, entry_id` having lệch ≠ 0 ⇒ phải rỗng ở cả A và B |
| L-3 | **số phát sinh** theo (đơn vị, tài khoản, tháng): Σ nợ, Σ có | băm sha256 của bảng kết quả sắp xếp |
| L-4 | **số dư ngày** `ledger_balances_daily` khớp tính lại từ `ledger_lines` | so hai bảng — rỗng |
| L-5 | **băm nội dung bút toán** `ledger_entries.content_hash` / `body_hash` | băm của dãy (`id`, `content_hash`, `body_hash`) sắp theo `id` |
| L-6 | bút toán đảo: mọi `is_reversal` có `reverses_entry_id` trỏ đúng | đếm mồ côi = 0 |
| L-7 | kỳ khoá `period_locks` + `period_lock_events` | băm toàn bảng |
| L-8 | đối chiếu kế toán `scripts/doi-chieu-ke-toan.sql` (cân sổ, công nợ ↔ 331, hoá đơn ↔ 1331, kho ↔ 156…) mọi đơn vị | cột "lech" của từng mục giống hệt A |

### 3.2 Chứng từ và sự việc kế toán

| Mã | Bất biến | Cách đo |
|---|---|---|
| D-1 | `accounting_events`: số dòng, băm (`doc_key`, `version`, `status`, `posted_version`, `total`) | băm sắp theo `id` |
| D-2 | `accounting_event_versions`: băm `payload` từng phiên bản (lịch sử nộp sổ) | băm (`event_id`, `version`, md5(`payload`::text)) |
| D-3 | `business_documents`: số dòng theo (`doc_type`, `status`); băm (`doc_ref`, `status_raw`, `status`, `version`, `total`) | B có thêm cột 0005 (§3.4) — so trên cột cũ |
| D-4 | `document_versions`, `document_links`, `document_signatures` | băm toàn bảng sắp theo khoá |
| D-5 | `document_attachments` + **tệp trên đĩa**: mỗi dòng có tệp, sha256 tệp = cột băm | duyệt `DATA_DIR/attachments` |
| D-6 | bảng nghiệp vụ chính: `purchase_documents`, `sales_lines`, `sales_payments`, `tax_invoices` (+ dòng), `inventory_movements`, `inventory_costs`, `debt_items`, `debt_allocations` | số dòng + băm theo khoá chính |
| D-7 | số chứng từ `document_sequences`: `last_no` mỗi dãy | băm toàn bảng — số kế tiếp không nhảy, không lùi |

### 3.3 Lịch sử, bằng chứng, quyền

| Mã | Bất biến | Cách đo |
|---|---|---|
| H-1 | `audit_logs`: số dòng; **chuỗi băm nguyên vẹn** (`prev_hash` → `hash`, `chain_seq` liền) | mục kiểm chuỗi của lane chẩn đoán (`system/diagnostics.ts`, hàm CSDL `audit_log_hash`) + `verifySeals` (`core/evidence-export.ts`) trên mọi đơn vị |
| H-2 | `event_outbox` / `event_deliveries`: số dòng theo `status`; không việc nào đổi trạng thái do nâng cấp | so A / B |
| H-3 | người dùng, vai, gán vai (`users`, `tenant_roles`, `tenant_role_rules`, `user_role_assignments`) | băm toàn bảng |
| H-4 | **quyền hiệu lực**: với mỗi vai đang dùng, tập quyền tính ra ở A = ở B | API `/api/v1/me` (hoặc hàm tính quyền) cho một người đại diện mỗi vai — bắt R-1 (sổ vai rỗng ⇒ 403) |
| H-5 | cài đặt `setting_values`, bí mật `tenant_secrets` (đếm + băm bản mã, không giải mã) | băm |

### 3.4 Được phép khác (danh sách trắng)

| Chỗ | Vì sao |
|---|---|
| `schema_migrations`: thêm cột `source`, `module`; thêm dòng lõi `0001…0005` ghi nhận theo `coveredBy` + dòng `0187_truc_chung_tu.sql` | S001-4, §4 bản đồ |
| `business_documents`: cột mới `currency` (= `VND`), `fx_rate` (= 1), `total_fc` (NULL), `org_unit_code` (''), `archived_at` (NULL) | lõi 0005 — kiểm giá trị mặc định đúng cho **mọi** dòng cũ |
| bảng mới `document_activities` | rỗng sau nâng cấp (lịch sử cũ không bịa ra) |
| ràng buộc `doc_type` nới | không dòng cũ nào vi phạm cả hai ràng buộc |

## 4. Các bước

| # | Bước | Đạt khi |
|---|---|---|
| 1 | Khôi phục `pg_dump` vào CSDL `dien_tap_a` + chép `DATA_DIR` | `sao-luu.sh --kiem` đạt trên tệp; đếm bảng khớp |
| 2 | Bật **bản A** trên `dien_tap_a` (không ghi gì), chạy `do-bat-bien` ⇒ `truoc.json` | lane diagnostics bản A đạt (nếu bản thật đang có lệch, ghi vào biên bản làm mốc — **không sửa trong diễn tập**) |
| 3 | Dừng bản A. Ghi giờ bắt đầu | — |
| 4 | Bật **bản B** trên cùng CSDL: `db:migrate` (nguồn lõi + app, `ketoanLegacyHooks`) | migration chạy: lõi 0001–0004 ghi nhận, 0005 ghi nhận theo 0187, 0187 chạy; không lỗi; ghi thời gian |
| 5 | `/ready` của bản B | đủ migration, sổ vai có vai kế toán (R-1), `appRoot` đúng (R-2) |
| 6 | Chạy `do-bat-bien` ⇒ `sau.json`; so với `truoc.json` | lệch ngoài §3.4 = **0** |
| 7 | Khói (smoke) chỉ đọc qua API bản B, mỗi vai một người: mở 3 báo cáo (cân đối phát sinh, sổ chi tiết công nợ, bảng kê thuế) của 2 kỳ đã khoá + kỳ đang mở | JSON báo cáo **giống hệt** bản A (so băm) |
| 8 | Khói ghi trên **bản sao thứ hai** `dien_tap_b` (khôi phục lại từ dump): lập 1 phiếu mua, 1 phiếu thu, duyệt, ghi sổ, huỷ một phiếu | số chứng từ kế tiếp đúng dãy (D-7), bút toán cân (L-2), `document_activities` có dòng (W4), chuỗi bằng chứng nguyên vẹn (H-1) |
| 9 | Toàn bộ `npm test` của open-ketoan bản B (CSDL test riêng) | đạt đủ, số test ≥ bản A |
| 10 | **Quay lui:** xoá `dien_tap_a`, khôi phục dump, bật lại bản A | bản A chạy, `do-bat-bien` = `truoc.json` — quay lui không mất gì |
| 11 | Biên bản | thời gian dừng (bước 3 → 5), kết quả từng mục §3, danh sách lệch (phải rỗng), commit A / B, phiên bản lõi; xoá bản sao |

## 5. Không đạt thì

- Lệch ở L-* / D-* / H-1: **dừng**, không đổi nguồn; tìm nguyên nhân bằng so từng dòng (`do-bat-bien --chi-tiet <mã>`), sửa ở lõi hoặc tệp chuyển tiếp, phát hành bản lõi mới, diễn tập lại từ bước 1.
- Lệch H-4 (quyền): thường là R-1 — kiểm `ketoanAuthzPreset()` được gọi trước `buildApp`.
- Migration lỗi: lõi bổ sung `coveredBy` / `isApplied`, không sửa CSDL bằng tay.

## 6. Việc phải làm để diễn tập chạy được

| Mã | Việc | Ở đâu |
|---|---|---|
| S004-W1-3 | ☑ `tools/dien-tap/do-bat-bien.mjs` (JSON, `--so`, `--chi-tiet`); tự kiểm 8 ca trên CSDL lõi + bảng sổ dựng theo cột thật của open-ketoan (`test/dien-tap.test.mjs`) | open-core |
| S004-W1-4 | `0187_truc_chung_tu.sql` ở open-ketoan + `CORE_COVERED_BY_KETOAN['0005_…'] = '0187_truc_chung_tu.sql'` | open-ketoan (R-FLOW) + open-core |
| S004-W1-5 | `scripts/dien-tap-nang-cap.sh` (bước 1–11, tham số: tệp dump, thư mục DATA_DIR, ref A, ref B) | open-ketoan |
| S004-W1-6 | chạy diễn tập trên bản sao CSDL dev, rồi bản sao CSDL chạy thật; nộp biên bản | open-ketoan, người có quyền dữ liệu thật |
