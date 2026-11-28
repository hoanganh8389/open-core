// [2026-11-29 12:39 AM Johnny Chu - Chu Hoàng Anh] S004-W1-5a / W1-3c — tự kiểm trình diễn tập (tools/dien-tap/dien-tap.mjs) và bộ dò API (tools/dien-tap/do-api.mjs):
//   migration lặp lại được + quay lui khôi phục giống hệt + nâng cấp lại tái lập ⇒ ĐẠT; migration không lặp lại được ⇒ B2 hỏng; migration chạm dữ liệu ⇒ B1 hỏng; CSDL nguồn không bị đụng.
//   Bộ dò API: báo cáo đổi số / ô quyền đổi trạng thái ⇒ lệch; POST luôn kèm dryRun=1; khoá thay đổi theo lần gọi không làm lệch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { base, csdlMoi, themDonVi, skip } from './_csdl.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PG_PKG = path.join(here, '../package.json').split(path.sep).join('/');
const NGUON = 'oc_t_dt_nguon';
const url = await csdlMoi(NGUON);
const { dienTap } = await import(new URL('../../../tools/dien-tap/dien-tap.mjs', import.meta.url).href);
const { doApi, soApi } = await import(new URL('../../../tools/dien-tap/do-api.mjs', import.meta.url).href);

const dir = mkdtempSync(path.join(tmpdir(), 'dt-buoc-'));
/** Lệnh migrate giả: một tệp .mjs chạy câu SQL trên DATABASE_URL. */
function lenh(ten, sqlText) {
  const f = path.join(dir, `${ten}.mjs`);
  writeFileSync(f, `import { createRequire } from 'node:module';
const pg = createRequire(${JSON.stringify(PG_PKG)})('pg');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
try { await c.query(${JSON.stringify(sqlText)}); } finally { await c.end(); }
console.log('migrate xong');\n`);
  return `"${process.execPath}" "${f}"`;
}
const chay = (nhan, lenhMigrate) => dienTap({ server: base, nguon: NGUON, nhan, lenhMigrate, hoSo: 'core', out: path.join(dir, nhan) });
const buoc = (bb) => Object.fromEntries(bb.buoc.map((b) => [b.ma, b.dat]));

test('migration lặp lại được: nâng cấp · chạy lại (giống hệt) · quay lui (giống hệt trước) · nâng cấp lại (tái lập) ⇒ ĐẠT; nguồn không đổi', { skip }, async () => {
  const bb = await chay('tot', lenh('tot', `CREATE TABLE IF NOT EXISTS thu_moi (id bigint PRIMARY KEY); INSERT INTO schema_migrations (name, source) VALUES ('9001_thu.sql', 'app') ON CONFLICT DO NOTHING`));
  assert.deepEqual(buoc(bb), { B1: true, B2: true, B3: true, B4: true }, JSON.stringify(bb.buoc.filter((b) => !b.dat)));
  assert.equal(bb.dat, true);
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try { assert.equal((await c.query(`SELECT to_regclass('public.thu_moi') AS t`)).rows[0].t, null, 'CSDL nguồn không bị migrate'); } finally { await c.end(); }
});

test('migration KHÔNG lặp lại được (mỗi lần chạy thêm một dòng sổ migration) ⇒ B2 hỏng, các bước khác vẫn đo', { skip }, async () => {
  const bb = await chay('lap', lenh('lap', `INSERT INTO schema_migrations (name, source) VALUES ('9002_' || md5(random()::text) || '.sql', 'app')`));
  assert.equal(bb.dat, false);
  assert.equal(buoc(bb).B2, false);
  assert.ok(bb.buoc.find((b) => b.ma === 'B2').lech.some((l) => l.ma === 'S-2'));
  assert.equal(buoc(bb).B3, true, 'quay lui vẫn khôi phục đúng');
});

test('migration chạm dữ liệu (đổi người dùng) ⇒ B1 hỏng ở H-3.users', { skip }, async () => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try { const t = await themDonVi(url, 'dt-u'); await c.query(`INSERT INTO users (tenant_id, email, full_name, password_hash, role) VALUES (${t}, 'a@b.c', 'A', 'x', 'viewer')`); } finally { await c.end(); }
  const bb = await chay('cham', lenh('cham', `UPDATE users SET full_name = 'đã đổi'`));
  assert.equal(buoc(bb).B1, false);
  assert.ok(bb.buoc.find((b) => b.ma === 'B1').lech.some((l) => l.ma === 'H-3.users'));
});

// ── bộ dò API
let srv, goc, state;
before(async () => {
  state = { tong: 100, choNhanVien: false, posts: [] };
  srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const vai = req.headers['x-vai'];
    const send = (s, j) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (u.pathname === '/bao-cao') return send(200, { requestId: Math.random(), data: { tong: state.tong, dong: [{ b: 2, a: 1 }] } });
    if (u.pathname === '/so-cai') return vai === 'ktt' || (vai === 'nv' && state.choNhanVien) ? send(200, { data: [] }) : send(403, { error: { code: 'FORBIDDEN' } });
    if (u.pathname === '/khoa-ky') { state.posts.push(u.search); return vai === 'ktt' ? send(200, { data: {}, meta: { dryRun: true } }) : send(403, { error: { code: 'FORBIDDEN' } }); }
    return send(404, {});
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  goc = `http://127.0.0.1:${srv.address().port}`;
});
after(() => srv?.close());

const KB = {
  nguoi: { ktt: { headers: { 'x-vai': 'ktt' } }, nv: { headers: { 'x-vai': '${DT_VAI_NV}' } } },
  bao_cao: [{ ma: 'BC-1', ten: 'cân đối', nguoi: 'ktt', get: '/bao-cao' }],
  quyen: { nguoi: ['ktt', 'nv'], duong: [{ ma: 'Q-1', get: '/so-cai' }, { ma: 'Q-2', post: '/khoa-ky', body: { ky: '2026-10' } }] },
};

test('do-api: hai bản giống nhau ⇒ ĐẠT (requestId đổi mỗi lần không làm lệch); POST luôn dryRun=1; biến môi trường trong kịch bản', async () => {
  process.env.DT_VAI_NV = 'nv';
  const a = await doApi(KB, goc), b = await doApi(KB, goc);
  assert.equal(soApi(a, b).dat, true);
  assert.equal(a.quyen['Q-1@nv'].status, 403); assert.equal(a.quyen['Q-2@ktt'].status, 200);
  assert.ok(state.posts.length > 0 && state.posts.every((s) => /dryRun=1/.test(s)), 'POST không bao giờ chạy thật');
});

test('do-api: báo cáo đổi số ⇒ lệch BC-1; quyền nới cho nhân viên ⇒ lệch đúng ô Q-1@nv', async () => {
  const a = await doApi(KB, goc);
  state.tong = 101; state.choNhanVien = true;
  const r = soApi(a, await doApi(KB, goc));
  state.tong = 100; state.choNhanVien = false;
  assert.deepEqual(r.lech.map((l) => l.ma).sort(), ['BC-1', 'Q-1@nv']);
  assert.match(r.lech.find((l) => l.ma === 'Q-1@nv').ly_do, /403 FORBIDDEN · sau 200/);
});
