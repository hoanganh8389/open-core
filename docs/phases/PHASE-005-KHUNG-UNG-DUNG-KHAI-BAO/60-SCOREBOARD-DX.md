# PHASE-005 · 60 — Scoreboard DX: developer đỡ phải viết gì, chấm thế nào, bao giờ

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — scoreboard thứ hai: đo công viết tay của developer (khác scoreboard ERP-12 đo lõi "có thứ dùng chung X chưa"). -->

## 1. Vì sao cần scoreboard thứ hai

Scoreboard hiện có (`docs/scoreboard`, ERP-12 × app, 20 mục P1–P20) trả lời: *"lõi đã có thứ dùng chung X chưa, app dùng chưa"*. Nó không trả lời *"làm thêm một màn nghiệp vụ thì developer còn phải tự viết bao nhiêu"*.

Một lõi có đủ 20 mục vẫn có thể bắt developer viết tay route, zod, React list, importer. Scoreboard DX đo đúng phần đó.

## 2. Hai mươi bốn thao tác phổ thông

Đây là những thứ **mọi** màn nghiệp vụ cần, và developer **không nên** phải tự viết.

| Mã | Thao tác | Hôm nay developer viết (đọc mã 2026-11-29) | Sau khung (đích) |
|---|---|---|---|
| TP-01 | schema kiểm dữ liệu tạo / sửa | zod trong từng action | sinh từ `defineEntity` |
| TP-02 | kiểu TS chung API ↔ giao diện | interface ở contracts | `Infer<typeof X>` |
| TP-03 | API danh sách (lọc, tìm, sắp, con trỏ) | `defineListAction` + `ListDef` tay | sinh từ registry |
| TP-04 | API chi tiết theo ID | route tay | sinh `<key>.get` |
| TP-05 | xuất CSV / XLSX / JSON / NDJSON | có csv / json / ndjson; xlsx chưa | sinh, kể cả xlsx + xuất nền |
| TP-06 | nhập: ghép cột, chạy thử, lỗi từng dòng | viết riêng mỗi app (kế toán có) | sinh từ registry (S003-10) |
| TP-07 | màn danh sách (chip lọc, cột, URL, bulk) | React tay | `defineScreen` list |
| TP-08 | form tạo / sửa (tấm trượt, lỗi dưới ô) | React tay | `defineScreen` form |
| TP-09 | màn chi tiết + khối thông tin | React tay | `defineScreen` detail |
| TP-10 | hoạt động / ghi chú / @nhắc / tệp | bảng lõi có; khối giao diện chưa | `activities: true` |
| TP-11 | lịch sử phiên bản + "sửa ⇒ @2" | lõi có cho chứng từ | sinh cho mọi thực thể có `versioned` |
| TP-12 | đánh số chứng từ | lõi có (`defineDocumentType.series`) | giữ |
| TP-13 | workflow + nút chuyển trạng thái | YAML có; nút tay | nút sinh từ workflow |
| TP-14 | chuỗi chứng từ (nguồn → kho → sổ) | dữ liệu có (`document_links`); màn tay | sinh trên detail |
| TP-15 | quyền đọc / ghi + ẩn nút | khai ở manifest + kiểm tay ở React | `permissions` một chỗ |
| TP-16 | phạm vi vai (chi nhánh / kho) | authz lõi có | tự áp cho API sinh ra |
| TP-17 | che dữ liệu nhạy cảm (SĐT) | tay | `sensitive: true` |
| TP-18 | menu + số đếm + route URL | tay | `menu` trong `defineScreen` |
| TP-19 | REST + MCP cho action | lõi có (`defineAction`) | giữ |
| TP-20 | idempotency + audit cho ghi | lõi có | giữ |
| TP-21 | sự kiện `<key>.changed` / outbox | tay mỗi action | sinh cho action ghi sinh tự động |
| TP-22 | chống trùng (SĐT, mã) + cảnh báo | tay | `unique` / validator khai báo |
| TP-23 | lưu trữ / khôi phục (không xoá) | lõi có cho chứng từ | `lifecycle: 'archive'` mọi thực thể |
| TP-24 | bốn trạng thái + lỗi có cách sửa | tay mỗi màn | bộ vẽ màn tự có |

## 3. Chấm điểm

**Mức của mỗi thao tác ở mỗi app** (cùng thang 0–3 cho mọi người):

| Mức | Nghĩa | Ví dụ |
|---|---|---|
| **D0** | viết tay toàn bộ | importer riêng |
| **D1** | gọi hàm lõi nhưng vẫn tự ráp nhiều | `defineListAction` với `ListDef` tay |
| **D2** | khai một dòng / một khối | `import: true` |
| **D3** | sinh tự động, không viết gì | API chi tiết từ `defineEntity` |

Có ba con số, cùng sinh bởi `tools/scoreboard-dx.mjs`:

1. **Điểm DX của app** = tổng mức ÷ (24 × 3), tính %. Mỗi mức > 0 phải có bằng chứng là đường dẫn mã, giống luật của scoreboard ERP-12.
2. **Bài chuẩn "tính năng vàng"**:
   - `@bizcity/testing/golden` là module mẫu cố định: một danh mục `golden.nhom_khach` (config) + một chứng từ `golden.phieu_yeu_cau` (có workflow, dòng, hoạt động, nhập, xuất).
   - Công cụ đếm **số dòng developer viết** (bỏ chú thích, bỏ tệp sinh) và **số tệp**.
   - Hôm nay ước khoảng 900 dòng / khoảng 12 tệp (đọc mã, chưa đo bằng công cụ). Đích ≤ **120 dòng / ≤ 4 tệp**.
   - Module mẫu cũng là bài test thật của khung: chạy đủ list / get / export / import / transition trên Postgres.
3. **Nợ viết tay ở app**, đo tự động trên bản chép app như `ma-tran`:
   - số route đăng ký **không** qua `defineAction`;
   - số zod trùng hình thực thể đã có trong registry;
   - số màn React danh sách / form không dùng bộ vẽ của web-shell.
   - **Bánh cóc:** không được tăng.

**Thao tác giảm bớt** = những mục đi từ D0 / D1 lên D2 / D3. Bảng §2 là danh sách đó. Phần "developer chỉ viết nghiệp vụ" còn lại đúng bốn thứ:
- action ghi của chủ (luật mã, giá, ghi sổ);
- validator nghiệp vụ;
- workflow YAML;
- lối thoát giao diện cho màn đặc thù.

## 4. Bao giờ đo — và ai

| Lúc | Làm gì | Ai |
|---|---|---|
| mỗi PR ở open-core | `node tools/scoreboard-dx.mjs --check` trong `pnpm test`: điểm của module mẫu không giảm, số dòng tính năng vàng không tăng | tác giả PR (cả hai lane) |
| mỗi PR ở app | `bizcity scoreboard dx --check`: nợ viết tay không tăng | developer app |
| mỗi bản phát hành lõi | chụp số liệu vào `docs/scoreboard/scoreboard.json` (mục `dx`), sinh `SCOREBOARD.md` + màn Tình trạng nền tảng (f5) | lane R lúc cắt bản; lane T cập nhật bằng chứng |
| khi thêm một thao tác phổ thông mới | thêm dòng TP-nn — chỉ khi ≥ 2 app cần (R-PLAT-3) | lane T |

## 5. Đích theo bản phát hành (đề xuất, chủ chốt ở Q-P5-8)

| Bản | Mở khoá | Điểm DX module mẫu | Tính năng vàng |
|---|---|---|---|
| hiện tại (0.6) | — | đo lần đầu ở F0 (CHECKLIST) | ≈ 900 dòng (ước, chưa đo) |
| 0.8 | Entity Registry + API đọc / xuất / nhập sinh tự động (F1, F2) | ≥ 50 % | ≤ 400 dòng |
| 0.9 | `defineScreen` + web-shell list / form / detail (F3) | ≥ 75 % | ≤ 200 dòng |
| 1.0 | module lifecycle + scaffold + chuỗi chứng từ trên detail (F4) | ≥ 85 % | ≤ 120 dòng / 4 tệp |

Con số hôm nay là **ước từ đọc mã**, không phải số đo. Số đo đầu tiên là việc F0, trước mọi việc khác, để có mốc thật.
