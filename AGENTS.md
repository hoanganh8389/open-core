# AGENTS.md — open-core

<!-- [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] C1 — luật cho người và agent làm trên mã lõi; R-PLAT-1…5 chép nguyên mã từ bizcity-platform (không đặt lại). -->

Đọc: [README](README.md) → [NC-003](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-003-TACH-OPEN-CORE.md) (kế hoạch C0–C8) → [canon §2.2](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md) → [bản đồ chuẩn](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/README.md).

## Vị trí

**open-platform** (`bizcity-platform`: chuẩn + bộ kiểm) quy định → **open-core (repo này)** hiện thực và phải qua bộ kiểm đó → app = open-core + module → **open-setup** cấp instance. Repo này **không** chứa chuẩn (đổi chuẩn ⇒ PR ở open-platform trước) và **không** chứa nghiệp vụ.

<!-- [2026-11-28 12:24 AM Johnny Chu - Chu Hoàng Anh] NC-004 — trụ cột xuyên doanh nghiệp, open-core bảo đảm (canon R-CANON-18) -->
## Trụ cột xuyên doanh nghiệp (lõi phải bảo đảm)

**Trụ cột xuyên doanh nghiệp (canon R-CANON-18, [NC-004](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/research/NC-004-TRU-COT-XUYEN-DOANH-NGHIEP.md)) — không app nào định nghĩa lại:**
- `qty` luôn quy về **đơn vị nhỏ nhất** (tỷ lệ 1); `unit` / `unitQty` / `unitRatio` chỉ để hiện; số lượng `numeric(18,4)`, tỷ lệ `(18,6)`, tiền `(18,2)`.
- `tenant ↔ blog_id` một-một; chuỗi nhiều cửa hàng = nhiều tenant; chi nhánh / kho / phòng ban là cây `branches` trong tenant.
- `contact_id` ↔ `partner.code` theo SPINE §4; `item_id` ULID bất biến.
- Chứng từ: `doc_ref` `<module>.<type>:<id>` + `version` + `content_hash`, bốn bảng, `document_links`, workflow YAML `<module>.<type>.workflow.yaml`; gửi đi với `Idempotency-Key = <doc_ref>@<version>` + `traceparent`.
- Vai quyền, cài đặt, meta / bản ghi mềm, tệp, API, MCP, **bốn bước kết nối open-hub** (`bizcity_hub_setup@1`), đệm, kiểm, bàn điều tra: dùng của lõi.
- **R-CORE-4** trụ nào app cần mà lõi chưa có ⇒ thêm ở lõi (bảng ở `migrations` lõi, kiểu ở `@bizcity/contracts`, action / `register*` ở `@bizcity/platform`) theo NC-004 §7; không để app tự dựng bản riêng.
- **R-CORE-5** đường `/api/v1/setup/*` và màn bốn bước (`@bizcity/web-shell`, `bizcity_hub_setup@1`) là của lõi — kế toán, HRM, cake, POS dùng chung, không app nào vẽ lại; app chỉ khai bước ② ③ ④ của mình. **Sẵn sàng = cả bốn bước Đạt.** <!-- [2026-11-28 02:36 PM Johnny Chu - Chu Hoàng Anh] NC-004 Q-PIL-8 — ready = bốn bước; bước ④ = lớp phân quyền khoanh phạm vi -->
- **R-CORE-7** <!-- [2026-11-28 06:44 PM Johnny Chu - Chu Hoàng Anh] R-CANON-19 — một chuẩn REST + JSON + React trên open-core --> open-core là **hạ tầng** của mọi app (canon R-CANON-19): REST từ `defineAction` / `defineListAction` ([`bizcity_list@1`](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-LIST-v1.md) — `q`, `f.<cột>.<phép>`, `sort`, con trỏ, xuất csv / xlsx / json / ndjson), JSON chuẩn (`ListPage`, `ListQuery`), React ở `@bizcity/web-shell` (`ListScreen`, `useListQuery`, menu, bốn bước). Hiện thực phải qua vector `schema/list/` của open-platform.
- **R-CORE-8** <!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — R-CORE-8 (chủ 2026-11-28) --> **Core sở hữu hạ tầng chứng từ, app sở hữu loại chứng từ và nghiệp vụ.** Lõi quản lý `business_documents`, `document_versions`, `document_links`, `document_activities` và vòng đời chung; open-cake khai loại *Yêu cầu đặt hàng*, open-ketoan khai loại mua hàng, thanh toán… và **quy tắc ghi sổ**. Lõi **không** chứa logic ledger, costing, kho, công nợ, vai / vai ký kế toán: nghiệp vụ gọi qua **cổng** (`definePort` / `ctx.port`) hoặc **mở rộng khai báo** (kiểu bảng, thang cài đặt, vai ký, mã lỗi). Hai app trao đổi bằng định danh + sự kiện + chứng từ, không đọc CSDL của nhau. Chi tiết: [PHASE-004 · 30](docs/phases/PHASE-004-CORE-DOC-LAP/30-RANH-GIOI-CORE.md).
- **R-CORE-9** <!-- [2026-11-29 12:26 AM Johnny Chu - Chu Hoàng Anh] ADR-0001 --> **Danh mục: lõi giữ khung, kế toán giữ dữ liệu** ([ADR-0001](docs/adr/ADR-0001-ranh-gioi-master-data.md)). Lõi có hợp đồng định danh (`item_id` ULID, mã có phiên bản, ĐVT nhỏ nhất, `EntityRef`), bất biến MD-1…MD-5 và cổng `masterdata`; **không** tạo bảng danh mục, không đọc `branches` / `warehouses` / `items` bằng SQL. open-ketoan là chủ (bảng, luật SKU, cây đơn vị, kho, phân kho); app khác giữ bản chiếu theo `item_id`, đề xuất = chứng từ `catalog.proposal`.
- **R-CORE-10** <!-- [2026-11-29 01:19 AM Johnny Chu - Chu Hoàng Anh] S005-BX-3 — chủ 2026-11-29, PHASE-005 · 95, bizcity_core_first@1 --> **Lõi trước — bánh xe đóng góp.** Tối ưu app (open-ketoan, open-cake, open-kiot…) đồng thời hoàn thiện lõi: thứ phổ thông tra lõi trước khi viết; chưa có ⇒ đường A (vào lõi) / B (`core-candidate`) / C (nghiệp vụ) ghi ở ô "Lõi hay app?" của PR; lõi rút ứng viên lên (test, release, ghi app nguồn) và app xoá bản trùng. Ở chính repo này: PR rút có nhãn `rut-len-loi`, duyệt ≤ 1 ngày làm việc; CHANGELOG ghi mục "Đến từ app". Khối chung ở cuối tệp.
- **R-CORE-6** bước ④ Guru = **lớp phân quyền ở giữa**: app khai chiều phạm vi (`registerAgentScope`: twin-brain `vault`, open-ketoan `module[]` + vai / chi nhánh / kho, open-cake tài khoản kênh, POS cửa hàng); lõi lưu phạm vi đã chọn và MCP chỉ mở tool trong phạm vi đó, giao với quyền vai của người dùng.
- Thang phạm vi cài đặt: `install → site → tenant → branch → user` + bậc app khai (`registerSettingScopes`); `doc_ref` theo spine 1.2; nhân viên tạm ở `user_meta` (trục `employee` ghi nợ).

## Luật

- **Lane** <!-- [2026-11-29 12:29 AM Johnny Chu - Chu Hoàng Anh] LANES --> open-core có hai lane làm song song: **R** (ranh giới + tương thích open-ketoan) và **T** (ba trụ cột Danh mục · Chứng từ · Đồng bộ). Trước khi nhận việc đọc [docs/phases/LANES.md](docs/phases/LANES.md) (ai làm gì, luật sửa tệp chung, bàn giao) và giữ chỗ ở [docs/phases/CLAIMS.md](docs/phases/CLAIMS.md) (việc, số migration, số ADR, số R-CORE).

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
pnpm run ma-tran -- --ketoan ../open-ketoan --cake ../open-cake   # ma trận app (S001-1): đổi mã lõi ⇒ báo lỗi MỚI ở open-ketoan / open-cake (R-PLAT-4)
```

<!-- bizcity:loi-truoc@1 — khối chung do bizcity-platform phát (bizcity_core_first@1). Sửa ở bizcity-platform/templates/loi-truoc/AGENTS-khoi.md rồi chép lại nguyên khối; SC-STD-4 kiểm dấu này. -->
## Lõi trước — bánh xe đóng góp (R-CORE-10)

Làm app thì lõi lớn lên: tối ưu open-ketoan, open-cake, open-kiot… là đồng thời hoàn thiện **open-core**; app làm sau hưởng toàn bộ thành quả.

```text
① App phát triển (nghiệp vụ mới) ─► ② Phát hiện năng lực chung ─► ③ Rút lên lõi (test · release) ─► ④ App dùng lại, xoá bản trùng ─┐
        ▲                                                                                                                      │
        └──────────────────────────────── app sau viết ít hơn ◄────────────────────────────────────────────────────────────────┘
```

1. **Trước khi viết thứ phổ thông** (danh sách, form, nhập / xuất, cài đặt, meta, quyền, chứng từ, sự kiện, đồng bộ, thông báo, báo cáo, CLI…): tra lõi — `bizcity doctor --tim <từ khoá>` (khi chưa có lệnh: đọc `open-core/packages/*/src` + `open-core/CHANGELOG.md`). Lõi có ⇒ **dùng**, không viết lại.
2. **Lõi chưa có ⇒ chọn đúng một đường**, ghi vào ô **"Lõi hay app?"** của mẫu PR:
   - **A — vào lõi:** ≥ 2 app cần, hoặc là hạ tầng chung ⇒ mở PR ở open-core trước (nhãn `rut-len-loi`); app dùng chế độ `core-dev` (`bizcity dev link-core`) trong lúc chờ bản phát hành.
   - **B — ứng viên lõi:** mới một app cần nhưng rõ là phổ thông ⇒ viết trong `src/core-candidate/`, đầu tệp `@bizcity-core-candidate <mô tả>`, không chuỗi nghiệp vụ cứng — để rút lên được nguyên tệp.
   - **C — nghiệp vụ:** chỉ app này có nghĩa ⇒ viết ở app như thường.
3. **Phát hiện tự động:** `open-core/tools/ung-vien-loi.mjs` dò ứng viên đã đánh dấu + mã trùng giữa các app ⇒ bảng "Ứng viên lõi" trong scoreboard của open-core.
4. **Rút lên lõi** có test chạy thật, CHANGELOG lõi ghi app nguồn ⇒ **app xoá bản riêng** khi lên bản lõi kế tiếp (codemod `open-core/tools/doi-nguon/` nếu đổi đường import).

App PHP / WordPress (open-kiot, plugin bizcity-*): "lõi" = hợp đồng + vector chung ở bizcity-platform và PHP SDK chung; cùng bốn bước.
Giữ chỗ việc ở lõi: `open-core/docs/phases/CLAIMS.md` · chia lane: `open-core/docs/phases/LANES.md` · chuẩn: [`bizcity_core_first@1`](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-CORE-FIRST-v1.md).
<!-- /bizcity:loi-truoc -->
