# PHASE-005 · 05 — Phương án đề xuất cho các câu Q-P5

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-09: phương án đề xuất cho 8 câu Q-P5 (kèm lý do, giá phải trả, cách quay lui) + 6 câu mới từ YC-P5-10…15. Trạng thái: ĐỀ XUẤT, chờ chủ chốt. -->

> **Trạng thái:** đề xuất. Chủ trả lời "OK cả bộ" hoặc nêu câu muốn đổi. Câu đã chốt ⇒ ghi ngày chốt vào cột cuối, cập nhật README §5.

## 1. Tám câu ban đầu

### Q-P5-1 — Cây gói: 14 hay ít hơn?

- **Đề xuất:** 10 gói phát hành + 4 đường con.
  - Gói phát hành: `contracts`, `platform`, `server`, `module-sdk`, `action-client`, `ui-kit`, `web-shell`, `testing`, `cli`, `reporting`.
  - `reporting` có ngay, vì YC-P5-13 đã nêu đủ hai app dùng: Kế toán và Kiot. Bản trước đề xuất hoãn — bỏ phương án hoãn.
  - Đường con của `platform`: `entity`, `master-data`, `documents`, `sync`.
- **Vì sao:**
  - Bốn phần kia cùng chạy trong một giao dịch CSDL, một RLS, một `defineAction`.
  - Tách thành gói thì phải chuyền kết nối / giao dịch qua ranh giới gói, sinh phụ thuộc vòng, và nhân bốn lần việc phát hành.
  - Ranh giới lớp giữ bằng bộ kiểm import (`kiem-khung`) là đủ.
- **Giá phải trả:** người đọc sơ đồ thấy 14 khối, trong repo chỉ có 10 thư mục gói. Bù bằng bảng ở [10](10-GOI-VA-LOP.md) §2.
- **Quay lui:** đường con đủ điều kiện G-1…G-4 thì tách thành gói, giữ đường cũ làm tệp chuyển tiếp một bản (R-CORE-2). App không phải sửa.

### Q-P5-2 — Tên API

- **Đề xuất:** dùng đúng tên chủ nêu: `defineEntity`, `extendEntity`, `registerField`, `registerRelation`, `registerValidator`, `defineScreen`. Thêm `defineReport`, `defineImport` (nếu cần tuỳ biến), `defineSetting`.
  - `registerScreens` (S003-3) giữ làm bí danh.
  - `registerModuleSettings` hiện có giữ, gọi qua `defineSetting`.
- **Vì sao:**
  - Thống nhất với lối đặt tên đang có (`defineAction`, `defineListAction`, `defineDocumentType`, `definePort`). Agent đoán được tên.
  - Quy ước: `define*` khai cái của mình; `extend*` / `register*` gắn vào cái của người khác.
- **Quay lui:** đổi tên = bí danh một bản phát hành.

### Q-P5-3 — Trường mở rộng lưu ở đâu?

- **Đề xuất:** ba chỗ, chọn theo khai báo `storage`.

  | `storage` | Dùng cho | Lưu ở |
  |---|---|---|
  | `meta` | ít trường, đơn giản | `entity_meta`, lõi hoá từ open-cake 0103 |
  | `extension` | nhiều trường / cần ràng buộc / chỉ mục | bảng riêng của app, một-một theo ID |
  | `column` | chỉ chủ dữ liệu | bảng chủ |

- **Vì sao:**
  - Dồn hết vào JSONB thì mất kiểu, mất ràng buộc, mất chỉ mục, và báo cáo phải bóc JSON.
  - Bắt mọi thứ thành cột thì app phải sửa bảng của chủ — trái R-CORE-8.
  - `meta` có giới hạn cứng: SC-ENT-5 cấm tiền / số lượng / trạng thái; SC-ENT-6 giới hạn 5 chỉ mục.
- **Giá phải trả:** đọc "đầy đủ" phải ghép tối đa ba nguồn. Lõi làm việc ghép, developer không làm.

### Q-P5-4 — Ghi sinh tự động cho lớp nào?

- **Đề xuất:** chỉ `config` và `record`.
  - `master`: chỉ action của chủ.
  - `replica`, `document`, `ledger`: không bao giờ.
- **Vì sao:** YC-P5-05. Ghi sai ở danh mục chủ / chứng từ / sổ là lỗi tiền bạc, không sửa bằng "undo" được. Hai lớp được mở ghi là dữ liệu cục bộ, rủi ro thấp, và vẫn đi qua `defineAction` (idempotency, quyền, audit).
- **Quay lui:** mở thêm lớp = sửa một bảng luật SC-ENT-1, cần ADR.

### Q-P5-5 — Màn khai ở máy chủ hay trình duyệt?

- **Đề xuất:** máy chủ (`defineScreen` trong module). Web-shell chỉ vẽ.
- **Vì sao:**
  - **Một nguồn** cho web-shell, MCP, agent và bộ kiểm.
  - **Lọc quyền trước khi tới trình duyệt:** nút không có quyền thì không có trong metadata.
  - **Bộ kiểm đọc được ở CI:** khai trong React thì không ai kiểm được.
- **Giá phải trả:** màn đặc thù vẫn cần React. Có lối thoát `views: ['custom']`.

### Q-P5-6 — Ai làm phần nào?

- **Đề xuất:**
  - lane **T**: Entity, View, Settings / Meta, Activity / Notification, Search / Import / Export, Reporting, Scoreboard DX.
  - lane **R**: Server, Module SDK, CLI, Testing, **Upgrade & Conformance** (vì lane R đã giữ bộ đo bất biến, kiểm ranh giới, ma trận, và là người phát hành).
  - **Bánh xe đóng góp** ([95](95-BANH-XE-DONG-GOP.md)): hai lane cùng giữ.
- **Vì sao:** khớp phần mỗi lane đang có công cụ và ngữ cảnh. Không giao một việc cho lane đang không giữ mã đó.

### Q-P5-7 — S003-3 (`registerScreens` / menu) bị chặn bởi claim NT-HT-003 của open-ketoan

- **Đề xuất:** lõi làm mới theo `defineScreen`, có bí danh. Không dời mã từ open-ketoan. open-ketoan chuyển màn của mình khi claim trả.
- **Vì sao:** chờ claim của repo khác thì cả L4 đứng. Làm mới trên lõi không đụng open-ketoan, nên không vượt R-FLOW.
- **Giá phải trả:** có thể có hai cách khai màn trong một thời gian (cách cũ ở open-ketoan, cách mới ở lõi). Đóng lại ở F5-2.

### Q-P5-8 — Scoreboard DX có chặn PR?

- **Đề xuất:** có, kiểu bánh cóc.
  - Điểm DX của module mẫu không được giảm.
  - Số dòng của tính năng vàng không được tăng.
  - Nợ viết tay ở app không được tăng.
- **Vì sao:** chỉ báo cáo thì không ai đọc. Bánh cóc đã chạy tốt với sổ nợ ranh giới (158 → 97 trong một ngày).
- **Giá phải trả:** PR muốn tăng nợ vì lý do chính đáng thì phải ghi miễn trừ có hạn (như `waivers` của `bizcity_module@1`).

## 2. Sáu câu mới (từ YC-P5-10…15)

| Mã | Câu hỏi | Đề xuất | Lý do ngắn |
|---|---|---|---|
| Q-P5-9 | Settings / Meta: thêm bảng mới hay dùng `setting_values` đang có? | **Dùng `setting_values` + thang phạm vi đang có**, thêm bậc `workspace` và `org`. "Trường phụ thuộc tổ chức" (Odoo company-dependent) = **giá trị trường theo bậc phạm vi**, lưu `entity_meta` có `scope` ([70](70-SETTINGS-META.md)) | lõi đã có registry cài đặt có phiên bản, căn cứ, ảnh hưởng, lịch sử; chỉ thiếu bậc và meta theo phạm vi |
| Q-P5-10 | Activity / Notification: gộp `document_activities`, `notifications`, `audit_logs` thành một bảng? | **Không gộp bảng.** Một **API** `activity.*` / `notify.*` trên mọi `EntityRef`. Ba bảng giữ vai riêng: hoạt động (người đọc) · thông báo (người nhận) · audit (bằng chứng, chuỗi băm). Thêm `entity_activities` cho thực thể không phải chứng từ ([75](75-ACTIVITY-NOTIFICATION.md)) | gộp làm audit mất tính chỉ-thêm-có-chuỗi-băm; tách API khỏi bảng là đủ thống nhất |
| Q-P5-11 | Nhập: ghi bằng gì? | **Mỗi dòng nhập = một lần gọi action ghi của thực thể**, chạy thử = cùng action ở chế độ `dryRun` (đã có trong `defineAction`), trong giao dịch huỷ. Không có đường INSERT thẳng ([80](80-SEARCH-IMPORT-EXPORT.md)) | YC-P5-12: nhập không được vượt kiểm chuẩn; dùng lại `dryRun` sẵn có |
| Q-P5-12 | Report: Core có tính số không? | **Không.** Core chạy truy vấn mà app khai (`defineReport.source`), áp quyền + phạm vi, nhóm / tổng / drill-down, in / xuất. Số liệu nghiệp vụ (BCTC) do app tính ([85](85-REPORTING.md)) | YC-P5-13; giữ R-CORE-8 |
| Q-P5-13 | Upgrade: quy trình 7 bước chạy ở đâu? | **Một lệnh `bizcity release check`** gọi 7 bước, dùng lại công cụ đang có (manifest validate, `standard-check`, `kiem-ranh-gioi`, diễn tập + `do-bat-bien`, `ma-tran --chay-that`); ra một báo cáo `bizcity_conformance_report@1` ([90](90-UPGRADE-CONFORMANCE.md)) | không viết công cụ mới khi đã có năm cái; chỉ nối thành dây chuyền |
| Q-P5-14 | Bánh xe đóng góp: bắt buộc hay khuyến khích? | **Bắt buộc ở mức "phải hỏi"**: PR ở app mà thêm thứ phổ thông (bảng / route / màn / cơ chế có trong danh sách TP hoặc trùng ≥ 2 app) phải trả lời ô "Lõi hay app?" trong mẫu PR; bộ dò "ứng viên lõi" đánh dấu tự động ([95](95-BANH-XE-DONG-GOP.md)) | bắt buộc chuyển lên lõi thì chậm app; không hỏi gì thì lõi không lớn |

## 3. Ghi chốt

| Câu | Chốt ngày | Phương án |
|---|---|---|
| Q-P5-1…14 | — | chờ |
