# Phase của open-core

<!-- [2026-11-28 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 — mục lục phase. -->

> <!-- [2026-11-29 12:29 AM Johnny Chu - Chu Hoàng Anh] LANES --> **Ai làm việc nào:** [LANES.md](LANES.md) (lane R ranh giới / lane T ba trụ cột, luật sửa tệp chung, bàn giao) · **giữ chỗ:** [CLAIMS.md](CLAIMS.md).

| Phase | Mục tiêu | Trạng thái |
|---|---|---|
| [PHASE-001](PHASE-001-OPEN-KETOAN-TREN-OPEN-CORE/README.md) | open-ketoan chạy trên open-core (bỏ bản `packages/platform` riêng), ma trận open-ketoan × open-cake | ◐ phân tích xong |
| [PHASE-002](PHASE-002-DONG-DU-LIEU-XUYEN-APP/README.md) | dòng dữ liệu xuyên app: bảng chứng từ ở lõi, gửi / nhận chứng từ chung, changefeed chung, truy nguồn liên app <!-- [2026-11-28 05:18 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 --> | ☐ kế hoạch |
| [PHASE-004](PHASE-004-CORE-DOC-LAP/README.md) | Core độc lập: open-ketoan lên Core release (bản đồ tương thích + diễn tập trên bản sao CSDL), ranh giới sạch (R-CORE-8), Server / Module SDK, Document Kernel, Event / Sync <!-- [2026-11-28 09:21 PM Johnny Chu - Chu Hoàng Anh] PHASE-004 — R-CORE-8 (chủ 2026-11-28) --> | ◐ tài liệu xong |
| [PHASE-003](PHASE-003-KHUNG-QUAN-TRI-CHUNG/README.md) | khung quản trị chung: `user_meta`, màn × thao tác, menu, hook, danh sách / lọc / xuất (`bizcity_list@1`), web-shell <!-- [2026-11-28 06:33 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 --> | ☐ kế hoạch |
| [PHASE-005](PHASE-005-KHUNG-UNG-DUNG-KHAI-BAO/README.md) | khung ứng dụng khai báo: Entity Registry (`defineEntity` / `extendEntity`), View Framework (`defineScreen`), Module Lifecycle, Scoreboard DX — developer chỉ viết nghiệp vụ <!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 --> | ◐ thiết kế, chờ chủ chốt Q-P5-1…14 |
