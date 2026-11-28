# PHASE-001 — open-ketoan chạy trên open-core (chuẩn lõi, không đổi hành vi sổ)
<!-- [2026-11-28 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 — chủ (2026-11-28): "để open-ketoan chuẩn core chạy được, lập tài liệu phân tích, tiếp theo docs/phases, phương án, vấn đề gặp phải, gap". Gộp NC-003 C4 / C6 thành một phase có bằng chứng đo được. -->

> **Áp dụng cho:** open-core (lõi) · open-ketoan (app, theo R-FLOW + mức K3) · open-cake (ma trận kiểm) · **Trạng thái:** ◐ — **phía open-core xong (S001-1…5, bản 0.4.0)**; phía open-ketoan (S001-6…9) chờ R-FLOW
> **Trên:** canon R-CANON-17 / 18 · bizcity-platform [NC-003](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-003-TACH-OPEN-CORE.md) (C3 ☑, C4, C6) · [NC-004](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-004-TRU-COT-XUYEN-DOANH-NGHIEP.md)
> **Trạng thái từng việc:** [CHECKLIST.md](CHECKLIST.md)

> **Nối tiếp ở [PHASE-004](../PHASE-004-CORE-DOC-LAP/README.md)** <!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — R-CORE-8 (chủ 2026-11-28) -->: bản đồ tương thích đo lại 2026-11-28 ([10](../PHASE-004-CORE-DOC-LAP/10-BAN-DO-TUONG-THICH-OPEN-KETOAN.md)), kịch bản diễn tập S001-8 chi tiết ([20](../PHASE-004-CORE-DOC-LAP/20-DIEN-TAP-NANG-CAP.md)); W2 dọn ranh giới lõi **trước** B3 để open-ketoan chuyển một lần lên lõi đã sạch (0.7.0).

## 0. Mục tiêu

open-ketoan bỏ bản `packages/platform` + `packages/contracts` riêng, **cài `@bizcity/platform` và `@bizcity/contracts` từ bản phát hành của open-core**, mà:
- bộ test (394 tệp), `selfcheck --strict`, `kiem-nang-cap.sh` xanh **như trước**;
- CSDL đang chạy nâng cấp được, **không chạy lại migration** đã áp, không chạm sổ;
- open-cake vẫn xanh trên cùng bản lõi (ma trận hai app).

**Ngoài phạm vi:** rút phần kế toán khỏi lõi (C4 phần "dời"), chuyển pnpm (sau, PR riêng), đổi tên `@bizcity/kernel` (Q-CORE-6, sau khi chạy được).

## 1. Đo hiện trạng (2026-11-28, open-core 0.3.1 × open-ketoan `dev` `4e5cbc8`)

| Phép đo | Kết quả |
|---|---|
| **Khớp tên** — mọi `import … from '@bizcity/platform/<đường>'` / `@ketoan/contracts` ở `apps/api/src`, `packages/kernel/src`, `packages/module-sdk/src`, `modules/` | **646 / 646** có đúng tệp + đúng tên export trong open-core (0 thiếu) |
| **Khớp kiểu** — bản tạm của open-ketoan, thay `packages/{platform,contracts}/src` bằng mã open-core, `npm ci` + build + `tsc -p apps/api --noEmit` | gói lõi, `kernel`, `module-sdk`, `mua-hang-domain` build **0 lỗi**; `apps/api` **10 lỗi = 3 có sẵn + 7 mới** |
| open-cake trên open-core 0.3.1 | 199 / 199 test, typecheck 0 lỗi |

### 1.1 Bảy lỗi kiểu mới — đều do thay đổi có chủ ý ở P2b (lõi bỏ thứ cứng của kế toán)

| # | Lỗi | Gốc | Phía sửa |
|---|---|---|---|
| E-1 | `main.ts:34` `pendingMigrations()` thiếu đối số | P2b-1: trình migration nhiều nguồn, `pendingMigrations(q, opts)` | app: tệp chuyển tiếp `apps/api/src/db/migrate.ts` buộc `sources` + `ketoanLegacyHooks` |
| E-2…4 | `migrate-rename.test.ts` gọi `pendingMigrations()` | như E-1 | app: test gọi qua tệp chuyển tiếp |
| E-5, E-6 | `access.service.ts:32`, `role-assignment.service.ts:78` — `string[]` không gán được cho `Role` (union kế toán) | P2b-3: vai do app đăng ký, `Role = string` | app: dùng `Role` của `@bizcity/platform/core/roles`; khởi động gọi `ketoanAuthzPreset()` |
| E-7 | `authz-shadow.test.ts` — `SYSTEM_ROLES` không còn | P2b-3: `systemRoleKeys()` (đọc sổ vai lúc chạy) | app: đổi tên trong test |
| **đã lo từ lõi** <!-- [2026-11-29 12:45 AM Johnny Chu - Chu Hoàng Anh] S004-W1-7a --> | E-1…E-4: `pendingMigrations(q?)` — không truyền kết nối thì lõi tự mở (tương thích nguồn). E-5, E-6, E-7 + R-1: vào **codemod đổi nguồn** `tools/doi-nguon/ketoan-0.7.mjs` (ép kiểu `extra.roles as Role[]`; `SYSTEM_ROLES` lấy từ `@bizcity/platform/ketoan-legacy/index`; `installKetoanLegacy()` gọi luôn `ketoanAuthzPreset()`) ⇒ **open-ketoan không phải sửa tay trước khi đổi nguồn**; ma trận `--strict`: 0 lỗi mới | — | S001-6 còn lại: chạy codemod lúc đổi nguồn (S001-7) |

## 2. Vấn đề typecheck **không** bắt được (lúc chạy)

| # | Vấn đề | Hậu quả nếu bỏ qua | Phương án |
|---|---|---|---|
| R-1 | **Sổ vai rỗng:** lõi không còn vai kế toán viết cứng; `app.ts` chưa gọi `ketoanAuthzPreset()` | mọi người dùng mất quyền ⇒ 403 khắp nơi | app gọi `ketoanAuthzPreset()` trước `buildApp` (cùng chỗ `registerLedgerSubmitter`) |
| R-2 | **`DB_DIR` tính lùi 4 cấp** từ gói (`db/paths.ts`); cài từ `node_modules` ⇒ trỏ sai thư mục | không thấy migration / seeds / presets ⇒ khởi động lỗi hoặc tưởng "đã mới nhất" | lõi: **`PlatformConfig.dbDir` bắt buộc khi chạy từ gói** (đọc `DB_DIR`, báo `NOT_READY CONFIG_DB_DIR` nếu thiếu); app đặt `DB_DIR` trong Docker / `.env` |
| R-3 | **`CONTROL_MIGRATIONS_DIR`** (registry nhiều site) cũng theo `DB_DIR` của app | `/_sites/v1` không dựng được control DB | lõi mang `control-migrations/` của mình (đã là của lõi) + cho app ghi đè |
| R-4 | **Migration lõi trùng bảng đã có:** lõi `0001`, `0002` (26 bảng nền, vai theo app), `0003` (`external_sub`), `0004` (`tenant_secrets`) — open-ketoan đã có các bảng đó từ dãy `0001…0186` (`0183`, `0184`) | chạy lại ⇒ lỗi "đã tồn tại" hoặc nới ràng buộc sai | lõi: hook **`isApplied` tương đương** trong `migrate-ketoan-legacy.ts`: `0001/0002` ⇐ đã có `LAST_OLD`; `0003` ⇐ `0183`; `0004` ⇐ `0184`; diễn tập trên bản sao ẩn danh (R-KER-6) |
| R-5 | **Bảng theo dõi chưa có cột `source`** (`schema_migrations(name)`) | tên tệp lõi và app có thể trùng về sau | lõi: thêm `source` (mặc định `app`), khoá `(source, name)` — migration lõi có điều kiện, chạy được trên CSDL cũ |
| R-6 | **Hai tên một gói hợp đồng:** app import `@ketoan/contracts`, lõi import `@bizcity/contracts` | hai bản dựng ⇒ `ErrorCode` / `Role` lệch kiểu, lỗi `instanceof` | app: phụ thuộc `@bizcity/contracts` (URL release) và **alias** `@ketoan/contracts` → cùng gói (npm `"@ketoan/contracts": "npm:@bizcity/contracts@…"` hoặc tệp chuyển tiếp `export *`); phần kế toán của contracts tách ở C4 |
| R-7 | **Điều kiện `development` → `src/*.ts`:** open-ketoan chạy `tsx --conditions=development`, test vitest `resolve.conditions` | gói cài từ release vẫn mang `src` (tốt), nhưng đường `src` trong `node_modules` khác ⇒ tsx biên dịch được, chỉ chậm hơn | giữ; đo thời gian khởi động trước / sau |
| R-8 | **33 tệp bộ kiểm / script trỏ `packages/platform`** (`tests/conformance`, `layers.mjs`, `baseline.json`, `kiem-chuan.sh`, `kiem-nang-cap.sh`, đếm dấu R-SIG trong tệp nền) | selfcheck đỏ / sai sau khi xoá thư mục | app: đổi đường sang `node_modules/@bizcity/platform` hoặc bỏ phép kiểm lõi (lõi có bộ kiểm riêng ở open-core) — làm cùng PR, `baseline.json` không được tăng nợ |
| R-9 | **Docker** `api.Dockerfile` chép `packages/{contracts,platform}` | ảnh dựng lỗi | app: bỏ dòng chép, `npm ci` lấy từ URL release |
| R-10 | **Claim đang giữ tệp nền** ở open-ketoan: NT-HT-003 (`core/auth.ts`, `actions.ts`, `authz/*`, `module-sdk/**`, `AGENTS.md`), HT20 (`tool-password.ts`), NT-MH-011 (`http.ts`) | đổi chồng ⇒ trái R-FLOW-3 | chờ các dòng trả chỗ; **trước đó** mọi sửa nền ở open-ketoan phải mang sang open-core (gom lại như C3) |
| R-11 | **Mã mới của open-ketoan sau `4e5cbc8`** sửa `packages/platform` | lõi tụt sau | lặp C3 (gộp ba chiều, `merge3`) ngay trước khi chuyển; từ lúc chuyển: đóng băng |

## 3. Phương án

| Phương án | Làm | Được | Mất |
|---|---|---|---|
| A — một lần | một PR K3 đổi cả gói, migration, bộ kiểm, Docker | nhanh | PR lớn, khó diễn tập, chạm vùng đang bị giữ |
| **B — lớp chuyển tiếp trước (đề xuất)** | **B1** lõi thêm tương thích (R-2…R-5) + công cụ ma trận; **B2** open-ketoan sửa 5 chỗ E-1…E-7 + R-1 **trong khi vẫn dùng bản riêng** (mã chạy được trên cả hai lõi); **B3** đổi nguồn gói (R-6, R-9) + bộ kiểm (R-8) + baseline (R-4); **B4** đóng băng + xoá `packages/{platform,contracts}` | mỗi bước nhỏ, lùi được; B2 đo được bằng ma trận trước khi đổi gói | thêm một vòng PR |
| C — giữ bản riêng, chỉ đồng bộ | open-ketoan giữ `packages/platform`, mỗi sửa làm hai nơi | không chạm open-ketoan | ba bản trôi nhau — trái Q-CORE-3 |

**Chọn B.** Mỗi bước bên open-ketoan theo R-FLOW: giữ chỗ → PR tài liệu thiết kế (R-FLOW-2 vì chạm `actions.ts`, `module-sdk`, `contracts`, migration) → PR mã → trả chỗ.

## 4. Đầu ra

| # | Repo | Việc |
|---|---|---|
| S001-1 | open-core | **Công cụ ma trận** `tools/ma-tran-app.mjs`: lấy open-ketoan `dev` + open-cake `main`, thay nguồn lõi bằng bản đang sửa, đo khớp tên (646 import) + `tsc` + (tuỳ chọn) test; báo **lỗi mới so với mốc** — chạy mỗi PR lõi (D-PLAT-6) |
| S001-2 | open-core | `PlatformConfig` + `dbDir` / `controlMigrationsDir` / `presetsDir` tường minh khi chạy từ gói (R-2, R-3); giữ mặc định cũ cho repo đang dùng đường tương đối |
| S001-3 | open-core | hook `isApplied` tương đương trong `migrate-ketoan-legacy.ts` (R-4) + test trên CSDL dựng giống open-ketoan |
| S001-4 | open-core | cột `source` cho `schema_migrations` (R-5), migration lõi có điều kiện; test nâng cấp từ bảng cũ |
| S001-5 | open-core | phát hành **0.4.0** (S001-2…4); ma trận xanh |
| S001-6 | open-ketoan | **B2** — sửa E-1…E-7 + R-1 (tệp chuyển tiếp `db/migrate.ts`, gọi `ketoanAuthzPreset()`, kiểu `Role`, test) — chạy được trên cả bản riêng lẫn open-core; giữ chỗ khi NT-HT-003 trả `core/auth.ts` / `authz/*` |
| S001-7 | open-ketoan | **B3** — phụ thuộc `@bizcity/platform` + `@bizcity/contracts` từ release 0.4.x, alias `@ketoan/contracts`, `DB_DIR`, Docker, 33 tệp bộ kiểm; ADR-0040; K3 |
| S001-8 | open-ketoan | diễn tập nâng cấp trên **bản sao ẩn danh dữ liệu thật** (R-KER-6): `kiem-nang-cap.sh` xanh, không migration nào chạy lại |
| S001-9 | open-ketoan | **B4** — đóng băng + xoá `packages/{platform,contracts}`; AGENTS / 00-CANON ghi lõi ở open-core |

## 5. Gap còn lại (sau phase này)

| Gap | Ở đâu |
|---|---|
| Phần kế toán vẫn nằm trong lõi (`masterdata/*`, `ctx.ledger`, `db/types.ts` lược đồ kế toán, tên `ketoan`) | NC-003 C4 — làm **sau** khi open-ketoan đã chạy trên lõi (dời có ma trận bảo vệ) |
| Bốn bảng chứng từ, `mcp_confirm_tokens` chưa ở migration lõi | NC-004 S-PIL-3 |
| `@bizcity/kernel` / `module-sdk` của open-ketoan trùng tên với gói lõi dự định | Q-CORE-6 |
| npm (open-ketoan) ≠ pnpm (open-core, open-cake) | PR riêng sau B4 |
| CI GitHub tạm dừng (tài khoản) — ma trận chỉ chạy ở máy | khi mở lại thanh toán |

## 6. Xong khi

open-ketoan `dev` không còn `packages/{platform,contracts}`, cài lõi từ release open-core; bộ test + `selfcheck --strict` + `kiem-nang-cap.sh` xanh; ma trận open-ketoan × open-cake xanh trên cùng bản lõi.

## Nhật ký

- 2026-11-28: mở phase; đo khớp tên 646 / 646, khớp kiểu 7 lỗi mới (đều do P2b), liệt kê R-1…R-11; chọn phương án B.
- 2026-11-28: <!-- [2026-11-28 04:52 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-1 --> **S001-1 ☑** — `pnpm run ma-tran`: open-ketoan @ `0237a4d` 646 / 646 tên, mốc 3 → 10 lỗi kiểu (đúng 7 lỗi §1.1); open-cake @ `d9708d8` 65 / 65 tên, 0 lỗi. Khoảng 4 phút (lần đầu, có cài phụ thuộc); lần sau dùng lại bản tạm theo commit.
- 2026-11-28: <!-- [2026-11-28 05:03 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-2 --> **S001-2 ☑** — `appRoot()` thay năm chỗ tính lùi cấp; R-2 / R-3 có lối ra (`BIZCITY_APP_ROOT`, tự dò `bizcity.app.json`, `CONTROL_MIGRATIONS_DIR`). Bằng chứng: test 5 ca; ma trận không lỗi mới; tgz cài vào open-cake ⇒ 199 / 199. **Bài học:** phép thử chạy thật phải dùng **gói đóng tgz**, không nối junction vào thư mục lõi — junction kéo `zod` / `fastify` của open-core ⇒ hai bản, `instanceof ZodError` sai ⇒ 400 thành 500 (đã thử: lỗi y hệt trên main). Thêm làn "chạy thật bằng tgz" vào ma trận ở S001-5.
- 2026-11-28: <!-- [2026-11-28 05:11 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-3 --> **S001-3 ☑** — R-4 có lối ra: hook `coveredBy` + `CORE_COVERED_BY_KETOAN`. Thử thật 183 migration open-ketoan @ `0237a4d` + 4 migration lõi: **cài mới** 183 chạy / 4 ghi nhận / pending 0; **nâng cấp** từ bản cũ (139 bảng) chạy thêm 0 tệp, 139 bảng. Test gói 18 / 18 (có test khoá: thêm migration lõi ⇒ phải quyết định nó có chạy trên CSDL open-ketoan không).
- 2026-11-28: <!-- [2026-11-28 05:17 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-4 --> **S001-4 ☑** — R-5: cột `source` + `module` tự thêm (chạy lại vô hại, dòng cũ = `app`); khoá chính giữ `name` vì trùng tên giữa nguồn đã bị chặn trước khi chạm CSDL. Test 19 / 19; thử lại 183 migration open-ketoan: cài mới pending 0, nâng cấp chạy thêm 0 tệp.
- 2026-11-28: <!-- [2026-11-28 05:45 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-5 --> **S001-5 ☑** — open-core **0.4.0**: S001-2…4 + làn chạy thật bằng tgz trong ma trận; open-cake 199 / 199 trên tgz 0.4.0; open-ketoan 646 / 646 tên, 7 lỗi kiểu đã biết. Phía open-core của phase xong.
