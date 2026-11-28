// [2026-11-28 07:41 PM Johnny Chu - Chu Hoàng Anh] S001-T — runtime action của lõi chạy thật trên Postgres (ACTION §4): quyền, khuôn input,
// Idempotency-Key (gửi lặp trả lại, khác nội dung ⇒ IDEMPOTENCY_CONFLICT), bằng chứng một bản ghi / lần ghi, lỗi trong handler ⇒ huỷ cả
// giao dịch (sự kiện không lọt) nhưng vẫn ghi bằng chứng thất bại, chạy thử không để lại gì, sự kiện chỉ trong vùng tên module.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { z } from 'zod';
import { csdlMoi, themDonVi, nguoi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_actions');
const { defineAction, runAction } = await import('../dist/core/actions.js');
const { Errors } = await import('../dist/core/errors.js');
const { db } = await import('../dist/db/client.js');

let t1, c;
before(async () => { if (!url) return; t1 = await themDonVi(url, 'thu-1'); c = new pg.Client({ connectionString: url }); await c.connect(); });
after(async () => { await c?.end(); await db.destroy(); });
const dem = async (sqlText, ...v) => Number((await c.query(sqlText, v)).rows[0].n);

const tao = defineAction({
  id: 'thu.ghi-chu.tao', title: 'Tạo ghi chú thử', permission: 'documents:write', effect: 'write', idempotency: 'required', sideEffects: ['documents'], dryRun: true,
  input: z.object({ text: z.string().min(1), hong: z.boolean().optional() }), output: z.object({ id: z.string() }), expose: {},
  async handler(ctx, input) {
    const id = `gc-${input.text}`;
    await ctx.events.emit('thu.ghi-chu.da-tao', { text: input.text }, { subject: `thu.ghi-chu:${id}` });
    if (input.hong) throw Errors.conflict('hỏng có chủ ý');
    return { id };
  },
});
const lac = defineAction({
  id: 'thu.ghi-chu.lac', title: 'Phát sự kiện ngoài vùng', permission: 'documents:write', effect: 'write', idempotency: 'natural', sideEffects: ['documents'],
  input: z.object({}), output: z.object({ id: z.string() }), expose: {},
  async handler(ctx) { await ctx.events.emit('ban-hang.don.da-tao', {}, { subject: 'x' }); return { id: 'x' }; },
});
const doc = defineAction({
  id: 'thu.ghi-chu.xem', title: 'Xem công khai', permission: 'public', effect: 'read', idempotency: 'natural',
  input: z.object({}), output: z.object({ ok: z.boolean() }), expose: {}, async handler() { return { ok: true }; },
});

const goi = (def, input, auth, extra = {}) => runAction(def, input, { auth, requestId: 'req-thu', ...extra });

test('quyền và khuôn input chặn trước khi chạm CSDL', { skip }, async () => {
  const ghi = nguoi(t1, 1, 'documents:write');
  assert.equal(await ma(goi(tao, { text: 'a' }, undefined, { idempotencyKey: 'khoa-0001' })), 'UNAUTHORIZED');
  assert.equal(await ma(goi(tao, { text: 'a' }, nguoi(t1, 2, 'documents:read'), { idempotencyKey: 'khoa-0001' })), 'FORBIDDEN');
  assert.equal(await ma(goi(tao, { text: '' }, ghi, { idempotencyKey: 'khoa-0001' })), 'ZOD');
  assert.equal(await ma(goi(tao, { text: 'a' }, ghi)), 'VALIDATION_ERROR');
  assert.equal(await ma(goi(tao, { text: 'a' }, ghi, { idempotencyKey: 'ngan' })), 'VALIDATION_ERROR');
  assert.equal(await dem('SELECT count(*) n FROM action_requests'), 0);
});

test('Idempotency-Key: lần đầu ghi + biên nhận; gửi lặp trả lại, không ghi thêm; khác nội dung ⇒ IDEMPOTENCY_CONFLICT', { skip }, async () => {
  const ghi = nguoi(t1, 1, 'documents:write');
  const a = await goi(tao, { text: 'mot' }, ghi, { idempotencyKey: 'khoa-mot-01' });
  assert.equal(a.data.id, 'gc-mot');
  assert.ok(a.meta.receipt?.evidenceId && a.meta.receipt.hash, 'có biên nhận bằng chứng');
  const b = await goi(tao, { text: 'mot' }, ghi, { idempotencyKey: 'khoa-mot-01' });
  assert.equal(b.meta.idempotency, 'replayed');
  assert.deepEqual(b.data, a.data);
  assert.equal(String(b.meta.receipt.evidenceId), String(a.meta.receipt.evidenceId));
  assert.equal(await ma(goi(tao, { text: 'hai' }, ghi, { idempotencyKey: 'khoa-mot-01' })), 'IDEMPOTENCY_CONFLICT');
  assert.equal(await dem("SELECT count(*) n FROM audit_logs WHERE action = 'thu.ghi-chu.tao' AND result_ok"), 1);
  assert.equal(await dem("SELECT count(*) n FROM event_outbox WHERE type = 'thu.ghi-chu.da-tao'"), 1);
  const ev = (await c.query("SELECT actor, actor_kind, tenant_id::text t, idempotency_key, object_id FROM audit_logs WHERE action = 'thu.ghi-chu.tao'")).rows[0];
  assert.deepEqual(ev, { actor: 'user:1', actor_kind: 'user', t: t1, idempotency_key: 'khoa-mot-01', object_id: 'gc-mot' });
});

test('lỗi trong handler ⇒ huỷ cả giao dịch (sự kiện không lọt), bằng chứng thất bại vẫn ghi', { skip }, async () => {
  const ghi = nguoi(t1, 1, 'documents:write');
  const truoc = await dem('SELECT count(*) n FROM event_outbox');
  assert.equal(await ma(goi(tao, { text: 'loi', hong: true }, ghi, { idempotencyKey: 'khoa-loi-01' })), 'CONFLICT');
  assert.equal(await dem('SELECT count(*) n FROM event_outbox'), truoc);
  assert.equal(await dem("SELECT count(*) n FROM audit_logs WHERE action = 'thu.ghi-chu.tao' AND NOT result_ok AND result_code = 'CONFLICT'"), 1);
  assert.equal(await dem("SELECT count(*) n FROM action_requests WHERE idem_key = 'khoa-loi-01'"), 0, 'khoá không bị giữ ⇒ gửi lại sau khi sửa được');
});

test('chạy thử: trả kết quả, không để lại gì', { skip }, async () => {
  const ghi = nguoi(t1, 1, 'documents:write');
  const truoc = await dem('SELECT count(*) n FROM event_outbox');
  const r = await goi(tao, { text: 'thu' }, ghi, { dryRun: true });
  assert.equal(r.meta.dryRun, true);
  assert.equal(r.data.id, 'gc-thu');
  assert.equal(await dem('SELECT count(*) n FROM event_outbox'), truoc);
  assert.equal(await dem("SELECT count(*) n FROM audit_logs WHERE object_id = 'gc-thu'"), 0);
});

test('sự kiện chỉ trong vùng tên module (STD-EVT-3); action đọc công khai không ghi bằng chứng', { skip }, async () => {
  assert.match(await ma(goi(lac, {}, nguoi(t1, 1, 'documents:write'))), /chỉ phát sự kiện thu\.\*/);
  const truoc = await dem('SELECT count(*) n FROM audit_logs');
  assert.deepEqual((await goi(doc, {}, undefined)).data, { ok: true });
  assert.equal(await dem('SELECT count(*) n FROM audit_logs'), truoc);
});
