# PHASE-005 — Khung ứng dụng khai báo: Entity Registry · View Framework · Module Lifecycle · Scoreboard DX

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — chủ (2026-11-29): "BIZCITY OPEN CORE LEAN" năm lớp L1–L5; 14 gói đề xuất; "developer chỉ tập trung viết nghiệp vụ"; Model Registry sinh schema / metadata giao diện / bộ lọc / import mapping / API đọc; ghi nhạy cảm vẫn qua Action + Conformance Gate; Item Master chung, mỗi app mở rộng thuộc tính; defineScreen; Module Lifecycle; scoreboard đo việc developer đỡ phải viết. Lane T (LANES.md). -->

> **Loại:** thiết kế (chưa có mã của phase này) · **Lane:** T (thiết kế + Entity / View / Scoreboard DX), R (Server / Module SDK / CLI — W3 của PHASE-004, theo đặc tả ở [50](50-MODULE-LIFECYCLE.md)) · **Đã chốt 2026-11-29:** Q-P5-1…14 theo [05](05-DE-XUAT-CHOT.md) · **Yêu cầu gốc:** [00](00-YEU-CAU-CHU.md)
> **Đứng trên:** R-CORE-4…9 · ADR-0001 (danh mục: lõi giữ khung) · NC-008 (ba trụ cột, chốt ①) · `bizcity_list@1` · `bizcity_module@1` · `bizcity_ux@1` · mockup f1–f20 ([docs/ui](../../ui/mockup-shots))
> **Không mở lại** việc đã có chủ ở phase khác: phase này **gom** S003-3 / 4 / 6 / 9 / 10 / 15 (PHASE-003) và S004-W3 (PHASE-004) dưới một mô hình khai báo, mã việc gốc giữ nguyên.

## 1. Một câu

Developer khai **một** thực thể (`defineEntity` / `extendEntity`) và **một** màn hình (`defineScreen`). Lõi tự sinh:
- kiểm dữ liệu;
- API đọc và MCP chỉ đọc;
- danh sách: lọc, tìm, sắp, con trỏ;
- xuất, nhập có chạy thử;
- form, chi tiết, hoạt động;
- menu, quyền.

Developer chỉ viết **luật nghiệp vụ** (action ghi, quy tắc, workflow). Mọi ghi nhạy cảm vẫn đi qua `defineAction` + Conformance Gate:
- không có CRUD tự mở cho sổ cái;
- không có CRUD tự mở cho chứng từ đã rời nháp;
- không có CRUD tự mở cho danh mục mà app này không làm chủ.

## 2. Năm lớp ↔ cái đã có

| Lớp | Thành phần (sơ đồ của chủ) | Đã có ở open-core (mã) | Phase này thêm |
|---|---|---|---|
| **L5 Developer Experience** | Module SDK · CLI · Conformance · Upgrade · Scaffold · Testing | `defineModule` (đang ở open-ketoan), `tools/ma-tran-app`, `tools/kiem-khung`, `tools/doi-nguon`, `test/_csdl.mjs` | `@bizcity/module-sdk` + `@bizcity/cli` + `@bizcity/testing` ([10](10-GOI-VA-LOP.md), [50](50-MODULE-LIFECYCLE.md)); **Scoreboard DX** ([60](60-SCOREBOARD-DX.md)) |
| **L4 Application Framework** | Web Shell · View Engine · Form / List · Report · Import / Export · Activity | `defineListAction` + xuất csv / json / ndjson; `document_activities`; mockup f1–f20 | **`defineScreen`** + bộ vẽ list / form / detail / import ([40](40-VIEW-FRAMEWORK.md)) |
| **L3 Ba trụ cột** | Master Data · Document · Sync | `entity_links`, `data_authority`, `newId` (0007); trục chứng từ (0005); outbox | tiếp NC-008 (lane T, PHASE-004 DM / CT / DB) — phase này chỉ **dùng** |
| **L2 Platform Engine** | Entity Registry · Field / Relation · Action · Workflow · Event / Job · Settings / Meta · Module Registry · RBAC / Scope · REST / MCP | `defineAction` → REST + MCP, workflow YAML, `module_registry`, authz, settings + thang phạm vi, `definePort` | **Entity Registry** + `extendEntity` / `registerField` / `registerRelation` / `registerValidator` ([20](20-ENTITY-REGISTRY.md), [30](30-ITEM-MASTER-MO-RONG.md)) |
| **L1 Infrastructure** | Workspace · DB Router · Kysely / SQL · Migration · Storage · Cache · Secrets · Audit · Observability | site registry + RLS, Kysely, migration theo nguồn, secrets, audit chuỗi băm, OTel | không thêm |

"Năng lực bật theo nhu cầu" = bật **module** (manifest + migration theo nguồn + `tenant_modules`), **không** bằng cách cài thêm gói npm ([10](10-GOI-VA-LOP.md) §2).

## 3. Tài liệu trong phase

| Tệp | Trả lời câu hỏi nào của chủ |
|---|---|
| [00 — Yêu cầu của chủ](00-YEU-CAU-CHU.md) <!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-10…15 --> | sổ yêu cầu YC-P5-01…15 (nguyên ý chủ) ↔ tài liệu ↔ việc |
| [05 — Phương án đề xuất](05-DE-XUAT-CHOT.md) | đề xuất cho Q-P5-1…14 kèm lý do, giá phải trả, cách quay lui |
| [10 — Gói và lớp](10-GOI-VA-LOP.md) | 14 gói có nên tách hết không? Lean là gì? |
| [20 — Entity Registry](20-ENTITY-REGISTRY.md) | Model Registry vai trò gì, có quan trọng không? Khai báo một lần ⇒ sinh schema, metadata giao diện, bộ lọc, import mapping, API đọc thế nào? Ghi nhạy cảm chặn ra sao? |
| [30 — Item Master: cùng ID, mỗi app mở rộng](30-ITEM-MASTER-MO-RONG.md) | Cùng `item_id`, Cake / Kiot / Kế toán thêm thuộc tính riêng thế nào? |
| [40 — View Framework](40-VIEW-FRAMEWORK.md) | `defineScreen` sinh gì; khớp ảnh mockup; vibe coding |
| [50 — Module Lifecycle](50-MODULE-LIFECYCLE.md) | Vòng đời module và cơ chế quản lý |
| [60 — Scoreboard DX](60-SCOREBOARD-DX.md) | Chấm điểm thế nào, bao giờ; thao tác nào developer đỡ phải viết |
| [70 — Settings / Meta](70-SETTINGS-META.md) | WordPress × Odoo ⇒ Settings Registry, User / Entity Meta, Workspace / Org Settings, trường phụ thuộc tổ chức |
| [75 — Activity & Notification](75-ACTIVITY-NOTIFICATION.md) | hoạt động, việc, thông báo, audit, logs / trace dùng chung mọi app |
| [80 — Search / Import / Export](80-SEARCH-IMPORT-EXPORT.md) | tìm đa thực thể, saved views, bulk, Excel, mapping, dry-run, lỗi từng dòng; nhập qua action |
| [85 — Reporting](85-REPORTING.md) | Report Registry; Core không tính số nghiệp vụ |
| [90 — Upgrade & Conformance](90-UPGRADE-CONFORMANCE.md) | dây chuyền phát hành 7 bước trên công cụ đang có |
| [95 — Bánh xe đóng góp](95-BANH-XE-DONG-GOP.md) | làm app thì lõi lớn lên: luật "Lõi trước", dò ứng viên lõi, rút lên lõi, điểm |
| [CHECKLIST](CHECKLIST.md) | việc, lane, trạng thái |

## 4. Nguyên tắc

1. **Một khai báo, nhiều đầu ra.** Thứ sinh được từ registry thì không viết tay lần hai. Một thao tác phổ thông viết tay ở hai app ⇒ nợ, ghi vào Scoreboard DX.
2. **Sinh đọc thoải mái, sinh ghi có điều kiện.** Đọc (danh sách, chi tiết, xuất, MCP chỉ đọc) sinh tự động theo quyền. Ghi chỉ sinh cho lớp thực thể an toàn ([20](20-ENTITY-REGISTRY.md) §5). Ghi vẫn là `defineAction`, có idempotency, authz, audit.
3. **Khai báo là dữ liệu, không là mã ẩn.**
   - Registry xuất được ra JSON (`/api/v1/meta/*`), nên agent / MCP / web-shell / bộ kiểm cùng đọc một nguồn.
   - Không sinh tệp mã vào repo app: sinh lúc chạy, hoặc sinh kiểu `.d.ts`.
4. **Lối thoát rõ.** Mọi thứ sinh ra đều có chỗ chèn: cột, ô, khối, action riêng. Lối thoát không đi vòng qua Action hay quyền.
5. **Lean.**
   - Thêm gói / API chỉ khi ≥ 2 app cần (R-PLAT-3).
   - Mỗi đợt ≤ 4 bước và ra một thứ thấy được.
   - Đo bằng Scoreboard DX, không bằng số tính năng.

## 5. Câu hỏi đã chốt (2026-11-29, chủ đồng ý cả bộ)

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-10…15 --> Phương án đề xuất có lý do đầy đủ ở [05](05-DE-XUAT-CHOT.md); sáu câu mới Q-P5-9…14 (Settings, Activity, nhập, báo cáo, phát hành, bánh xe) cũng ở đó. Q-P5-1 đổi: `reporting` là **gói** (YC-P5-13 đã có hai app dùng), không hoãn.

| Mã | Câu hỏi | ① Đề xuất | ② Khác |
|---|---|---|---|
| Q-P5-1 | 14 gói như sơ đồ? | **10 gói phát hành** (kể cả `reporting`); `entity`, `master-data`, `documents`, `sync` là **đường con** của `@bizcity/platform` (cùng runtime, cùng giao dịch) ([10](10-GOI-VA-LOP.md)) | tách đủ 14 gói ngay |
| Q-P5-2 | Tên API | **`defineEntity` / `extendEntity` / `registerField` / `registerRelation` / `registerValidator`** như chủ đề xuất; `defineScreen` (thay `registerScreens` cũ, giữ bí danh) | `defineModel` / `defineView` |
| Q-P5-3 | Trường mở rộng lưu ở đâu? | **ba chỗ theo khai báo**: `meta` (`entity_meta`, lõi hoá từ open-cake 0103 — trường ít, không tính toán), `extension` (bảng riêng của app 1-1 theo ID — trường nhiều / cần ràng buộc / chỉ mục), `column` (chỉ chủ dữ liệu) | mọi trường mở rộng vào JSONB |
| Q-P5-4 | Ghi sinh tự động cho lớp nào? | **chỉ `config` và `record`** (danh mục nhỏ của chính app, bản ghi mềm); `master` chỉ ở app chủ và qua action của chủ; `document`, `ledger`, `replica` **không bao giờ** | cho mọi lớp, chặn bằng quyền |
| Q-P5-5 | Màn khai ở máy chủ hay trình duyệt? | **máy chủ** (`defineScreen` trong module, phát qua `/api/v1/meta/screens`); web-shell chỉ vẽ; MCP / agent đọc cùng nguồn | khai trong React |
| Q-P5-6 | Ai làm phần nào? | lane **T**: Entity Registry, View Framework, Scoreboard DX, đặc tả Module Lifecycle; lane **R**: `server`, `module-sdk`, `cli` (W3 PHASE-004) theo đặc tả [50](50-MODULE-LIFECYCLE.md) | một lane làm hết |
| Q-P5-7 | S003-3 (`registerScreens` / menu) đang chặn vì claim NT-HT-003 của open-ketoan | **lõi làm mới theo `defineScreen`**, có bí danh tương thích; open-ketoan chuyển màn của mình khi claim trả — không dời mã từ open-ketoan | chờ claim |
| Q-P5-8 | Scoreboard DX có chặn PR? | **có, kiểu bánh cóc**: điểm không được giảm (như sổ nợ ranh giới); mục tiêu theo bản phát hành ở [60](60-SCOREBOARD-DX.md) §5 | chỉ báo cáo |
