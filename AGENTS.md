# AGENTS.md — open-core

<!-- [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] C1 — luật cho người và agent làm trên mã lõi; R-PLAT-1…5 chép nguyên mã từ bizcity-platform (không đặt lại). -->

Đọc: [README](README.md) → [NC-003](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-003-TACH-OPEN-CORE.md) (kế hoạch C0–C8) → [canon §2.2](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md) → [bản đồ chuẩn](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/README.md).

## Vị trí

**open-platform** (`bizcity-platform`: chuẩn + bộ kiểm) quy định → **open-core (repo này)** hiện thực và phải qua bộ kiểm đó → app = open-core + module → **open-setup** cấp instance. Repo này **không** chứa chuẩn (đổi chuẩn ⇒ PR ở open-platform trước) và **không** chứa nghiệp vụ.

## Luật

- **R-PLAT-1** không import gói nghiệp vụ (`@ketoan/*`, `@open-ketoan/*`, `@cake/*`, `@open-cake/*`); không chuỗi nghiệp vụ cứng (`ketoan`, `crm`, `kt_`, `cake_`) — đọc từ `PlatformConfig` / cấu hình app. `tools/kiem-khung.mjs` chặn.
- **R-PLAT-2** app gắn nghiệp vụ qua cổng đăng ký (`register*`, migration `sources` + `hooks`, `AppDatabase` gộp khai báo).
- **R-PLAT-3** thêm vào lõi chỉ khi ≥ 2 app cần hoặc là hạ tầng chung theo canon; ADR ở `docs/adr/`.
- **R-PLAT-4** mọi thay đổi: dấu R-SIG `[YYYY-MM-DD HH:MM AM/PM Johnny Chu - Chu Hoàng Anh] <CODE> — …` theo giờ máy thật (**không** tên agent / model), mức K0–K3, CHANGELOG, test ma trận app đang dùng (open-cake; open-ketoan từ C6).
- **R-PLAT-5** không thêm phụ thuộc khi chưa có lý do trong ADR.
- **R-CORE-1** một số phiên bản cho mọi `packages/*/package.json` (Q-CORE-4); `tools/kiem-khung.mjs` chặn lệch.
- **R-CORE-2** đường con công khai đang được app dùng (`db/client`, `core/actions`, `core/auth`, `core/errors`, `db/module-db`…) giữ nguyên tới 1.0; đổi ⇒ tệp chuyển tiếp một bản + CHANGELOG.
- **R-CORE-3** migration lõi ở `migrations/core/`, theo dõi có cột `source`; không giả định dãy số của app.
- Chỉ qua PR; không đẩy thẳng `main` khi đã có mã. Không ghi attribution AI vào commit / PR.

## Trước khi xong việc

```bash
pnpm install
pnpm test                                                     # kiem-khung + test các gói
node ../bizcity-platform/tools/standard-check.mjs --repo .    # bộ kiểm của open-platform
```
