// [2026-11-29 01:17 AM Johnny Chu - Chu Hoàng Anh] S005-F1 — module mẫu "golden": Nhóm khách viết lại bằng defineEntity (Entity Registry). Bản 0.6 viết tay
// 112 dòng (schema, thêm / sửa / lưu trữ / đọc, chống trùng, danh sách + xuất, nhập chạy thử, sự kiện); nay một khai báo, cùng hành vi, cùng mã action.
import { defineEntity, field } from '../../dist/entity/entity.js';

export const NhomKhach = defineEntity({
  key: 'golden.nhom-khach', label: 'Nhóm khách', class: 'config', storage: { table: 'golden_nhom_khach' }, lifecycle: 'archive',
  permissions: { read: 'documents:read', write: 'documents:write' }, path: '/api/v1/golden/nhom-khach',
  fields: {
    code: field.code('Mã nhóm', { upper: true, unique: true, pattern: /^[A-Z0-9_-]{2,20}$/, patternMessage: 'Mã 2–20 ký tự: chữ hoa, số, gạch', aliases: ['mã', 'code'] }),
    name: field.text('Tên nhóm', { max: 120, search: true, aliases: ['tên', 'name'] }),
    discount: field.number('Chiết khấu %', { min: 0, max: 100, default: 0, aliases: ['ck', 'chiết khấu'] }),
    note: field.text('Ghi chú', { max: 500, default: '', list: false }),
  },
});

export const { create: createNhomKhach, update: updateNhomKhach, archive: archiveNhomKhach, get: getNhomKhach, import: importNhomKhach } = NhomKhach.actions;
export const nhomKhachList = { list: NhomKhach.actions.list, export: NhomKhach.actions.export };
