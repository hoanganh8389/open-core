// [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 (R-CORE-8) — khoá có tiền tố riêng do APP giải (registerApiKeyResolver):
//   lõi không còn đọc bảng pos_installations của open-ketoan; chưa đăng ký ⇒ khoá đi đường khoá API thường (không khớp ⇒ 401), không mở thêm quyền.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { csdlMoi, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_apikey');
const A = await import('../dist/core/auth.js');
const { db } = await import('../dist/db/client.js');

let app;
before(async () => {
  if (!url) return;
  app = Fastify();
  await app.register(A.authPlugin);
  app.get('/api/v1/thu', async (req) => ({ tenantId: req.auth.tenantId, actor: req.auth.actor }));
  await app.ready();
});
after(async () => { await app?.close(); await db.destroy(); });

test('registerApiKeyResolver: khuôn tiền tố + không trùng / chồng tiền tố', () => {
  A.resetApiKeyResolvers();
  assert.throws(() => A.registerApiKeyResolver({ prefix: 'OKTI', resolve: async () => null }), /sai khuôn/);
  A.registerApiKeyResolver({ prefix: 'thu_', resolve: async () => null });
  assert.throws(() => A.registerApiKeyResolver({ prefix: 'thu_', resolve: async () => null }), /trùng/);
  A.resetApiKeyResolvers();
});

test('khoá okti_ khi app CHƯA đăng ký bộ giải ⇒ 401 (lõi không tự đọc bảng của kế toán); đăng ký ⇒ bộ giải của app quyết định', { skip }, async () => {
  A.resetApiKeyResolvers();
  const key = 'okti_' + 'x'.repeat(30);
  const r1 = await app.inject({ method: 'GET', url: '/api/v1/thu', headers: { 'x-api-key': key } });
  assert.equal(r1.json().code, 'UNAUTHORIZED', r1.body); // app thử không gắn bộ xử lý lỗi của lõi ⇒ so theo mã lỗi

  const seen = [];
  A.registerApiKeyResolver({ prefix: 'okti_', resolve: async (_req, k) => { seen.push(k); return { tenantId: '42', actor: 'install:thu', actorName: 'thu', kind: 'apikey', role: null, permissions: new Set() }; } });
  const r2 = await app.inject({ method: 'GET', url: '/api/v1/thu', headers: { 'x-api-key': key } });
  assert.equal(r2.statusCode, 200);
  assert.deepEqual(r2.json(), { tenantId: '42', actor: 'install:thu' });
  assert.deepEqual(seen, [key]);

  // khoá thường (không khớp tiền tố đã đăng ký) vẫn đi đường api_keys
  const r3 = await app.inject({ method: 'GET', url: '/api/v1/thu', headers: { 'x-api-key': 'kt_' + 'y'.repeat(30) } });
  assert.equal(r3.json().code, 'UNAUTHORIZED');
  A.resetApiKeyResolvers();
});
