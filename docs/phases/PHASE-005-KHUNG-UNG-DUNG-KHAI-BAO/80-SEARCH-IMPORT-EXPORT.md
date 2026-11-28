# PHASE-005 · 80 — Search / Import / Export Framework

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-12: tìm đa thực thể, saved filters / views, bulk actions, Excel nhập / xuất, mapping cột, preview, dry-run, lỗi từng dòng; nhập qua validation + quyền nghiệp vụ; cơ chế dynamic. -->

## 1. Cơ chế dynamic: mọi thứ đọc từ registry

Dev không viết importer / exporter / bộ tìm cho từng thực thể. **Entity Registry** ([20](20-ENTITY-REGISTRY.md)) đã có đủ thông tin:

| Cần | Lấy từ khai báo |
|---|---|
| cột tìm kiếm | `search: true` của trường |
| bộ lọc + toán tử | kiểu trường + `filter` (`bizcity_list@1`) |
| cột xuất + nhãn | `label`, `list`, `export: false` để giấu |
| ghép cột khi nhập | `label` + `aliases` (vd `['Mã SP', 'SKU']`) |
| chuẩn hoá giá trị | parser của kiểu (`money`, `qty`, `date`, `phone`…) |
| khoá chống trùng / cập nhật | `unique` (vd `code` theo tenant) ⇒ nhập là "thêm mới hoặc cập nhật" |
| tra tham chiếu | `field.ref` ⇒ nhận mã hoặc tên, tra qua `MASTERDATA` / `entity_links` |
| ghi | **action ghi của thực thể** (§3) |

Thực thể cần cách riêng thì khai `defineImport(entity, { columns, transform, action })`. Vẫn qua cùng đường ghi.

## 2. Tìm

- **Tìm trong một màn:** ô tìm của `ListScreen` ⇒ `q` của `bizcity_list@1` trên các trường `search`.
- **Tìm đa thực thể** (ô "Tìm màn, bản ghi, số chứng từ, khách…" · Ctrl K, mọi ảnh mockup):
  - `GET /api/v1/search?q=` gọi mỗi thực thể có `searchable` **mà người gọi có quyền đọc**, gộp kết quả theo loại, mỗi loại tối đa N;
  - nhận dạng số chứng từ / mã / SĐT trước (khớp đúng);
  - có cả **màn** và **action** (đi tới màn, tạo đơn).
  - Không có chỉ mục tìm riêng ở đợt đầu: dùng chỉ mục của từng bảng (SC-ENT-6 cảnh báo thiếu). Chỉ mục toàn văn để sau, khi đo thấy chậm.
- **Saved filters / saved views:**
  - lưu `{ screen, query, columns, sort }` ở `user_meta` (`core.views.<screen>`) cho cá nhân, hoặc `setting_values` bậc tenant cho cả nhóm;
  - chia sẻ = link URL, vì trạng thái đã nằm trên URL.
- **Bulk actions** (thanh "N đã chọn"):
  - chỉ gọi **action đã khai** với danh sách ID;
  - mỗi bản ghi qua đủ quyền + kiểm, kết quả trả theo từng dòng (thành công / lỗi + `remedy`);
  - không có "update hàng loạt" bằng SQL.

## 3. Nhập — bắt buộc qua kiểm chuẩn

```text
Tải tệp (xlsx / csv) ─► Ghép cột (tự theo registry, người sửa được, lưu mẫu ghép ở user_meta)
  ─► Xem trước (20 dòng đầu, đã chuẩn hoá)
  ─► CHẠY THỬ: mỗi dòng gọi action ghi với dryRun = true, trong giao dịch HUỶ
       ⇒ bảng kết quả: dòng · trường · mã lỗi · câu sửa (bizcity_errors@1 remedy) · thêm mới / cập nhật
  ─► Ghi thật: cùng action, dryRun = false, theo lô (vd 500 dòng / giao dịch), chạy nền nếu lớn
  ─► Biên bản nhập: số dòng, lỗi, tệp lỗi tải về, gắn hoạt động + audit
```

- **Không có đường INSERT thẳng.** Mỗi dòng đi qua đúng action mà màn form dùng: cùng quyền, cùng validator, cùng `assertWritable`, cùng sự kiện. Nhập vào thực thể không có action ghi (`replica`, `ledger`, chứng từ đã duyệt) ⇒ màn nhập không mở (SC-ENT-4).
- **Idempotency:** khoá = băm (tệp + dòng). Nhập lại cùng tệp không tạo bản ghi trùng.
- Nhập chứng từ thì tạo **nháp**; duyệt vẫn theo workflow.

## 4. Xuất

| Định dạng | Ghi chú |
|---|---|
| CSV | BOM UTF-8 để Excel mở thẳng tiếng Việt — đã có |
| XLSX | thiếu — thêm ở F8 (một phụ thuộc, cần ADR theo R-PLAT-5) |
| JSON | `bizcity_list_export@1` — đã có |
| NDJSON | đã có |

- Cùng bộ lọc đang xem, cần quyền Xuất, ghi nhật ký (ảnh "Đơn bán hàng").
- Trên 10 000 dòng ⇒ chạy nền, báo ở chuông, tệp có hạn tải.
- Cột `sensitive` bị che theo quyền, giống màn.

## 5. Dev dùng thế nào

```ts
defineScreen({ entity: 'hrm.employee', views: ['list'], searchable: ['code', 'name', 'phone'],
               import: true, export: ['xlsx', 'csv'], bulk: ['hrm.employee.archive'] });
```

Hết. Không có thêm tệp importer, exporter hay route tìm.
