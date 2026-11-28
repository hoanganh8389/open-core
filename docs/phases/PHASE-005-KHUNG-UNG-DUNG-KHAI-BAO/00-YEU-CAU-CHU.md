# PHASE-005 · 00 — Yêu cầu của chủ (Johnny Chu - Chu Hoàng Anh)

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — sổ yêu cầu: ghi lại nguyên ý chủ giao cho phase, mỗi yêu cầu một mã, trỏ tới tài liệu phân tích và đợt làm. -->

> Đây là **nguồn gốc** của phase. Tài liệu phân tích (10…95) phải trả lời đủ các yêu cầu dưới đây. Mỗi yêu cầu có:
> - mã `YC-P5-nn`;
> - ngày;
> - ý chủ (trích gần nguyên văn);
> - tài liệu trả lời;
> - việc ở CHECKLIST.
>
> Thêm yêu cầu mới ⇒ thêm dòng, không sửa dòng cũ.

## Mục tiêu tổng (chủ, 2026-11-29)

> *"Developer hoặc AI agent muốn xây Open HRM, Open MRP, Open Kiot, Open Inventory chỉ cần tập trung vào nghiệp vụ. Không phải xây lại bảng danh mục, cơ chế phân quyền, chứng từ, giao diện quản trị và đồng bộ dữ liệu."*
>
> *"Quan trọng nhất: khi dev tối ưu cho open-ketoan cũng sẽ tối ưu thêm cho open-core trên repo; dev hiểu việc này liên quan đến open-core, có thể update cho open-core, giúp open-core không ngừng phát triển như một bánh xe — càng nhiều người dev cho open-cake, open-kiot, open-ketoan thì open-core càng hoàn chỉnh."*

## Yêu cầu

| Mã | Ngày | Ý chủ | Trả lời ở | Việc |
|---|---|---|---|---|
| YC-P5-01 | 2026-11-29 | Kiến trúc đích **BIZCITY OPEN CORE LEAN** năm lớp: L1 Infrastructure · L2 Platform Engine · L3 Ba trụ cột · L4 Application Framework · L5 Developer Experience; năng lực kích hoạt theo nhu cầu từng ứng dụng | [README](README.md) §2 | toàn phase |
| YC-P5-02 | 2026-11-29 | Cây gói `contracts · platform · entity · master-data · documents · sync · server · module-sdk · web-shell · ui-kit · action-client · reporting · testing · cli`; **tiêu chí là lean** | [10](10-GOI-VA-LOP.md) | Q-P5-1 |
| YC-P5-03 | 2026-11-29 | Framework giúp phát triển nhanh, không viết lại thành phần phổ thông; developer chỉ tập trung nghiệp vụ; **phải có scoreboard**: làm thế nào, bao giờ, giảm bớt thao tác gì, thao tác nào developer đỡ phải viết | [60](60-SCOREBOARD-DX.md) | F0 |
| YC-P5-04 | 2026-11-29 | **Model Registry** — vai trò, có quan trọng không, open-core cần thế nào; chỉ cần khai báo registry ⇒ framework sinh schema kiểm dữ liệu, metadata giao diện, bộ lọc, import mapping, API đọc | [20](20-ENTITY-REGISTRY.md) | F1, F2 |
| YC-P5-05 | 2026-11-29 | Ghi nghiệp vụ nhạy cảm **vẫn qua Action và Conformance Gate**; không tự mở CRUD cho sổ cái hay chứng từ đã duyệt | [20](20-ENTITY-REGISTRY.md) §4–5 | F2-2 |
| YC-P5-06 | 2026-11-29 | Core có **Item Master chung**: cùng `item_id`, mỗi ứng dụng mở rộng thuộc tính theo nghiệp vụ (Cake: tên thương mại, mô tả tư vấn, nội dung bán hàng · Kiot: giá bán, điểm thưởng, chính sách bán · Kế toán: tài khoản kho, tài khoản giá vốn, chính sách thuế); có `defineEntity · extendEntity · registerField · registerRelation · registerValidator` | [30](30-ITEM-MASTER-MO-RONG.md) | F1-2 |
| YC-P5-07 | 2026-11-29 | **View Framework** từ mockup đã có — rất quan trọng với vibe coding; dev chỉ khai báo kiểu `defineScreen({ entity, views, searchable, filters, actions, import, export, activities })` | [40](40-VIEW-FRAMEWORK.md) | F3 |
| YC-P5-08 | 2026-11-29 | **Module Lifecycle Framework** và cơ chế quản lý module | [50](50-MODULE-LIFECYCLE.md) | S005-ML-* |
| YC-P5-09 | 2026-11-29 | Đưa ra **phương án đề xuất cho 8 câu** Q-P5 | [05](05-DE-XUAT-CHOT.md) | — |
| YC-P5-10 | 2026-11-29 | **Settings / Meta Framework** kết hợp tư duy WordPress và Odoo: Options ↔ Config Parameters ⇒ Settings Registry · User Meta ↔ User Fields ⇒ User Meta · Post Meta ↔ Model Fields ⇒ Entity Meta · Network Settings ↔ Company Settings ⇒ Workspace Settings · Site Options ↔ Company-dependent Fields ⇒ Instance / Org Settings | [70](70-SETTINGS-META.md) | F6 |
| YC-P5-11 | 2026-11-29 | **Activity & Notification Framework** dùng chung cho Open Cake, HRM, Kiot, Kế toán: thông báo, nhật ký, hoạt động, logs, trace | [75](75-ACTIVITY-NOTIFICATION.md) | F7 |
| YC-P5-12 | 2026-11-29 | **Search / Import / Export Framework**: tìm đa thực thể, saved filters, saved views, bulk actions, Excel nhập / xuất, mapping cột, preview, dry-run, báo lỗi từng dòng; **nhập phải qua validation và quyền nghiệp vụ, không ghi thẳng bỏ qua kiểm chuẩn**; có cơ chế dynamic để dev dùng chuẩn và hiệu quả | [80](80-SEARCH-IMPORT-EXPORT.md) | F8 |
| YC-P5-13 | 2026-11-29 | **Reporting Framework**: không đưa báo cáo kế toán / bán hàng vào Core. Core chỉ cấp: Report Registry + nguồn dữ liệu được cấp quyền · lọc, nhóm, tổng hợp, drill-down · template in, PDF, Excel · xuất chạy nền · audit và truy vết nguồn số liệu. Kế toán định nghĩa Báo cáo tài chính, Kiot định nghĩa Báo cáo bán hàng, cùng dùng Report Framework | [85](85-REPORTING.md) | F9 |
| YC-P5-14 | 2026-11-29 | **Upgrade & Conformance Framework**: migration theo phiên bản module, kiểm thử nâng cấp, công cụ đo bất biến, kiểm ranh giới, ma trận tương thích ⇒ quy trình phát hành chuẩn: Module Manifest → Dependency Check → Contract Conformance → Migration Dry-run → Data Invariant Check → Integration Test → Release / Deployment | [90](90-UPGRADE-CONFORMANCE.md) | S005-UC-* |
| YC-P5-15 | 2026-11-29 | **Bánh xe đóng góp**: tối ưu cho app thì đồng thời tối ưu open-core; dev hiểu và cập nhật được open-core; càng nhiều người làm app thì lõi càng hoàn chỉnh | [95](95-BANH-XE-DONG-GOP.md) | S005-BX-* |
