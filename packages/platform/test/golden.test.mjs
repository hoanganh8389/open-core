// [2026-11-29 01:09 AM Johnny Chu - Chu Hoàng Anh] S005-F0-2 — module mẫu "golden" chạy thật trên Postgres: chứng minh mã đếm ở Scoreboard DX là mã làm được việc
// (thêm / sửa / trùng mã / lưu trữ / đọc / danh sách + lọc / xuất / nhập chạy thử + lỗi từng dòng / chứng từ lập → gửi → duyệt tách nhiệm / ghi chú / sự kiện).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { csdlMoi, themDonVi, nguoi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_golden');
if (url) {
  const c0 = new pg.Client({ connectionString: url }); await c0.connect();
  try { await c0.query(readFileSync(new URL('./golden/0001_golden.sql', import.meta.url), 'utf8')); } finally { await c0.end(); }
}
const { runAction } = await import('../dist/core/actions.js');
const { db } = await import('../dist/db/client.js');
const nk = await import('./golden/nhom-khach.mjs');
const py = await import('./golden/phieu-yeu-cau.mjs');

let t1, c;
before(async () => { if (!url) return; t1 = await themDonVi(url, 'golden-1'); c = new pg.Client({ connectionString: url }); await c.connect(); });
after(async () => { await c?.end(); await db.destroy(); });
let k = 0;
const goi = (def, input, auth) => runAction(def, input, { auth, requestId: `r-golden-${++k}`, idempotencyKey: `golden-khoa-${String(k).padStart(4, '0')}` });
const lap = () => nguoi(t1, 1, 'documents:read', 'documents:write');
const duyet = () => nguoi(t1, 2, 'documents:read', 'documents:write', 'payments:approve');

test('golden · Nhóm khách: thêm, trùng mã, sửa, đọc, lưu trữ / khôi phục, sự kiện', { skip }, async () => {
  const a = (await goi(nk.createNhomKhach, { code: 'vip', name: 'Khách VIP', discount: '10' }, lap())).data;
  assert.deepEqual([a.code, a.discount, a.archived], ['VIP', 10, false]);
  assert.equal(await ma(goi(nk.createNhomKhach, { code: 'VIP', name: 'Trùng' }, lap())), 'CONFLICT');
  assert.equal(await ma(goi(nk.createNhomKhach, { code: 'x', name: 'Mã ngắn' }, lap())), 'ZOD');
  assert.equal((await goi(nk.updateNhomKhach, { id: a.id, discount: 12 }, lap())).data.discount, 12);
  assert.equal((await goi(nk.getNhomKhach, { id: a.id }, lap())).data.name, 'Khách VIP');
  assert.equal((await goi(nk.archiveNhomKhach, { id: a.id }, lap())).data.archived, true);
  assert.equal(await ma(goi(nk.updateNhomKhach, { id: a.id, name: 'x' }, lap())), 'CONFLICT');
  assert.equal((await goi(nk.archiveNhomKhach, { id: a.id, restore: true }, lap())).data.archived, false);
  const ev = (await c.query("SELECT count(*)::int n FROM event_outbox WHERE type = 'golden.nhom-khach.changed'")).rows[0].n;
  assert.equal(ev, 4);
});

test('golden · Nhóm khách: nhập chạy thử báo lỗi từng dòng, ghi thật; danh sách lọc + xuất csv', { skip }, async () => {
  const rows = [['Mã nhóm', 'Tên nhóm', 'CK'], ['SI', 'Khách sỉ', '5'], ['LE', 'Khách lẻ', '0'], ['SI', 'Lặp', '1'], ['VIP', 'Đã có', '0'], ['Q', 'Mã ngắn', '0']];
  const thu = (await goi(nk.importNhomKhach, { rows, dryRun: true }, lap())).data;
  assert.equal(thu.written, false);
  assert.deepEqual(thu.errors.map((e) => [e.row, e.field]), [[4, 'code'], [5, 'code'], [6, 'code']]);
  const ghi = (await goi(nk.importNhomKhach, { rows: rows.slice(0, 3), dryRun: false }, lap())).data;
  assert.deepEqual([ghi.ok, ghi.written], [2, true]);
  const page = (await goi(nk.nhomKhachList.list, { 'f.code.in': 'SI,LE', sort: 'code' }, lap())).data;
  assert.deepEqual(page.data.map((r) => r.code), ['LE', 'SI']);
  const csv = (await goi(nk.nhomKhachList.export, { format: 'csv', sort: 'code' }, lap())).data;
  assert.equal(csv.rowCount, 3);
  assert.ok(csv.content.includes('Mã nhóm,Tên nhóm'));
});

test('golden · Phiếu yêu cầu: lập có số, gửi, người lập không tự duyệt, người khác duyệt, ghi chú, hoạt động đủ bước', { skip }, async () => {
  const h = (await goi(py.createPhieu, { date: '2026-11-29', title: 'Chị Thu đặt hàng', total: 1250000, meta: { nhomKhach: 'VIP', kenh: 'fanpage' } }, lap())).data;
  assert.match(h.docRef, /^golden\.phieu-yeu-cau:YC-2026-\d{4}$/);
  assert.equal((await goi(py.transitionPhieu, { docRef: h.docRef, verb: 'submit' }, lap())).data.status, 'pending');
  assert.equal(await ma(goi(py.transitionPhieu, { docRef: h.docRef, verb: 'approve' }, nguoi(t1, 1, 'documents:read', 'payments:approve'))), 'FORBIDDEN');
  assert.equal((await goi(py.transitionPhieu, { docRef: h.docRef, verb: 'approve' }, duyet())).data.group, 'approved');
  await goi(py.notePhieu, { docRef: h.docRef, body: 'Khách hẹn nhận chiều mai' }, lap());
  const kinds = (await c.query('SELECT kind FROM document_activities WHERE doc_ref = $1 ORDER BY id', [h.docRef])).rows.map((r) => r.kind);
  assert.deepEqual(kinds, ['create', 'transition', 'transition', 'note']);
});
