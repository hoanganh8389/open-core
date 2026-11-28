# Lane làm việc trên open-core — giao việc, ranh giới tệp, bàn giao

<!-- [2026-11-29 12:29 AM Johnny Chu - Chu Hoàng Anh] LANES — chủ (2026-11-29): "phiên kia tách rõ ranh giới open-core trong open-ketoan, sắp xếp lại để bảo đảm tương thích open-core trên repo mới; phiên này chuẩn hoá 3 trụ cột tại open-core — phân định bằng tài liệu giao việc, chia lane, handoff để không giẫm chân". -->

> **Đọc trước khi nhận việc ở open-core.** Mỗi việc thuộc đúng **một lane**. Việc của lane kia ⇒ không làm; cần thì ghi **yêu cầu** ở §6.
> Nguồn trạng thái từng việc vẫn là checklist của phase. Tệp này chỉ trả lời: *ai làm*, *được sửa tệp nào*, *bàn giao thế nào*.
> Giữ chỗ (R-FLOW): [CLAIMS.md](CLAIMS.md).

## 1. Hai lane

| | **Lane R — Ranh giới & tương thích open-ketoan** | **Lane T — Ba trụ cột dữ liệu** |
|---|---|---|
| Mục tiêu | lõi sạch nghiệp vụ kế toán (R-CORE-8); open-ketoan lên được Core release mà không đổi lịch sử sổ | chuẩn hoá ba trụ ở lõi: **Danh mục** (cơ chế định danh, ánh xạ, chủ dữ liệu) · **Chứng từ** (trục chứng từ chung) · **Đồng bộ** (sự kiện, feed, sổ nhận, đối soát) |
| Tài liệu gốc | [PHASE-004](PHASE-004-CORE-DOC-LAP/README.md) W1–W3 · [PHASE-001](PHASE-001-OPEN-KETOAN-TREN-OPEN-CORE/README.md) · [ADR-0001](../adr/ADR-0001-ranh-gioi-master-data.md) | [NC-008](https://github.com/hoanganh8389/bizcity-platform/tree/main/docs/research/NC-008-BA-TRU-COT-DU-LIEU) (chủ chốt ① 2026-11-28) · [PHASE-002](PHASE-002-DONG-DU-LIEU-XUYEN-APP/README.md) · PHASE-004 W4–W5 |
| Repo được đụng | open-core; open-ketoan theo R-FLOW của open-ketoan | open-core; bizcity-platform (chuẩn, vector); **không** đụng open-ketoan |
| Thư mục làm việc | `D:/projects/open-core` (và worktree riêng nếu cần) | **chỉ worktree** `D:/projects/oc-*`; không checkout / đổi nhánh trong thư mục của lane R |
| Phát hành | **lane R là người phát hành duy nhất** (bump phiên bản, `dist-release`, tag): 0.7.0 (W2-6), 0.8 (xoá khu cách ly) | không bump phiên bản; thay đổi đi theo bản phát hành kế tiếp của lane R |

## 2. Việc theo lane

### Lane R

| Việc | Mã |
|---|---|
| open-ketoan lên Core release: bản đồ tương thích, diễn tập trên bản sao CSDL, bộ đo bất biến L / D / H + nhóm M | S004-W1-1…7 |
| ranh giới Core: kiểm ranh giới + sổ nợ, kiểu bảng kế toán ra khu cách ly, `definePort`, móc khai báo, `masterdata/*` về Kernel, `@bizcity/accounting-contracts`, kiểm ranh giới chặn | S004-W2-1…8 |
| **cổng `MASTERDATA`** (ADR-0001 D5: `resolveItem`, `resolveEntity`, `orgSubtree`, `warehouseBranch`) + phạm vi vai đi qua cổng (B-15) | S004-W2-9 |
| Server / Module SDK | S004-W3-1…4 |
| PHASE-001 (open-ketoan bỏ nền riêng) | S001-* |
| ADR-0001 và mọi sửa đổi của nó | — |

### Lane T

Mã việc của lane T dùng tiền tố theo trụ: **`S004-DM-*`** (Danh mục) · **`S004-CT-*`** (Chứng từ) · **`S004-DB-*`** (Đồng bộ).

| Trụ | Việc | Mã | Gắn với |
|---|---|---|---|
| Danh mục | `newId(kind)` + vector ULID (TS; PHP qua chuẩn) | S004-DM-1 | NC-008 ADR-P2 · PR #29 |
| Danh mục | `entity_links` (lõi 0007) + `entityLinks.*` | S004-DM-2 | ADR-P6 · PR #29 |
| Danh mục | `data_authority` (lõi 0007, chỉ `local`) + `assertWritable` | S004-DM-3 | ADR-P3 · PR #29 |
| Danh mục | `defineAxis` + bảng bản sao theo khuôn spine §3; rút lớp mềm 0103 của open-cake | S004-DM-4 | ADR-P2 · S003-2 |
| Danh mục | `defineValidator` (cây không vòng, lỗi có trường + trace) | S004-DM-5 | ADR-0001 D3 MD-4 |
| Chứng từ | spine gọi `saveVersion` + tăng `version`; UNIQUE `doc_no`; liên kết `pending`; kiểu `LineSnapshot`; loại `catalog.proposal` (quản) | S004-CT-1…5 | NC-008 ADR-P4 · W4 của PHASE-004 |
| Chứng từ | `core.trace.lookup` qua `document_links` hai app | S004-W4-4 (= S002-5) | PHASE-002 |
| Đồng bộ | phong bì `bizcity_event@1` 1.4 + đăng ký loại sự kiện | S004-W5-1 | ADR-P5 |
| Đồng bộ | `event_inbox` | S004-W5-2 | ADR-P5 |
| Đồng bộ | `sync_changes` + con trỏ snapshot; `registerSyncFeed` (= S002-3); snapshot; `sync_cursors` | S004-W5-3 · S004-DB-1…3 | ADR-P5, Q-NC8-3/4 |
| Đồng bộ | `defineReconciler` (digest có băm, theo vùng) | S004-W5-4 | ADR-P5 |
| Đồng bộ | giao thức chuyển chủ `local → ketoan` (epoch, chặn chủ cũ) | S004-DB-4 | ADR-P3 §3 |
| Đồng bộ | gửi / nhận chứng từ xuyên app | S002-4 | PHASE-002 |
| Chuẩn | SPINE 1.3, MASTER-DATA 1.2, EVENT 1.4, DOCUMENT 1.6, ERRORS (lý do `AXIS_*`), **`bizcity_sync@1`** 0.1 + vector TS / PHP | NC8-STD-1…5 | bizcity-platform PHASE-001 |

**Không phải việc của open-core (cả hai lane):** open-ketoan khai loại chứng từ phản chiếu (S004-W4-3), open-cake chuyển sang đường chung (S004-W5-5 = S002-7) — làm ở repo app, theo CLAIMS của repo đó. Lane T chỉ ghi **bàn giao** (§5) cho repo đó.

## 3. Chỗ giáp ranh — đã chốt

| Chỗ | Quyết | Vì sao |
|---|---|---|
| Cổng `MASTERDATA` vs `entity_links` | **Hai thứ khác nhau, không thay nhau.** `MASTERDATA` (lane R) = tra danh mục **của chủ trong cùng tiến trình** (mặt hàng, đối tượng, cây đơn vị). `entity_links` (lane T) = **ánh xạ ID xuyên instance** (ID của app này ↔ ID / mã ở app kia). Lane T không thêm hàm tra danh mục thứ hai; lane R không lưu ánh xạ xuyên instance trong cổng. | ADR-0001 D5 · NC-008 ADR-P6 |
| "Lõi không tạo bảng danh mục" (ADR-0001 D2) | `entity_links`, `data_authority`, `event_inbox`, `sync_changes`, `sync_cursors` là **bảng cơ chế**, không phải bảng danh mục ⇒ đúng D2. Lane T không bao giờ tạo bảng hàng / ĐVT / đối tác / kho ở lõi. | ADR-0001 D2 · NC-008 Q-NC8-2 |
| ADR-0001 D4 "app làm chủ tạm, khi nối kế toán thì đối chiếu, kế toán thắng" | **Lane T hiện thực giao thức** (S004-DB-4: epoch, đóng băng, đề xuất ánh xạ, chặn chủ cũ). Lane R giữ **quyết định** ở ADR-0001; đổi D4 ⇒ hỏi lane T trước. | NC-008 ADR-P3 §3 |
| Giao thức đồng bộ ("W5" ở ADR-0001 D1) | thuộc **lane T**; số đợt theo PHASE-004 (W5), không theo NC-008 (W4). | — |
| Bất biến MD-1…MD-5 (ADR-0001 D3) | lane R **đo** (bộ đo bất biến nhóm M); lane T **bảo đảm bằng mã** (`newId`, `defineValidator`, không xoá). | — |
| ADR mới | lane R: ADR-0001. **Lane T giữ số ADR-0002** (ánh xạ + chủ dữ liệu theo trục), **ADR-0003** (đồng bộ: feed, con trỏ, sổ nhận, đối soát), **ADR-0004** (chứng từ quản / phản chiếu). Số kế tiếp: giữ chỗ ở CLAIMS trước khi viết. | tránh trùng số |

## 4. Tệp dùng chung — luật sửa

Lane nào sửa tệp chung cũng theo đúng luật dưới. Xung đột merge ở các tệp này ⇒ **giữ cả hai phần**, không chọn một bên.

| Tệp | Chủ | Lane kia được làm |
|---|---|---|
| `packages/platform/db/migrations/NNNN_*.sql` (một dãy số cho cả lõi) | ai giữ số ở CLAIMS | **giữ số trước ở CLAIMS rồi mới viết**; không dùng số chưa giữ; số đã giữ mà PR đóng thì nhả ở CLAIMS. Đang giữ: 0007 (lane T, PR #29) |
| `packages/platform/src/db/migrate-ketoan-legacy.ts` (`CORE_COVERED_BY_KETOAN`) | R | T **chỉ thêm một dòng** cho migration mới của mình, giá trị mặc định "chờ open-ketoan lên lõi"; đổi giá trị dòng đã có = việc của R |
| `packages/platform/src/db/types.ts` | R (khu cách ly `ketoan-legacy`) | T **chỉ thêm** kiểu bảng cơ chế của mình, khối có dấu `S004-DM/CT/DB`; không dời, không xoá kiểu khác |
| `packages/contracts/src/errors.ts` (`ERROR_REASONS`, `ERROR_CATALOG`) | chung | **chỉ thêm** mã; không đổi / xoá mã đã có; mã mới phải lên BIZCITY-ERRORS ở chuẩn |
| `packages/contracts/src/index.ts` | chung | chỉ thêm một dòng `export *` |
| `packages/platform/src/core/ports.ts` | R | T dùng `definePort` như người dùng thường; không sửa |
| `packages/platform/src/core/document-spine.ts`, `documents.ts`, `events.ts` | **T** | R chỉ sửa khi dời mã kế toán ra (B-*), báo trước ở §6 |
| `packages/platform/test/nen-tang.test.mjs` (danh sách bảng, migration) | chung | chỉ thêm tên |
| `tools/kiem-ranh-gioi.mjs`, `docs/scoreboard/ranh-gioi.json` | R | T chạy `--check`; **không được làm tăng** số vi phạm; không sửa sổ nợ |
| `tools/scoreboard.mjs`, `docs/scoreboard/*` (bảng điểm) | R | T chạy `--check`; sinh lại bảng điểm chỉ khi lane R chưa có PR đang mở chạm tệp đó |
| `AGENTS.md`, `docs/ARCHITECTURE.md` | chung | thêm luật mới (R-CORE-n) = một dòng, có dấu R-SIG; số R-CORE kế tiếp giữ ở CLAIMS |
| `CHANGELOG.md` | chung | mỗi lane một khối `### Thêm (<mã việc> — …)` riêng dưới `[Chưa phát hành]`; không sửa khối của lane kia |
| `docs/phases/PHASE-004-CORE-DOC-LAP/CHECKLIST.md` | chung | mỗi lane chỉ sửa dòng của mình (§2); nhóm W1–W3 = R, nhóm W4–W5 + DM / CT / DB = T |
| `package.json`, `packages/*/package.json`, `pnpm-lock.yaml`, `dist-release/` | **R** (phát hành) | T không đổi phiên bản; thêm phụ thuộc cần ADR (R-PLAT-5) và báo R ở §6 |

## 5. Bàn giao (handoff)

**Khi nào:** cuối mỗi phiên, và mỗi khi merge một PR làm thay đổi một tệp chung ở §4.

**Ở đâu:** thêm một khối vào §8 tệp này (mới nhất ở trên), trong cùng PR với việc đó hoặc một PR chỉ-tài-liệu.

**Khuôn:**

```text
### <YYYY-MM-DD HH:MM AM/PM> · lane <R|T> · <mã việc>
- PR: #…  (trạng thái: mở / đã merge @ <sha>)
- Tệp chung đã chạm: <tệp> — <thêm gì>
- Số đã giữ / nhả: migration 00NN · ADR-NNNN · R-CORE-n
- Kiểm: <lệnh> → <ĐẠT / KHÔNG ĐẠT / BỎ QUA + số>
- Lane kia cần biết / cần làm: <…>   (không có ⇒ "không")
- Việc kế tiếp của lane: <…>
```

**Bàn giao sang repo app** (open-cake, open-ketoan, open-kiot): không sửa repo đó; ghi khối bàn giao ở đây với dòng `Repo nhận: <repo> · việc đề xuất: <…>`, và báo chủ để mở claim ở repo đó.

## 6. Yêu cầu giữa hai lane

| Ngày | Từ → tới | Yêu cầu | Trạng thái |
|---|---|---|---|
| 2026-11-29 | T → R | ADR-0001 D1 "Khung sở hữu — Cơ chế": thêm `entity_links` + `data_authority` (bảng cơ chế, ADR-0002 của lane T) để ADR không ngầm hiểu "lõi không có bảng nào cho danh mục". Không chặn PR #30 — sửa sau cũng được. | **xong** (R, #30: D1 ghi hai bảng cơ chế; D5 ghi `MASTERDATA` ≠ `entity_links`) |
| 2026-11-29 | T → R | Tên mã: ADR-0001 dùng **MD-1…MD-5** cho **bất biến**. Lane T đã đổi mã việc từ `S004-MD-*` sang **`S004-DM-*`**; mã nghiệm thu của NC-008 viết hai chữ số (**MD-01…07**) là **ca kiểm**. Đề nghị giữ ba nghĩa này, không dùng lại. | **xong** (R, #30: ghi ở đầu D3; bộ đo nhóm M dùng mã mục `M-n`, ghi bất biến `MD-n`) |
| 2026-11-29 | T → R | Khi lane R mở 0.7.0: kèm migration 0007 và `core/master-data.ts` nếu PR #29 đã merge; ghi `0007` vào ghi chú phát hành và vào bộ đo bất biến nếu đo bảng mới. | **bộ đo xong** (R, #32: W-4 `entity_links` rỗng, W-5 `data_authority` rỗng sau nâng cấp) · ghi chú 0.7.0: khi phát hành |

## 7. Đường bắt kịp của open-ketoan — tách khỏi kế toán mà không vấp mã mới của lõi

<!-- [2026-11-29 12:38 AM Johnny Chu - Chu Hoàng Anh] LANES §7 — chủ: "bảo đảm phiên kia cứ tách ra khỏi open-ketoan và bắt kịp đà nâng cấp tiếp theo của open-core mà không bị conflict, phương án cụ thể". -->

**Ý chính:** open-ketoan **không đuổi theo `main`** của open-core. Nó chỉ nhận lõi qua **bản phát hành** (tgz ghim số) do lane R cắt. Lane T làm trên `main` nhưng phải giữ hai cam kết:
- mọi thay đổi **chỉ thêm**;
- mọi migration mới **không chạy trên CSDL kế toán** khi chưa được nhận.

Nhờ vậy, mỗi lần lane R nâng open-ketoan chỉ phải xử lý **một khoảng chênh đã biết**, không phải một `main` đang chạy.

### 7.1 Bốn cam kết của lane T (mỗi PR)

| # | Cam kết | Cách kiểm (bắt buộc trước khi merge) |
|---|---|---|
| T-1 | **Chỉ thêm ở API công khai** | chạy `pnpm run ma-tran -- --ketoan <bản open-ketoan> --only ketoan` trên nhánh **và** trên worktree `origin/main`; lọc dòng `✗`, sắp, `diff`. Đạt khi: **khớp tên thiếu 0** và **danh sách ✗ giống hệt `origin/main`** (không thêm lỗi nào). Đo 2026-11-29 trên `main` @ `9fcd67d`: khớp tên 647 import · thiếu 0; khớp kiểu "MỚI 7" — 7 lỗi có sẵn của lane R (authz legacy, chữ ký `migrate`), **không do lane T**. Khi lane R đưa "MỚI" về 0 (PHASE-001 B2), cổng đổi thành `--strict` phải ĐẠT. |
| | — mã mới vào đường con mới (`core/master-data`, `core/sync/*`…); | |
| | — không đổi chữ ký / không xoá export mà open-ketoan hoặc open-cake đang import; | |
| | — bắt buộc đổi ⇒ tệp chuyển tiếp một bản phát hành (R-CORE-2) + một dòng ở §6 gửi lane R. | |
| T-2 | **Migration lõi mới = "chờ" trên CSDL kế toán**: thêm dòng `CORE_COVERED_BY_KETOAN` với giá trị "chờ open-ketoan lên lõi" | test `migrate.test.mjs` (đã có, chặn nếu thiếu quyết định). |
| | — kế toán nhận bảng khi nào là việc của lane R / open-ketoan, qua R-FLOW; | |
| | — lõi nâng phiên bản **không bao giờ** tự đổi CSDL kế toán. | |
| T-3 | **Không chạm khu cách ly**: không import, không thêm, không sửa `packages/platform/src/ketoan-legacy/**` và các tệp trỏ `masterdata/*`. Đó là vùng lane R đang dời về Kernel kế toán. | `git diff --name-only origin/main` không có đường đó; `kiem-ranh-gioi --check` không tăng. |
| T-4 | **Dây tương thích ngược với feed kế toán đang chạy** | vector SC-SPINE-5 của bizcity-platform vẫn ĐẠT với feed hiện tại của open-ketoan. |
| | — `registerSyncFeed`, con trỏ, phong bì 1.4 phải đọc được feed `/api/v1/sync/:axis` hiện tại của open-ketoan (con trỏ cũ `<updated_at>\|<id>` nhận trong thời gian chuyển, NC-008 Q-NC8-4); | |
| | — kế toán không phải đổi feed để lõi mới chạy. | |

### 7.2 Nhịp phát hành và nâng cấp (lane R chủ trì)

Mỗi bản phát hành lõi đi bốn bước:

1. **Đóng gói.**
   - Lane R gom `main` (gồm cả việc lane T đã merge), chạy `pnpm test` có CSDL, `ma-tran --chay-that`, rồi đóng tgz.
   - Ghi chú phát hành có mục **"Nâng cấp open-ketoan"**:
     - migration mới và quyết định `coveredBy`;
     - API thêm / deprecated;
     - codemod (`tools/doi-nguon/ketoan-<bản>.mjs`) nếu có đổi đường nhập.
2. **Diễn tập.**
   - Trên bản sao CSDL kế toán: `tools/dien-tap/do-bat-bien` đo trước → nâng → đo sau.
   - Lệch ngoài danh sách trắng ⇒ không lên.
   - Bảng cơ chế của lane T là "bảng mới rỗng" — đã nằm trong danh sách trắng.
3. **Đổi số ghim ở open-ketoan** (một PR theo R-FLOW của open-ketoan): tgz mới + codemod + test của kế toán.
4. **Ghi nhận:** một khối bàn giao ở §8, kèm số bản lõi mà open-ketoan đang ghim.

Lane T **không** phát hành và không đổi số ghim của app.

Lane T muốn một việc vào bản kế tiếp ⇒ merge trước khi lane R đóng gói và ghi ở §6.

### 7.3 Cửa sổ đóng băng

Lane R báo đóng băng ở §6 (ngày giờ bắt đầu, dự kiến kết thúc, tệp chung bị khoá) khi đang:
- đổi nguồn gói open-ketoan sang lõi (PHASE-001 B3 / B4);
- cắt bản phát hành;
- xoá khu cách ly.

Trong cửa sổ đó, lane T **không merge** PR chạm tệp chung ở §4. Lane T vẫn mở PR, vẫn làm trong tệp riêng của trụ.

### 7.4 Nhịp gộp hằng ngày (cả hai lane)

- **Trước khi mở PR:**
  - `git merge origin/main` vào nhánh của mình;
  - chạy `pnpm test` có `TEST_DATABASE_URL`, 0 bỏ qua;
  - chạy `ma-tran` (T-1).
- PR nhỏ, merge sớm; không để nhánh sống quá một ngày khi có chạm tệp chung.
- Xung đột ở tệp chung ⇒ giữ cả hai phần (§4); chạy lại test sau khi gỡ.
- **Mỗi lane chỉ làm trong thư mục làm việc của mình** (§1). Cần xem `main` thì dùng worktree riêng, không `checkout` trong thư mục của lane kia.

### 7.5 Khi nào trụ cột vào open-ketoan

- **Trước khi open-ketoan lên lõi** (claim B1 chưa trả):
  - kế toán giữ `sync.service.ts` và ánh xạ riêng;
  - lõi chỉ cam kết T-4 (dây tương thích);
  - phần Cake / Kiot dùng **kế toán giả** đúng hợp đồng.
- **Sau khi open-ketoan ghim bản lõi có trụ cột:** lane R (hoặc phiên của open-ketoan) mở việc ở open-ketoan theo NC-008 W5:
  - feed qua `registerSyncFeed`;
  - sửa ID trên dây (Q-NC8-7);
  - đổi `coveredBy` của 0007 / bảng đồng bộ thành tên migration tương đương của kế toán.
  - Lane T chỉ bàn giao (§5), không sửa open-ketoan.

## 8. Nhật ký bàn giao

### 2026-11-29 12:38 AM · lane T · merge #29 #31 + phương án bắt kịp (§7)
- PR: #31 (LANES) đã merge @ `fb0e3c8`; #29 (S004-DM-1…3) đã merge @ `9fcd67d`; bizcity-platform #44 (NC-008) đã merge.
- **CI GitHub không chạy** ở cả ba PR và ở mọi lần merge `main` gần đây: *"The job was not started because your account is locked due to a billing issue"*.
  - Bằng chứng là kiểm tại máy: `pnpm test` 82 / 82 ĐẠT, 0 bỏ qua; `standard-check` 0 chặn.
- **Sự cố:** lane T đã lỡ `git checkout --detach origin/main` trong `D:/projects/open-core` (thư mục lane R) khoảng một phút.
  - Đã trả lại `feat/s004-w1-3b-do-bat-bien-v2` @ `e352d30`. Thư mục không có thay đổi chưa commit, không mất gì.
  - Nếu lane R thấy gì lạ trong khoảng 12:36–12:38 AM thì do việc này. Luật §7.4 dòng cuối viết ra từ sự cố này.
- Lane kia cần biết / cần làm:
  - đọc §7; xác nhận T-1…T-4 và quy trình 7.2;
  - khi cắt 0.7.0, thêm mục "Nâng cấp open-ketoan" (0007 = chờ, `core/master-data` thêm mới);
  - `ma-tran --only ketoan --strict` trên `main` @ `9fcd67d` đang **KHÔNG ĐẠT** vì 7 lỗi kiểu có sẵn (khớp tên 647 · thiếu 0). Đưa 7 lỗi này về 0 là việc của lane R (PHASE-001 B2); tới lúc đó T-1 dùng so danh sách với `origin/main`.
- Việc kế tiếp của lane T: S004-DM-4 (`defineAxis`) — giữ số migration ở CLAIMS khi cần.

### 2026-11-29 12:39 AM · lane R · ADR-0001 + S004-W1-3b / 3c / 5a
- PR: [#30](https://github.com/hoanganh8389/open-core/pull/30) (mở) — ADR-0001 + R-CORE-9, đã gộp main (LANES, #29) và làm hai yêu cầu §6; [#32](https://github.com/hoanganh8389/open-core/pull/32) (mở, chồng #30) — bộ đo bản 2, `do-api.mjs`, `dien-tap.mjs`.
- Tệp chung đã chạm: `AGENTS.md` — thêm R-CORE-9 (#30) · `CHANGELOG.md` — khối riêng S004-W1-3b (#32) · CHECKLIST PHASE-004 — dòng W1-3b / 3c / 5a (nhóm W1, của R).
- Số đã giữ / nhả: ADR-0001 · R-CORE-9 (đã ghi ở CLAIMS); không giữ migration.
- Kiểm: `pnpm test` có CSDL → ĐẠT (84 / 84 trước khi gộp main; chạy lại sau gộp ở PR).
- Lane kia cần biết / cần làm: bộ đo có W-4 / W-5 (hai bảng 0007 phải rỗng sau nâng cấp open-ketoan) — nếu lane T đổi 0007 để đổ dữ liệu sẵn thì báo R sửa hai mục này.
- Việc kế tiếp của lane: S004-W2-9 cổng `MASTERDATA` + phạm vi vai qua cổng (B-15) — chỉ dùng `definePort`, không đụng `entity_links`.

### 2026-11-29 12:29 AM · lane T · LANES + S004-DM-1…3
- PR: [#29](https://github.com/hoanganh8389/open-core/pull/29) (mở) — `newId`, `entity_links`, `data_authority`; PR tài liệu này (mở).
- Tệp chung đã chạm (PR #29): migration **0007** · `migrate-ketoan-legacy.ts` thêm dòng `0007` = "chờ" · `types.ts` thêm `EntityLinksTable`, `DataAuthorityTable` · `ERROR_REASONS` thêm `AXIS_READ_ONLY`, `AXIS_TRANSFERRING` · `nen-tang.test.mjs` thêm 2 bảng + 0007 · CHANGELOG khối riêng · CHECKLIST PHASE-004 nhóm DM / DB.
- Số đã giữ: migration 0007 · ADR-0002, 0003, 0004.
- Kiểm (PR #29): `pnpm test` 72 / 72 ĐẠT, 0 bỏ qua (Postgres 16 thật) · `standard-check` ĐẠT 0 chặn · `ma-tran`: open-cake 0 lỗi kiểu mới; open-ketoan 7 lỗi kiểu = y hệt `origin/main`.
- Lane kia cần biết / cần làm: ba yêu cầu ở §6. PR #29 sửa `migrate-ketoan-legacy.ts` và `types.ts` — lane R đang có thay đổi lớn ở hai tệp này (W2-2) ⇒ ai merge sau thì gộp cả hai phần.
- Việc kế tiếp của lane T: S004-DM-4 (`defineAxis`) sau khi #29 merge; song song NC8-STD (chuẩn `bizcity_sync@1`) ở bizcity-platform.
