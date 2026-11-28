// [2026-11-28 09:41 PM Johnny Chu - Chu Hoàng Anh] S004-W2-3 (PHASE-004 Q-P4-1) — cổng mở có kiểu: definePort / providePort / ctx.port; nhà cung cấp nhận PortCall (tx, người gọi,
// mã action, effect, dryRun) để tự kiểm luật; thiếu nhà cung cấp ⇒ CAPABILITY_MISSING; ctx.ledger (cũ, deprecated) chuyển thẳng sang cổng "ledger" khi app đã cấp, còn không thì chạy cổng cũ.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { csdlMoi, themDonVi, nguoi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_ports');
const { definePort, providePort, resolvePort, findPort, hasPort, clearPorts } = await import('../dist/core/ports.js');
const { defineAction, runAction, registerLedgerReader } = await import('../dist/core/actions.js');
const { db } = await import('../dist/db/client.js');

let t1;
before(async () => { if (url) t1 = await themDonVi(url, 'cong-1'); });
after(async () => { await db.destroy(); });
beforeEach(() => clearPorts());

const PING = definePort('thu-ping');
const goi = (def, input = {}, extra = {}) => runAction(def, input, { auth: nguoi(t1, 1, 'documents:write', 'documents:read'), requestId: 'r-cong', idempotencyKey: 'khoa-cong-0001', ...extra });
const act = (id, effect, handler, extra = {}) => defineAction({
  id, title: id, permission: effect === 'write' ? 'documents:write' : 'documents:read', effect, idempotency: effect === 'write' ? 'natural' : 'natural',
  ...(effect === 'write' ? { sideEffects: ['documents'] } : {}), input: z.object({}), output: z.object({ v: z.unknown() }), expose: {}, handler, ...extra,
});

test('definePort: tên hợp lệ; providePort / hasPort / resolvePort; thiếu nhà cung cấp ⇒ CAPABILITY_MISSING nêu tên cổng', () => {
  assert.throws(() => definePort('Sai Ten'), /chữ thường/);
  assert.equal(definePort('so-cai').name, 'so-cai');
  assert.equal(hasPort(PING), false);
  const call = { tx: null, auth: undefined, tenantId: '1', actionId: 'thu.a.b', effect: 'read', dryRun: false };
  try { resolvePort(PING, call); assert.fail('phải ném'); } catch (e) { assert.equal(e.code, 'CAPABILITY_MISSING'); assert.match(e.message, /port:thu-ping/); }
  providePort(PING, (c) => ({ ping: (n) => `${c.actionId}:${n}` }));
  assert.equal(hasPort(PING), true);
  assert.equal(resolvePort(PING, call).ping(7), 'thu.a.b:7');
  assert.equal(findPort('khong-co', call), undefined);
  // gắn lại cùng tên thì thay
  providePort(PING, () => ({ ping: () => 'moi' }));
  assert.equal(resolvePort(PING, call).ping(1), 'moi');
});

test('ctx.port trong action: nhà cung cấp nhận giao dịch, người gọi, mã action, effect, dryRun — để tự kiểm luật của nó', { skip }, async () => {
  const seen = [];
  providePort(PING, (c) => { seen.push({ actionId: c.actionId, effect: c.effect, tenantId: c.tenantId, actor: c.auth?.actor, dryRun: c.dryRun, hasTx: typeof c.tx.selectFrom === 'function' }); return { ping: (n) => n * 2 }; });
  const doc = await goi(act('thu.cong.doc', 'read', async (ctx) => ({ v: ctx.port(PING).ping(21) })));
  assert.equal(doc.data.v, 42);
  const ghi = await goi(act('thu.cong.ghi', 'write', async (ctx) => ({ v: ctx.port(PING).ping(1) })));
  assert.equal(ghi.data.v, 2);
  assert.deepEqual(seen.map((s) => [s.actionId, s.effect, s.tenantId, s.actor, s.dryRun, s.hasTx]), [['thu.cong.doc', 'read', t1, 'user:1', false, true], ['thu.cong.ghi', 'write', t1, 'user:1', false, true]]);
});

test('luật của bên cấp: nhà cung cấp tự chặn action đọc nộp sổ (lõi không biết luật ấy) — lỗi trong handler huỷ giao dịch', { skip }, async () => {
  const { Errors } = await import('../dist/core/errors.js');
  providePort(PING, (c) => ({ ping: () => { if (c.effect !== 'write') throw Errors.validation('Action đọc không được nộp'); return 'ok'; } }));
  assert.equal(await ma(goi(act('thu.cong.doc2', 'read', async (ctx) => ({ v: ctx.port(PING).ping() })))), 'VALIDATION_ERROR');
  assert.equal((await goi(act('thu.cong.ghi2', 'write', async (ctx) => ({ v: ctx.port(PING).ping() })))).data.v, 'ok');
});

test('chưa cấp cổng ⇒ action ném CAPABILITY_MISSING (module cần cổng mà app chưa lắp)', { skip }, async () => {
  assert.equal(await ma(goi(act('thu.cong.thieu', 'read', async (ctx) => ({ v: ctx.port(PING).ping(1) })))), 'CAPABILITY_MISSING');
});

test('cầu nối ctx.ledger (deprecated): app đã cấp cổng "ledger" ⇒ chuyển thẳng, bỏ qua cổng cũ; chưa cấp ⇒ chạy cổng cũ', { skip }, async () => {
  registerLedgerReader(async () => [{ legacy: true }]);
  const q = act('thu.cong.so', 'read', async (ctx) => ({ v: await ctx.ledger.query({ account: '111' }) }));
  assert.deepEqual((await goi(q)).data.v, [{ legacy: true }], 'chưa cấp cổng ⇒ cổng cũ');
  providePort(definePort('ledger'), (c) => ({
    query: async (x) => [{ viaPort: true, account: x.account, by: c.actionId }],
    submit: async (d) => ({ docKey: d.docKey, viaPort: true }),
    cancel: async () => ({ requested: true, reversed: 0 }), get: async () => null, allocateDebt: async () => ({ allocated: 0 }),
  }));
  assert.deepEqual((await goi(q)).data.v, [{ viaPort: true, account: '111', by: 'thu.cong.so' }], 'đã cấp cổng ⇒ chuyển thẳng');
  const nop = act('thu.cong.nop', 'write', async (ctx) => ({ v: await ctx.ledger.submit({ docKey: 'thu:1', docType: 'x' }) }));
  assert.deepEqual((await goi(nop)).data.v, { docKey: 'thu:1', viaPort: true });
});
