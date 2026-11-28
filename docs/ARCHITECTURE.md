# Kiến trúc open-core

<!-- [2026-11-28 06:57 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 S003-13 — kiến trúc open-core một trang (chủ: "readme, kiến trúc và ui ux mockup trong cài đặt hệ thống để theo dõi"). -->

> **Đọc kèm:** [README](../README.md) · [Scoreboard](scoreboard/SCOREBOARD.md) · [Mockup web-shell](ui/mockup-shots/) · phase [001](phases/PHASE-001-OPEN-KETOAN-TREN-OPEN-CORE/README.md) · [002](phases/PHASE-002-DONG-DU-LIEU-XUYEN-APP/README.md) · [003](phases/PHASE-003-KHUNG-QUAN-TRI-CHUNG/README.md)
> **Luật cấp hệ:** canon open-hub R-CANON-17 (ba vai), 18 (trụ cột), 19 (REST + React chuẩn) · nghiên cứu bizcity-platform NC-003 / 004 / 005

## 1. Vị trí

```text
open-hub canon (luật cấp hệ)
   │
open-platform = bizcity-platform        chuẩn BIZCITY-* · schema · bộ kiểm (standard-check, spine-check, list-check)
   │ quy định                                   ▲ phải qua
open-core (repo này) = HẠ TẦNG                  │
   @bizcity/platform   kernel: người dùng · vai · cài đặt · meta · chứng từ · tệp · việc nền · đệm · bí mật · sự kiện · bằng chứng · migration · nhiều site
   @bizcity/contracts  JSON chuẩn: phong bì, lỗi, spine (*Ref, QtyLine, DocLink), danh sách (ListQuery, ListPage)
   @bizcity/server     (S003) Fastify: site theo Host, ctx, defineAction / defineListAction ⇒ REST + MCP, /api/v1/setup/*, /_sites/v1
   @bizcity/web-shell  (S003) khung app + ListScreen · DetailScreen + Hoạt động · FormSheet · ImportScreen · SetupScreen · PlatformStatus
   @bizcity/ui-kit     (S003) token một nguồn (bizcity_ux@1) + thành phần
   │ ^MAJOR.MINOR (Release tgz)
app = open-core + module:  open-cake (+crm) · open-ketoan (+ketoan) · POS · HRM · MRP · open-kiot (bản TS sau này)
   │ /_sites/v1
open-setup: registry Workspace × app = instance, ghi core_version
```

## 2. Mười hai thứ lõi bảo đảm (ERP-12 — NC-005)

| # | Thứ | Mã ở lõi | Tình trạng (xem scoreboard) |
|---|---|---|---|
| E-1 | Người dùng · danh tính · `user_meta` | `core/auth.ts`, `security/*`, migration 0003 | `user_meta` chờ S003-2 |
| E-2 | Vai · quyền · phạm vi · màn × thao tác | `core/authz/*`, `roles.ts`, 0002 | màn × thao tác chờ S003-3 |
| E-3 | Cài đặt · meta · bản ghi mềm | `core/settings.ts` | thang phạm vi, lớp mềm chờ |
| E-4 | Chứng từ + workflow YAML | `core/documents.ts`, `workflow.ts`, bảng ở 0001 | chưa test ở lõi |
| E-5 | Danh sách · lọc · xuất · nhập | — | `bizcity_list@1` 0.2; mã S003-4, S003-10 |
| E-6 | Hoạt động (chatter) | — | S003-9 |
| E-7 | Tệp | lưu đĩa ở `documents.ts` | Storage của open-cake lên lõi |
| E-8 | Việc nền + định kỳ | `core/events.ts` (`tickClock`) | `registerJob` / `registerSchedule` S003-11 |
| E-9 | Đệm | đệm lẻ | module chung |
| E-10 | Bí mật | `core/secrets.ts`, 0004 | chưa test ở lõi |
| E-11 | Sự kiện · outbox · bằng chứng · trace | `core/events.ts`, `audit.ts`, `tracing.ts` | changefeed / gửi xuyên app PHASE-002 |
| E-12 | Menu · màn · khung app · bốn bước | `core/hooks.ts`, `module-registry.ts` | web-shell S003-6 |

## 3. Luồng một yêu cầu

```text
trình duyệt ── web-shell (ListScreen / FormSheet) ── action-client ──► REST /api/v1/<module>/…   (hoặc MCP /mcp cho agent)
                                                                         │ site theo Host ⇒ CSDL instance · vé SSO ⇒ người dùng · RLS tenant
                                                                         │ defineAction: zod ở cửa · quyền + phạm vi vai · Idempotency-Key
                                                                         ▼
                                                     giao dịch Kysely ── bảng app + bảng lõi ── audit_logs (chuỗi băm) ── outbox
                                                                                                             │ việc nền / sự kiện
                                                                                                             ▼
                                                                          app khác (doc_ref@version) · changefeed · thông báo
```

## 4. Dữ liệu

- Mỗi app **một CSDL cho mỗi instance**; bảng lõi giống nhau ở mọi CSDL (migration lõi, nguồn `platform`) — giữ khớp bằng `tools/kiem-luoc-do.mjs`.
- Migration theo nguồn (`schema_migrations.source`), app có sẵn nội dung ⇒ `coveredBy` (open-ketoan 0183 ≡ lõi 0003…).
- Định danh chung theo spine 1.2 (`tenant ↔ blog_id`, `item_id`, `partner.code ↔ contact_id`, `doc_ref@version`, số lượng đơn vị nhỏ nhất) — zod ở `@bizcity/contracts/spine`.

## 5. Kiểm và phát hành

| Lệnh | Kiểm |
|---|---|
| `pnpm test` | kiểm khung (một số phiên bản, ranh giới nghiệp vụ) + test gói trên Postgres thật + vector spine của open-platform |
| `pnpm run ma-tran -- --ketoan … --cake … --chay-that` | ma trận app: khớp tên, khớp kiểu, chạy thật bằng tgz |
| `pnpm run kiem-luoc-do -- --app-migrations …` | lược đồ bảng lõi khớp giữa mọi CSDL |
| `node tools/scoreboard.mjs` | scoreboard ERP-12 × app ⇒ `docs/scoreboard/SCOREBOARD.md` + màn Tình trạng nền tảng |
| `node tools/dong-goi.mjs <x.y.z>` | đóng tgz mọi gói cùng số ⇒ GitHub Release |
