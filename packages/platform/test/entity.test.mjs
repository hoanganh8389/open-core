// [2026-11-29 01:17 AM Johnny Chu - Chu Hoàng Anh] S005-F1 — Entity Registry: khai sai bị chặn lúc nạp; SC-ENT-1 (lớp không an toàn không sinh ghi);
// metadata không lộ SQL; core.meta.entities lọc theo quyền đọc; schema sinh ra kiểm đúng (mặc định, chữ hoa, enum, ngày).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { csdlMoi, themDonVi, nguoi, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_entity');
const { defineEntity, field, entityMeta, listEntities, getEntity, entitiesMetaAction } = await import('../dist/entity/entity.js');
const { runAction } = await import('../dist/core/actions.js');
const { db } = await import('../dist/db/client.js');
after(async () => { await db.destroy(); });

const base = { label: 'Thử', storage: { table: 'thu_bang' }, fields: { code: field.code('Mã', { upper: true, unique: true }) }, permissions: { read: 'documents:read' } };
const loi = (input) => { try { defineEntity(input); return 'OK'; } catch (e) { return e.message; } };

test('khai sai bị chặn ngay lúc nạp', () => {
  assert.match(loi({ ...base, key: 'ThuSai', class: 'config' }), /<module>\.<thực-thể>/);
  assert.match(loi({ ...base, key: 'thu.a', class: 'lop-la' }), /class "lop-la" lạ/);
  assert.match(loi({ ...base, key: 'thu.b', class: 'config', storage: { table: 'bang; DROP' } }), /định danh SQL/);
  assert.match(loi({ ...base, key: 'thu.c', class: 'config', fields: { tenant_id: field.text('x') }, permissions: { read: 'documents:read', write: 'documents:write' } }), /cột hệ thống/);
  assert.match(loi({ ...base, key: 'thu.d', class: 'config' }), /cần permissions.write/);
  assert.match(loi({ ...base, key: 'thu.e', class: 'config', fields: { loai: field.enum('Loại', []) }, permissions: { read: 'documents:read', write: 'documents:write' } }), /enum cần values/);
});

test('SC-ENT-1: master / replica / document / ledger không sinh ghi; khai quyền ghi cho chúng là lỗi', () => {
  for (const cls of ['master', 'replica', 'document', 'ledger']) {
    assert.match(loi({ ...base, key: `thu.ghi-${cls}`, class: cls, permissions: { read: 'documents:read', write: 'documents:write' } }), /SC-ENT-1/);
  }
  const m = defineEntity({ ...base, key: 'thu.mat-hang', class: 'master' });
  assert.deepEqual(Object.keys(m.actions).sort(), ['export', 'get', 'list']);
  const c = defineEntity({ ...base, key: 'thu.cau-hinh', class: 'config', permissions: { read: 'documents:read', write: 'documents:write' } });
  assert.deepEqual(Object.keys(c.actions).sort(), ['create', 'export', 'get', 'import', 'list', 'update']);
  assert.equal(c.actions.create.id, 'thu.cau-hinh.create');
  assert.match(loi({ ...base, key: 'thu.cau-hinh', class: 'config', permissions: { read: 'documents:read', write: 'documents:write' } }), /đã khai/);
});

test('schema sinh ra: chữ hoa, mặc định, enum, ngày, số nhận chuỗi', () => {
  const e = defineEntity({
    key: 'thu.lich', label: 'Lịch', class: 'record', storage: { table: 'thu_lich' }, permissions: { read: 'documents:read', write: 'documents:write' },
    fields: { code: field.code('Mã', { upper: true }), ngay: field.date('Ngày'), loai: field.enum('Loại', ['a', 'b'], { default: 'a' }), so: field.number('Số', { min: 0 }) },
  });
  assert.deepEqual(e.schemas.create.parse({ code: ' ab1 ', ngay: '2026-11-29', so: '3' }), { code: 'AB1', ngay: '2026-11-29', loai: 'a', so: 3 });
  assert.equal(e.schemas.create.safeParse({ code: 'x', ngay: '29/11/2026', so: 1 }).success, false);
  assert.equal(e.schemas.create.safeParse({ code: 'x', ngay: '2026-11-29', so: -1 }).success, false);
  assert.equal(e.schemas.patch.safeParse({ id: '1', so: 2 }).success, true, 'sửa một phần');
});

test('metadata: không lộ bảng / SQL; có trường, nhãn, bắt buộc, action', () => {
  const m = entityMeta(getEntity('thu.cau-hinh'));
  assert.equal(JSON.stringify(m).includes('thu_bang'), false);
  assert.deepEqual(m.fields[0], { name: 'code', kind: 'code', label: 'Mã', required: true, unique: true, search: true, list: true });
  assert.equal(m.actions.list, 'thu.cau-hinh.list');
  assert.ok(listEntities().length >= 3);
});

test('core.meta.entities lọc theo quyền đọc của người gọi', { skip }, async () => {
  const t = await themDonVi(url, 'entity-1');
  defineEntity({ ...base, key: 'thu.bi-mat', class: 'master', permissions: { read: 'payments:approve' } });
  const coQuyen = (await runAction(entitiesMetaAction, {}, { auth: nguoi(t, 1, 'documents:read', 'payments:approve'), requestId: 'r-meta-1' })).data.entities.map((e) => e.key);
  const khong = (await runAction(entitiesMetaAction, {}, { auth: nguoi(t, 2, 'documents:read'), requestId: 'r-meta-2' })).data.entities.map((e) => e.key);
  assert.ok(coQuyen.includes('thu.bi-mat'));
  assert.equal(khong.includes('thu.bi-mat'), false);
  assert.ok(khong.includes('thu.cau-hinh'));
});
