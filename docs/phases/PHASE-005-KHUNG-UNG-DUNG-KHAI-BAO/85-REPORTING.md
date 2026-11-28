# PHASE-005 · 85 — Reporting Framework

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-13: Core cấp khung báo cáo; báo cáo nghiệp vụ (BCTC, bán hàng) ở app. -->

## 1. Ranh giới

| Core cấp | App định nghĩa |
|---|---|
| Report Registry + nguồn dữ liệu được cấp quyền | Báo cáo tài chính, sổ chi tiết (open-ketoan) |
| lọc, nhóm, tổng hợp, drill-down | Báo cáo bán hàng, ca, khuyến mại (open-kiot) |
| template in, PDF, Excel | Báo cáo chăm sóc khách (open-cake) |
| xuất chạy nền | Báo cáo công, lương (open-hrm) |
| audit + truy vết nguồn số liệu | |

**Core không tính một con số nghiệp vụ nào.** Không có "doanh thu", "lãi lỗ" trong lõi (R-CORE-8).

## 2. Khai báo

```ts
defineReport({
  key: 'kiot.sales_by_item',
  label: 'Bán hàng theo mặt hàng',
  permission: 'reports:sales',
  params: { period: field.dateRange(), branch: field.ref('core.branch', { scope: true }) },  // scope ⇒ áp phạm vi vai
  source: async (ctx, p) => ctx.db.selectFrom('kiot_sale_lines')…,   // app viết truy vấn, lõi cấp ctx.db đã có RLS + phạm vi
  measures: { qty: 'sum', revenue: 'sum' },
  dimensions: ['item', 'branch', 'day'],
  drill: { item: (row) => ({ screen: 'kiot.sale_line', filter: { item_id: row.item } }) },
  templates: { pdf: './templates/sales-by-item.hbs', xlsx: 'auto' },
  lineage: true,                                                         // mỗi số liệu nhớ truy vấn + tham số + thời điểm
});
```

## 3. Core làm gì với khai báo

- **Màn báo cáo** (`views: ['report']`): ô tham số, bảng nhóm / tổng, biểu đồ đơn giản, nhấp số ⇒ drill-down tới màn danh sách nguồn **đã lọc sẵn**.
- **Quyền:**
  - `permission` cho cả báo cáo;
  - tham số `scope: true` ⇒ chỉ chọn được chi nhánh / kho trong phạm vi vai;
  - `ctx.db` đã gắn tenant (RLS).
- **In / xuất:** PDF từ template (dùng `print-templates` / `print-profile` đã có ở contracts), Excel tự sinh từ cột, CSV. Lớn ⇒ chạy nền, báo chuông.
- **Truy vết (lineage):**
  - mỗi lần chạy ghi `{report, params, at, user, rowCount, queryHash}`;
  - tệp xuất mang mã lần chạy;
  - nhấp một số ra chuỗi "từ dòng nào, chứng từ nào" (dùng `bizcity_lineage@1` đã có ở contracts);
  - audit ghi ai xuất gì.
- **Đệm:** kết quả theo (báo cáo, tham số, tenant, phạm vi), hết hạn khi có sự kiện đổi dữ liệu nguồn mà app khai (`invalidateOn`).

## 4. Ví dụ hai app dùng chung

| | open-ketoan | open-kiot |
|---|---|---|
| Báo cáo | `ketoan.bctc.b01` Bảng cân đối kế toán | `kiot.sales_by_item` |
| Nguồn | cổng sổ (`ledger`) — số do kế toán tính | `kiot_sale_lines` |
| Dùng của Core | màn, tham số kỳ + đơn vị, drill-down tới sổ chi tiết, PDF mẫu B01, xuất Excel, lineage | màn, tham số + chi nhánh theo vai, drill tới dòng bán, xlsx |
