# PHASE-005 · 30 — Item Master: cùng `item_id`, mỗi app mở rộng thuộc tính

<!-- [2026-11-29 12:53 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — sơ đồ của chủ "Core — Item Master → Cake / Kiot / Kế toán": cùng ID, mỗi app thêm thuộc tính nghiệp vụ. -->

## 1. Đọc sơ đồ theo luật đã chốt

Sơ đồ ghi "Core — Item Master: `item_id · code · name · category · uom · brand · status`". Theo ADR-0001 và R-CHAIN-0:
- **Core giữ khuôn**: khai báo `masterdata.item`, kiểu trường, bất biến MD-1…MD-5, `newId('item')`.
- **Kế toán giữ dữ liệu**: bảng `items`, luật mã, nhóm.

Bảy trường lõi là **hợp đồng chung**. Mọi app đọc được, chỉ chủ ghi được.

| Trường lõi | Kiểu | Ghi chú |
|---|---|---|
| `item_id` | ULID, bất biến | MD-1; biến thể là `item_id` riêng có `parent_item_id` (NC-008 ADR-P2) |
| `code` | mã có phiên bản | MD-2 |
| `name` | text | |
| `category` | ref `masterdata.item_class` (cây Ngành → Nhãn → Nhóm của kế toán) | |
| `uom` | ref ĐVT gốc tỷ lệ 1 | MD-3; các ĐVT quy đổi là quan hệ `masterdata.uom_ratio` |
| `brand` | ref `item_class{kind:'brand'}` | không có `brand_id` riêng (NC-008 ADR-P2 §4) |
| `status` | `draft · active · retired` | MD-5: không xoá |

## 2. Mỗi app mở rộng

```ts
// open-cake
extendEntity('masterdata.item', {
  app: 'cake',
  fields: {
    'cake.trade_name':   field.text({ label: 'Tên thương mại', storage: 'meta', search: true }),
    'cake.consult_desc': field.text({ label: 'Mô tả tư vấn', storage: 'meta', multiline: true }),
    'cake.sales_copy':   field.json({ label: 'Nội dung bán hàng', storage: 'extension' }),   // bảng cake_item_ext(item_id PK, …)
    'cake.sellable':     field.bool({ label: 'Đang bán online', storage: 'meta', filter: 'eq', indexed: true }),
  },
});

// open-kiot — giá và chính sách là DỮ LIỆU CÓ HIỆU LỰC, không là thuộc tính: khai quan hệ, không khai trường
extendEntity('masterdata.item', {
  app: 'kiot',
  fields: { 'kiot.loyalty_points': field.number({ label: 'Điểm thưởng', storage: 'extension' }) },
  relations: {
    'kiot.prices':   { to: 'kiot.price_list_line', kind: 'many', via: 'item_id', label: 'Giá bán' },
    'kiot.policies': { to: 'kiot.sales_policy',    kind: 'many', via: 'item_id', label: 'Chính sách bán' },
  },
});

// open-ketoan là CHỦ: trường kế toán là cột của bảng chủ, khai thẳng trong defineEntity của nó
//   inventory_account, cogs_account, tax_policy  (không dùng extendEntity)
```

## 3. Lưu ở đâu — ba chỗ (Q-P5-3 ①)

| `storage` | Khi nào dùng | Bảng | Giới hạn |
|---|---|---|---|
| `meta` | ít trường, chuỗi / cờ / số đơn giản, không tham gia tính toán | `entity_meta (tenant, entity_type, entity_id, key, value jsonb)` — lõi hoá từ open-cake 0103 (S003-2) | ≤ 5 khoá có chỉ mục mỗi app (SC-ENT-6); **cấm** tiền, số lượng, thuế, trạng thái, quyền, bí mật (SC-ENT-5) |
| `extension` | nhiều trường, cần ràng buộc / chỉ mục / khoá ngoại, hoặc JSON lớn | bảng riêng của app, **một-một theo `item_id`**, migration của app | — |
| `column` | chỉ chủ dữ liệu | bảng chủ (`items` của kế toán) | app khác không được |

Khoá ngoại của `extension` trỏ tới:
- **bảng bản sao** của app (`replica`), khi đã nối kế toán;
- hoặc bảng `local` của app, khi đứng riêng.

**Không** trỏ tới bảng của app khác (R-CORE-8).

## 4. Đọc ra một mặt hàng "đầy đủ" ở từng app

```text
GET /api/v1/e/masterdata.item/01ARYZ6S41000G40R40M30E209      (ở open-cake)
→ { item_id, code, name, category, uom, brand, status,          ← bản sao từ feed kế toán (chỉ đọc)
    "cake.trade_name": "…", "cake.sellable": true, … }          ← phần mở rộng của Cake
```

- Lõi ghép phần lõi + phần mở rộng **của app đang chạy**. App khác không thấy `cake.*`, trừ khi được cấp quyền đọc qua API của Cake.
- Không có "một bảng mặt hàng toàn hệ". Mỗi app một bản đọc, cùng `item_id`. `entity_links` nối ID cũ / ID cục bộ khi app từng đứng riêng (NC-008 ADR-P6).

## 5. Ghi — ai sửa được gì

| Sửa | Ở kế toán (chủ) | Ở Cake (bản sao, đã nối) | Ở Cake (đứng riêng) |
|---|---|---|---|
| bảy trường lõi | action của kế toán | **không** — gửi `catalog.proposal` | action của Cake (chủ tạm, `local`) |
| `cake.*` | — | action `cake.item.update_ext` (sinh được: phần mở rộng là lớp `record` của Cake) | như cột trái |
| trường kế toán | action của kế toán | không thấy | không có |

Cổng ghi dùng `dataAuthority.assertWritable('item', instance)` (đã có, 0007). SC-ENT-2 chặn action ghi lõi thiếu cổng.

Validator của app chỉ áp cho **ghi của app đó**: `registerValidator({ app: 'cake', on: [...] })`. Validator của Cake không chặn được kế toán ghi.

## 6. Ca kiểm

| Ca | Kỳ vọng |
|---|---|
| Cake thêm `cake.trade_name`, kế toán đổi `name` | Cake nhận `name` mới qua feed; `cake.trade_name` giữ nguyên |
| Cake khai `extendEntity` có trường `name` | lỗi nạp SC-ENT-3 |
| Cake khai `cake.price` kiểu `money` ở `meta` | lỗi SC-ENT-5 |
| Cake nối kế toán, mặt hàng cục bộ khớp mã | `entity_links(local → item_id kế toán)`; dòng `extension` chuyển khoá theo `item_id` mới trong giao thức S004-DB-4; không mất `cake.*` |
| Kiot đọc `masterdata.item` | thấy bảy trường lõi + `kiot.*`, không thấy `cake.*` |
