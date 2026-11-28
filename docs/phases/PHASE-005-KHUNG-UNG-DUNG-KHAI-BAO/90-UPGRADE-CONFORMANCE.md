# PHASE-005 · 90 — Upgrade & Conformance Framework: quy trình phát hành chuẩn

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-14: migration theo phiên bản module, kiểm thử nâng cấp, đo bất biến, kiểm ranh giới, ma trận tương thích ⇒ một dây chuyền 7 bước. Mã thuộc lane R (Q-P5-6). -->

## 1. Bảy bước ↔ công cụ đã có

Năm trong bảy bước **đã có công cụ chạy thật**. Việc chính là nối chúng thành **một lệnh** ra **một báo cáo**.

| # | Bước (sơ đồ của chủ) | Công cụ | Có chưa | Chặn khi |
|---|---|---|---|---|
| 1 | **Module Manifest** | `bizcity-manifest-validate` / `defineModule` kiểm lúc nạp (`bizcity_module@1`) | có (open-ketoan), cần lõi hoá | manifest sai schema, action / entity / screen không khai |
| 2 | **Dependency Check** | `requires.core` + `requires.modules` ([50](50-MODULE-LIFECYCLE.md) §4) | **chưa** | thiếu module / lệch semver / vòng phụ thuộc |
| 3 | **Contract Conformance** | `standard-check` (open-platform), `kiem-khung`, `kiem-ranh-gioi --check`, `scoreboard --check`, Conformance Gate SC-ENT / SC-MOD | có (trừ SC-ENT / SC-MOD) | lỗi chặn của chuẩn; vi phạm ranh giới tăng |
| 4 | **Migration Dry-run** | chạy migration của bản mới **trên bản sao CSDL** trong giao dịch rồi huỷ, hoặc trên CSDL tạm dựng từ bản sao | có một phần (`tools/dien-tap`, 20-DIEN-TAP) | migration lỗi; khoá bảng quá lâu (đo thời gian) |
| 5 | **Data Invariant Check** | `tools/dien-tap/do-bat-bien` — đo trước / sau, `--so` | có (S004-W1-3) | lệch ngoài danh sách trắng |
| 6 | **Integration Test** | `pnpm test` có CSDL (0 bỏ qua) + `ma-tran --chay-that` (tgz thật vào open-cake / open-ketoan) + bài tính năng vàng | có | test đỏ; lỗi kiểu mới ở app |
| 7 | **Release / Deployment** | `dong-goi` (tgz), CHANGELOG + mục "Nâng cấp app", tag; deploy do người vận hành, **không tự động** | có một phần | thiếu ghi chú nâng cấp; bước 1–6 chưa ĐẠT |

## 2. Một lệnh, một báo cáo

```bash
bizcity release check --from 0.7.0 --to 0.8.0 --db-copy <bản sao> --apps ../open-cake,../open-ketoan
```

- **Chạy tuần tự 1 → 6.** Bước đỏ ⇒ dừng, in lý do và cách sửa.
- **Ra `release-report.json`** theo `bizcity_conformance_report@1` (đã có chuẩn ở open-platform):
  - từng bước, lệnh đã chạy, `PASS` / `FAIL` / `SKIP`, số liệu, thời gian, SHA;
  - `SKIP` **không bao giờ** tính là `PASS`, giống luật bằng chứng.
- **Bước 7 chỉ mở khi báo cáo có 6 `PASS`.** Tag mang băm của báo cáo.

## 3. Migration theo phiên bản module

- Mỗi module một dãy migration (đã có `sources`).
- **Thêm:** manifest khai `migrations.since` cho mỗi bản, nên khi nâng từ bản A lên bản C, lõi biết chạy những tệp nào.
- **Tệp đã phát hành không bao giờ sửa** (NC-008 ADR-P7). Sửa = tệp mới.
- **Mỗi migration khai `reversible: true | false`.** Không đảo được thì bắt buộc qua bước 4 trên bản sao thật trước khi phát hành.
- **Migration dài** (backfill) đi theo khuôn **expand → backfill theo lô, có điểm dừng → so khớp → chuyển → bỏ cũ** (ADR-P7). Bước backfill chạy như việc nền, không chạy trong lúc khởi động.

## 4. Kiểm thử nâng cấp

- **Bộ CSDL mẫu theo bản:** lưu bản sao rút gọn ở mỗi bản phát hành (fixture, không có dữ liệu thật). Nâng cấp được kiểm **từ mọi bản còn hỗ trợ** (N-1, N-2) lên bản mới, không chỉ từ bản ngay trước.
- **Nâng cấp bị ngắt giữa chừng** (MIG-02 của NC-008): giết tiến trình giữa migration ⇒ chạy lại phải đi tiếp hoặc báo rõ bước sửa tay.

## 5. Ai làm

- Lane **R**: dây chuyền, `bizcity release check`, Dependency Check, bộ CSDL mẫu. Lane R đang giữ bộ đo bất biến, ma trận, phát hành.
- Lane **T**: Conformance Gate SC-ENT-*, bài tính năng vàng, Scoreboard DX ở bước 3 / 6.
