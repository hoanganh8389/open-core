# CLAIMS — giữ chỗ việc trên open-core (R-FLOW)

<!-- [2026-11-29 12:29 AM Johnny Chu - Chu Hoàng Anh] LANES — bảng giữ chỗ: mỗi việc một dòng trước khi code; lane theo LANES.md. -->

> Nhận việc = thêm một dòng (PR chỉ-tài-liệu hoặc ngay trong PR đầu của việc). Xong / bỏ ⇒ đổi trạng thái, không xoá dòng.
> Lane và luật sửa tệp chung: [LANES.md](LANES.md). Trùng phạm vi với dòng đang mở ⇒ dừng, ghi yêu cầu ở LANES §6.

## Việc

| Lane | Việc | Phạm vi (tệp / bảng chính) | Nhánh / PR | Trạng thái | Từ ngày |
|---|---|---|---|---|---|
| R | S004-W1-3b / 3c / 5a bộ đo bất biến bản 2 + dò API + diễn tập chạy lại / quay lui | `tools/dien-tap/*`, `test/dien-tap*.test.mjs` | `feat/s004-w1-3b-do-bat-bien-v2` · #32 (chồng #30) | mở PR | 2026-11-29 |
| R | ADR-0001 ranh giới Master Data + R-CORE-9 | `docs/adr/ADR-0001-*`, `AGENTS.md` | #30 | mở PR | 2026-11-29 |
| R | S004-W2-9 cổng `MASTERDATA` + phạm vi vai qua cổng | `core/ports.ts` (dùng), `core/authz/scope.ts`, `store.ts` | — | đã nêu ở ADR-0001, chưa có nhánh | 2026-11-29 |
| T | S004-DM-1…3 `newId`, `entity_links`, `data_authority` | `contracts/master-data-core.ts`, `core/master-data.ts`, migration 0007 | #29 | đã merge `9fcd67d` | 2026-11-28 |
| T | LANES + CLAIMS (tài liệu này) | `docs/phases/LANES.md`, `CLAIMS.md` | #31 | đã merge `fb0e3c8`; §7 bắt kịp: `docs/lanes-bat-kip` | 2026-11-29 |
| T | S004-DM-4 `defineAxis` + bảng bản sao | `core/master-data.ts`, migration (giữ số khi bắt đầu) | — | giữ chỗ (#29 đã merge, bắt đầu được) | 2026-11-29 |
| T | S004-W5-1…4 + S004-DB-1…4 đồng bộ | `core/events.ts`, `core/sync/*` (mới), migration (giữ số khi bắt đầu) | — | giữ chỗ, chờ `bizcity_sync@1` 0.1 | 2026-11-29 |
| T | S004-CT-1…5 chứng từ | `core/document-spine.ts`, `core/documents.ts` | — | giữ chỗ | 2026-11-29 |
| T | PHASE-005 thiết kế + S005-F0…F3, F5-1 | `docs/phases/PHASE-005-*`; sau này `platform/src/entity/*`, `packages/{web-shell, ui-kit, action-client}` | #35 | thiết kế đã chốt; kế tiếp S005-F0 | 2026-11-29 |
| R | S005-UC-1…2 Upgrade & Conformance + S005-BX-2 core-dev / doctor (đặc tả PHASE-005 · 90, · 95) <!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-10…15 --> | `tools/*`, `packages/cli` | — | đề xuất, chờ lane R nhận | 2026-11-29 |
| R | S005-ML-1…4 Module Lifecycle (theo đặc tả PHASE-005 · 50) | `packages/{server, module-sdk, cli, testing}` | — | đề xuất, chờ lane R nhận | 2026-11-29 |

## Số đã giữ

| Loại | Số | Lane | Việc | Trạng thái |
|---|---|---|---|---|
| migration lõi | 0006 | R | S004-W2-4a | đã merge (#26) |
| migration lõi | 0007 | T | S004-DM-2/3 | đã merge (#29) |
| migration lõi | 0008 | — | — | **trống** — giữ ở đây trước khi viết |
| ADR | 0001 | R | ranh giới Master Data | PR #30 |
| ADR | 0002 | T | ánh xạ + chủ dữ liệu theo trục | giữ, chưa viết |
| ADR | 0003 | T | đồng bộ (feed, con trỏ, sổ nhận, đối soát) | giữ, chưa viết |
| ADR | 0004 | T | chứng từ quản / phản chiếu | giữ, chưa viết |
| R-CORE | 9 | R | danh mục: lõi giữ khung | PR #30 |
| R-CORE | 10 | — | — | **trống** |
