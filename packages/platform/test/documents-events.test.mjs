// [2026-11-28 07:41 PM Johnny Chu - Chu Hoàng Anh] S001-T — trục chứng từ + sự kiện của lõi chạy thật: cấp số (bộ đếm mặc định của lõi), phiên bản
// (nội dung trùng không thêm), liên kết DocLink, cô lập đơn vị bằng RLS với vai ứng dụng; outbox → phát cho subscriber, lỗi thì thử lại rồi vào dead.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { csdlMoi, themDonVi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_documents');
const { documents } = await import('../dist/core/documents.js');
const { emitEvent, defineSubscriber, registerSubscribers, dispatchOnce } = await import('../dist/core/events.js');
const { db } = await import('../dist/db/client.js');

let t1, t2, c;
before(async () => { if (!url) return; t1 = await themDonVi(url, 'thu-1'); t2 = await themDonVi(url, 'thu-2'); c = new pg.Client({ connectionString: url }); await c.connect(); });
after(async () => { await c?.end(); await db.destroy(); });
const tx = (fn) => db.transaction().execute(fn);

test('cấp số: bộ đếm mặc định của lõi, tăng dần theo (đơn vị, dãy, năm), mỗi đơn vị một dãy', { skip }, async () => {
  const so = (t, d) => tx((trx) => documents.nextNumber(trx, t, 'thu', 'GC', { date: d }));
  assert.equal(await so(t1, '2026-11-28'), 'GC-2026-0001');
  assert.equal(await so(t1, '2026-11-28'), 'GC-2026-0002');
  assert.equal(await so(t2, '2026-11-28'), 'GC-2026-0001');
  assert.equal(await so(t1, '2027-01-02'), 'GC-2027-0001');
  assert.equal(await ma(so(t1, '28/11/2026')), 'VALIDATION_ERROR');
  assert.equal(await ma(tx((trx) => documents.nextNumber(trx, t1, 'thu', 'gc thường'))), 'VALIDATION_ERROR');
  // giao dịch huỷ thì số không bị dùng
  await assert.rejects(tx(async (trx) => { await documents.nextNumber(trx, t1, 'thu', 'GC', { date: '2026-11-28' }); throw new Error('huỷ'); }));
  assert.equal(await so(t1, '2026-11-28'), 'GC-2026-0003');
});

test('phiên bản: chỉ thêm; nội dung trùng bản mới nhất ⇒ không thêm; đọc lại đúng ảnh chụp', { skip }, async () => {
  const ref = 'thu.ghi-chu:GC-2026-0001';
  const luu = (s) => tx((trx) => documents.saveVersion(trx, t1, ref, s, 'user:1'));
  assert.deepEqual(await luu({ a: 1, b: [1, 2] }), { version: 1, created: true });
  assert.deepEqual(await luu({ b: [1, 2], a: 1 }), { version: 1, created: false }, 'thứ tự khoá không đổi băm');
  assert.deepEqual(await luu({ a: 2, b: [1, 2] }), { version: 2, created: true });
  const v = await tx((trx) => documents.versions(trx, t1, ref));
  assert.deepEqual(v.map((x) => x.version), [1, 2]);
  assert.deepEqual((await tx((trx) => documents.version(trx, t1, ref, 1))).snapshot, { a: 1, b: [1, 2] });
  assert.equal(await ma(tx((trx) => documents.version(trx, t1, ref, 9))), 'NOT_FOUND');
  assert.equal(await ma(tx((trx) => documents.saveVersion(trx, t1, 'không-phải-ref', {}, 'user:1'))), 'VALIDATION_ERROR');
});

test('liên kết DocLink: vai hợp lệ, gắn lặp giữ một dòng, đọc hai chiều', { skip }, async () => {
  const a = 'ban-hang.don:DB-2026-0142', b = 'kho.xuat:XK-2026-0142';
  await tx((trx) => documents.link(trx, t1, a, b, 'source', 'user:1'));
  await tx((trx) => documents.link(trx, t1, a, b, 'source', 'user:1'));
  const l = await tx((trx) => documents.links(trx, t1, b));
  assert.deepEqual(l.map((x) => [x.from, x.to, x.role]), [[a, b, 'source']]);
  assert.equal(await ma(tx((trx) => documents.link(trx, t1, a, a, 'source', 'user:1'))), 'VALIDATION_ERROR');
  assert.equal(await ma(tx((trx) => documents.link(trx, t1, a, b, 'ban-be', 'user:1'))), 'VALIDATION_ERROR');
});

test('cô lập đơn vị (RLS): vai ứng dụng chỉ thấy dòng của đơn vị đang đặt', { skip }, async () => {
  await c.query('BEGIN');
  try {
    await c.query('SET LOCAL ROLE oc_app');
    await c.query(`SELECT set_config('bizcity.tenant_id', $1, true)`, [t2]);
    const r = await c.query('SELECT DISTINCT tenant_id::text t FROM document_sequences');
    assert.deepEqual(r.rows.map((x) => x.t), [t2]);
    await assert.rejects(c.query('INSERT INTO document_links (tenant_id, from_ref, to_ref, role, created_by) VALUES ($1, $2, $3, $4, $5)', [t1, 'a.b:1', 'a.b:2', 'source', 'x']), /row-level security/);
  } finally { await c.query('ROLLBACK'); }
});

test('sự kiện: outbox → subscriber nhận đúng một lần; lỗi thì thử lại, quá số lần ⇒ dead', { skip }, async () => {
  const nhan = [];
  registerSubscribers([
    defineSubscriber({ id: 'thu.dem', module: 'thu', on: ['thu.ghi-chu.da-tao'], async handle(_ctx, e) { nhan.push(e.subject); } }),
    defineSubscriber({ id: 'thu.hong', module: 'thu', on: ['thu.ghi-chu.da-tao'], retry: { maxAttempts: 1 }, async handle() { throw new Error('hỏng có chủ ý'); } }),
  ]);
  const id = await tx((trx) => emitEvent(trx, { tenantId: t1, type: 'thu.ghi-chu.da-tao', subject: 'thu.ghi-chu:1', source: 'thu', data: {}, actor: { kind: 'system', id: 'thu' }, dedupeKey: 'gc-1' }));
  assert.ok(id);
  assert.equal(await tx((trx) => emitEvent(trx, { tenantId: t1, type: 'thu.ghi-chu.da-tao', subject: 'thu.ghi-chu:1', source: 'thu', data: {}, actor: { kind: 'system', id: 'thu' }, dedupeKey: 'gc-1' })), null, 'trùng dedupeKey không phát lại');
  const r = await dispatchOnce({ tenantId: t1 });
  assert.equal(r.done, 1);
  assert.equal(r.dead, 1);
  assert.deepEqual(nhan, ['thu.ghi-chu:1']);
  const again = await dispatchOnce({ tenantId: t1 });
  assert.equal(again.done + again.dead + again.failed, 0, 'không giao lại');
  const st = (await c.query("SELECT consumer, status FROM event_deliveries ORDER BY consumer")).rows;
  assert.deepEqual(st.map((x) => `${x.consumer}:${x.status}`), ['thu.dem:done', 'thu.hong:dead']);
});
