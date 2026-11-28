// [2026-11-28 07:52 PM Johnny Chu - Chu Hoàng Anh] S003-14 + S003-19 — trục chứng từ chạy thật: defineDocumentType, tạo / sửa nháp / chuyển trạng thái,
// meta theo khoá đã khai, hoạt động chỉ thêm, huỷ nháp + lưu trữ / khôi phục (không xoá), tiền tệ + tỷ giá đóng băng khi rời nháp, ctx.documents trong action.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { z } from 'zod';
import { csdlMoi, themDonVi, nguoi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_spine');
const { currencyDigits, roundCurrency, toBaseAmount } = await import('@bizcity/contracts');
const { parseWorkflow } = await import('../dist/core/workflow.js');
const { defineDocumentType, documentSpine, resolveMoney } = await import('../dist/core/document-spine.js');
const { defineAction, runAction } = await import('../dist/core/actions.js');
const { db } = await import('../dist/db/client.js');

const wf = parseWorkflow(`
type: thu.don
label: Đơn thử
states:
  draft:   { group: draft, label: Nháp }
  waiting: { group: pending, label: Chờ duyệt }
  ok:      { group: approved, label: Đã duyệt }
  void:    { group: cancelled, label: Đã huỷ }
transitions:
  submit:  { title: Gửi duyệt, from: [draft], to: waiting, permission: documents:write }
  approve: { title: Duyệt, from: [waiting], to: ok, permission: payments:approve, sod: true }
  cancel:  { title: Huỷ nháp, from: [draft], to: void, permission: documents:write, requires: [reason] }
`, 'thu.don.yaml');
defineDocumentType({ type: 'thu.don', label: 'Đơn thử', series: 'DT', workflow: wf, meta: z.object({ kenh: z.enum(['zalo', 'web']), ghiChu: z.string().max(200) }) });

let t1, c;
before(async () => { if (!url) return; t1 = await themDonVi(url, 'thu-1'); c = new pg.Client({ connectionString: url }); await c.connect(); });
after(async () => { await c?.end(); await db.destroy(); });
const tx = (fn) => db.transaction().execute(fn);
const lap = nguoi('1', 1, 'documents:write'), duyet = nguoi('1', 2, 'documents:write', 'payments:approve');
const actorOf = (a) => ({ id: a.actor, can: (p) => a.permissions.has(p) });

test('tiền tệ (contracts): chữ số lẻ, làm tròn nửa xa số 0, quy về tiền hạch toán', () => {
  assert.equal(currencyDigits('VND'), 0); assert.equal(currencyDigits('USD'), 2); assert.equal(currencyDigits('KWD'), 3);
  assert.throws(() => currencyDigits('usd'));
  assert.equal(roundCurrency(100.255, 'USD'), 100.26);
  assert.equal(roundCurrency(-2.5, 'VND'), -3);
  assert.equal(toBaseAmount(100.26, 25400.5), 2546654);
  assert.throws(() => toBaseAmount(1, 0));
});

test('resolveMoney: cùng tiền ⇒ tỷ giá 1; ngoại tệ cần tỷ giá + nguyên tệ, máy chủ tự tính tổng (R-FX-1..3)', () => {
  assert.deepEqual(resolveMoney({ total: 1250000 }), { total: 1250000, currency: 'VND', fxRate: 1, totalFc: null });
  assert.deepEqual(resolveMoney({ currency: 'USD', fxRate: 25400.5, totalFc: 100.255 }), { total: 2546654, currency: 'USD', fxRate: 25400.5, totalFc: 100.26 });
  assert.equal(ma0(() => resolveMoney({ currency: 'USD', totalFc: 10 })), 'VALIDATION_ERROR');
  assert.equal(ma0(() => resolveMoney({ currency: 'usd', fxRate: 1, totalFc: 1 })), 'VALIDATION_ERROR');
  assert.equal(ma0(() => resolveMoney({ currency: 'USD', fxRate: 25000, totalFc: 10, total: 1 })), 'VALIDATION_ERROR');
  assert.equal(ma0(() => resolveMoney({ total: 5, fxRate: 2 })), 'VALIDATION_ERROR');
});
function ma0(fn) { try { fn(); return 'OK'; } catch (e) { return e.code ?? e.message; } }

test('tạo: số theo dãy của loại, nháp đầu tiên, meta đúng khoá; sai khoá / sai kiểu bị từ chối', { skip }, async () => {
  const h = await tx((trx) => documentSpine.create(trx, t1, 'thu.don', { date: '2026-11-28', title: 'Đơn chị Thu', total: 1250000, meta: { kenh: 'zalo' } }, 'user:1'));
  assert.equal(h.docRef, 'thu.don:DT-2026-0001');
  assert.equal(h.status, 'draft'); assert.equal(h.group, 'draft');
  assert.deepEqual([h.total, h.currency, h.fxRate, h.totalFc], [1250000, 'VND', 1, null]);
  assert.deepEqual(h.meta, { kenh: 'zalo' });
  assert.equal(await ma(tx((trx) => documentSpine.create(trx, t1, 'thu.don', { meta: { mau: 'do' } }, 'user:1'))), 'VALIDATION_ERROR');
  assert.equal(await ma(tx((trx) => documentSpine.create(trx, t1, 'thu.don', { meta: { kenh: 'fax' } }, 'user:1'))), 'VALIDATION_ERROR');
  assert.equal(await ma(tx((trx) => documentSpine.create(trx, t1, 'thu.khong-co', {}, 'user:1'))), 'NOT_FOUND');
});

test('ngoại tệ: sửa được khi nháp; rời nháp thì tiền + tỷ giá đóng băng; duyệt ghi người duyệt; hoạt động đủ bước', { skip }, async () => {
  const h = await tx((trx) => documentSpine.create(trx, t1, 'thu.don', { date: '2026-11-28', currency: 'USD', fxRate: 25400.5, totalFc: 100.255 }, 'user:1'));
  assert.deepEqual([h.total, h.currency, h.fxRate, h.totalFc], [2546654, 'USD', 25400.5, 100.26]);
  const h2 = await tx((trx) => documentSpine.update(trx, t1, h.docRef, { fxRate: 25500 }, 'user:1'));
  assert.deepEqual([h2.total, h2.totalFc], [2556630, 100.26]);
  await tx((trx) => documentSpine.transition(trx, t1, h.docRef, 'submit', actorOf(lap)));
  assert.equal(await ma(tx((trx) => documentSpine.update(trx, t1, h.docRef, { fxRate: 26000 }, 'user:1'))), 'CONFLICT');
  assert.equal(await ma(tx((trx) => documentSpine.transition(trx, t1, h.docRef, 'approve', actorOf(nguoi(t1, 1, 'payments:approve'))))), 'FORBIDDEN', 'tách nhiệm');
  const ok = await tx((trx) => documentSpine.transition(trx, t1, h.docRef, 'approve', actorOf(duyet)));
  assert.deepEqual([ok.status, ok.group, ok.approvedBy], ['ok', 'approved', 'user:2']);
  const act = await tx((trx) => documentSpine.activities(trx, t1, h.docRef));
  assert.deepEqual(act.map((a) => [a.kind, a.from, a.to]), [['create', null, 'draft'], ['transition', 'draft', 'waiting'], ['transition', 'waiting', 'ok']]);
  const r = (await c.query('SELECT fx_rate::text, total::text FROM business_documents WHERE doc_ref = $1', [h.docRef])).rows[0];
  assert.deepEqual(r, { fx_rate: '25500.000000', total: '2556630.0000' });
});

test('không xoá: huỷ nháp cần lý do; lưu trữ chỉ khi đã kết thúc; lưu trữ thì không chuyển; khôi phục; hoạt động chỉ thêm', { skip }, async () => {
  const h = await tx((trx) => documentSpine.create(trx, t1, 'thu.don', { title: 'Nháp bỏ' }, 'user:1'));
  assert.equal(await ma(tx((trx) => documentSpine.archive(trx, t1, h.docRef, 'user:1', 'dọn'))), 'CONFLICT', 'nháp chưa kết thúc');
  assert.equal(await ma(tx((trx) => documentSpine.transition(trx, t1, h.docRef, 'cancel', actorOf(lap)))), 'VALIDATION_ERROR');
  const v = await tx((trx) => documentSpine.transition(trx, t1, h.docRef, 'cancel', actorOf(lap), { reason: 'Khách đổi ý' }));
  assert.equal(v.group, 'cancelled');
  assert.equal(await ma(tx((trx) => documentSpine.archive(trx, t1, h.docRef, 'user:1', ' '))), 'VALIDATION_ERROR');
  await tx((trx) => documentSpine.archive(trx, t1, h.docRef, 'user:1', 'Dọn danh sách'));
  assert.equal((await tx((trx) => documentSpine.get(trx, t1, h.docRef))).archived, true);
  assert.equal(await ma(tx((trx) => documentSpine.note(trx, t1, h.docRef, '  ', 'user:1'))), 'VALIDATION_ERROR');
  await tx((trx) => documentSpine.note(trx, t1, h.docRef, 'Đã gọi lại cho khách', 'user:1'));
  await tx((trx) => documentSpine.restore(trx, t1, h.docRef, 'user:1'));
  const act = await tx((trx) => documentSpine.activities(trx, t1, h.docRef));
  assert.deepEqual(act.map((a) => a.kind), ['create', 'transition', 'archive', 'note', 'restore']);
  assert.equal(act[1].reason, 'Khách đổi ý');
  await assert.rejects(c.query("UPDATE document_activities SET body = 'sửa' WHERE doc_ref = $1", [h.docRef]), /chỉ thêm/);
  await assert.rejects(c.query('DELETE FROM document_activities WHERE doc_ref = $1', [h.docRef]), /chỉ thêm/);
});

test('ctx.documents trong action: chỉ tạo / chuyển chứng từ của module mình; quyền chuyển lấy từ người gọi', { skip }, async () => {
  const tao = defineAction({
    id: 'thu.don.tao', title: 'Tạo đơn', permission: 'documents:write', effect: 'write', idempotency: 'required', sideEffects: ['documents'],
    input: z.object({ type: z.string() }), output: z.object({ id: z.string() }), expose: {},
    async handler(ctx, i) { const h = await ctx.documents.create(i.type, { title: 'qua action' }); await ctx.documents.transition(h.docRef, 'submit'); return { id: h.docRef }; },
  });
  const r = await runAction(tao, { type: 'thu.don' }, { auth: nguoi(t1, 1, 'documents:write'), requestId: 'r1', idempotencyKey: 'khoa-don-0001' });
  assert.match(r.data.id, /^thu\.don:DT-\d{4}-\d{4}$/);
  assert.equal((await tx((trx) => documentSpine.get(trx, t1, r.data.id))).status, 'waiting');
  assert.equal(await ma(runAction(tao, { type: 'ban-hang.don' }, { auth: nguoi(t1, 1, 'documents:write'), requestId: 'r2', idempotencyKey: 'khoa-don-0002' })), 'VALIDATION_ERROR');
});
