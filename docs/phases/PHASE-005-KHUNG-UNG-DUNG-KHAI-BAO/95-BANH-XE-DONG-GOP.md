# PHASE-005 · 95 — Bánh xe đóng góp: làm app thì lõi lớn lên

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-15 (chủ: "quan trọng nhất"): dev tối ưu open-ketoan / open-cake / open-kiot thì đồng thời hoàn thiện open-core. -->

## 1. Vì sao bánh xe hay kẹt

Ba thứ làm dev app **không** đẩy lên lõi:

1. **Không biết** thứ mình đang viết là phổ thông. Không ai nói "cái này lõi nên có".
2. **Đẩy lên lõi chậm:** phải sang repo khác, đợi phát hành, đổi số ghim. Viết tại chỗ nhanh hơn.
3. **Không ai thấy công:** rút lên lõi tốn thêm việc mà không có điểm.

Bánh xe chỉ quay khi cả ba được gỡ: **nhận ra tự động**, **đường lên lõi ngắn**, **có điểm**.

## 2. Vòng quay (bốn bước, mỗi bước có công cụ)

```text
 ① VIẾT Ở APP ──► ② NHẬN RA ──► ③ RÚT LÊN LÕI ──► ④ APP XOÁ BẢN RIÊNG ──┐
      ▲                                                                   │
      └──────────── app sau dùng lõi, viết ít hơn (Scoreboard DX tăng) ◄──┘
```

### ① Viết ở app — luật "Lõi trước" (đề xuất R-CORE-10)

Trước khi viết một thứ **phổ thông** (có trong 24 thao tác TP-01…24 của [60](60-SCOREBOARD-DX.md), hoặc trong 20 mục ERP-12), dev / agent:

1. Tra lõi: `bizcity doctor --tim <từ khoá>` liệt kê API lõi liên quan, đọc từ registry + chỉ mục export.
2. Lõi có ⇒ **dùng**, không viết lại.
3. Lõi chưa có ⇒ chọn **một** trong ba đường, ghi vào mẫu PR ô "Lõi hay app?":

   | Đường | Khi nào | Làm gì |
   |---|---|---|
   | **A — viết thẳng vào lõi** | ≥ 2 app cần ngay, hoặc là hạ tầng chung (R-PLAT-3) | mở PR ở open-core trước; app dùng bản `core-dev` (§3) trong lúc chờ phát hành |
   | **B — ứng viên lõi** | mới một app cần nhưng rõ là phổ thông | viết ở app, trong thư mục `src/core-candidate/`, đầu tệp có dấu `@bizcity-core-candidate <TP-mã \| mô tả>`; **không** chứa chuỗi nghiệp vụ cứng (R-PLAT-1) để rút lên được nguyên tệp |
   | **C — nghiệp vụ** | chỉ app này có nghĩa | viết ở app như thường |

### ② Nhận ra — tự động, không trông vào trí nhớ

Thêm `tools/ung-vien-loi.mjs` ở open-core. Nó chạy trên bản chép các app giống `ma-tran`, mỗi tuần và trước mỗi bản phát hành:

| Dò | Cách |
|---|---|
| ứng viên đã đánh dấu | tệp có `@bizcity-core-candidate` |
| **trùng giữa app** | băm hàm / tệp đã chuẩn hoá (bỏ tên biến, chú thích); cùng băm ở ≥ 2 app ⇒ ứng viên mạnh |
| nợ viết tay (Scoreboard DX) | route không qua `defineAction`, zod trùng hình thực thể, màn React tự vẽ list / form |
| bảng trùng khái niệm lõi | bảng app có cột giống `entity_meta`, `notifications`, `activities`, `import_jobs`… |

Kết quả là **bảng "Ứng viên lõi"** trong `docs/scoreboard/`, xếp theo điểm = (số app có) × (số dòng có thể xoá). Mười dòng đầu thành việc của lane T ở đợt kế tiếp.

### ③ Rút lên lõi — đường ngắn

- **PR ở open-core**, khuôn "rút":
  - tệp gốc;
  - bỏ chuỗi nghiệp vụ;
  - thêm test chạy thật;
  - ghi **app nguồn** trong CHANGELOG ("rút từ open-cake `src/core-candidate/x.ts` @ sha").
- **Không chờ cả bản phát hành mới thử được.** Dev app bật **chế độ `core-dev`**: `bizcity dev link-core ../open-core` đặt `pnpm.overrides` / `npm` link trỏ gói lõi về thư mục open-core cạnh bên, **chỉ ở máy dev**.
  - Sửa lõi ⇒ app chạy ngay.
  - CI và bản phát hành vẫn dùng tgz ghim (LANES §7), nên không ai vô tình ship lõi chưa phát hành.
  - `ma-tran` chạy ngược lại: PR lõi đó phải không làm vỡ app khác.
- Lane T (hoặc lane R, nếu thuộc phần của R) **duyệt trong 1 ngày làm việc** với PR có nhãn `rut-len-loi`. Rút chậm thì dev quay lại viết tại chỗ.

### ④ App xoá bản riêng

- **Bản lõi kế tiếp kèm codemod nếu đổi đường import** (`tools/doi-nguon/<app>-<bản>.mjs`, như `ketoan-0.7.mjs`).
- **App đổi sang API lõi, xoá tệp `core-candidate`.** Scoreboard DX của app tăng, vì nợ viết tay giảm.

## 3. Điểm và tầm nhìn

- **Scoreboard thêm mục "Đóng góp lõi"**, mỗi app có ba chỉ số:
  - số thứ đã rút lên lõi;
  - số dòng đã xoá ở app nhờ dùng lõi;
  - số ứng viên đang chờ.
- **Ghi chú phát hành lõi** có mục "Đến từ app": rút từ open-ketoan / open-cake / …
- **Màn Tình trạng nền tảng (f5)** hiện bảng ứng viên lõi. Người làm app thấy thứ mình viết có thể lên lõi.

## 4. Gắn vào từng repo app (chỉ đề xuất — sửa repo app theo R-FLOW của repo đó)

Lane T **không** sửa repo app. Đề xuất cho chủ mở claim ở mỗi repo:

1. **AGENTS.md của app:** khối "Lõi trước", văn bản chung do open-platform phát.
   - Gồm: luật R-CORE-10 + ba đường A / B / C + lệnh `bizcity doctor --tim` + đường tới LANES / CLAIMS của open-core.
   - Đề xuất open-platform thêm luật **SC-STD** "app Node có khối Lõi trước trong AGENTS.md". `standard-check` sẽ nhắc mọi app, kể cả app mới (HRM, MRP).
2. **Mẫu PR** (`.github/pull_request_template.md`) có ô "Lõi hay app? A / B / C + lý do".
3. **`src/core-candidate/`** + dấu `@bizcity-core-candidate`.
4. **Script `dev:link-core`** trong `package.json` của app.

## 5. Với open-ketoan, cụ thể

- Lane R đang **tách** phần lõi ra khỏi open-ketoan (khu cách ly `ketoan-legacy`, `masterdata/*`). Đó là bánh xe chạy theo chiều "trả về app".
- Chiều ngược lại — kế toán có thứ phổ thông mà lõi chưa có — đi đúng vòng §2. Ứng viên đã thấy từ khảo sát:
  - **bộ nhập có chạy thử** (P7 mức 3 ở kế toán, 0 ở lõi) ⇒ nguồn cho S005-F2-3;
  - **khung phiếu `DocSheet`** (`@bizcity/ui-kit` 1.5.0-draft ở kế toán) ⇒ nguồn cho F3-2;
  - **`registerScreens` / menu** (S003-3) ⇒ F3-1;
  - **`packages/cli`** ⇒ S005-ML-3.
- Bốn thứ này **rút lên lõi theo đường A / B**, không viết lại từ đầu ở lõi, khi claim của open-ketoan cho phép. Trong lúc chờ claim, lõi làm bản mới tương thích (Q-P5-7).
