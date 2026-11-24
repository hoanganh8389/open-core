// [2026-11-24 06:03 PM Johnny Chu - Chu Hoàng Anh] P2b-1 — kiểm trình chạy migration chung trên Postgres thật (node:test, không thêm phụ thuộc — R-PLAT-5).
// Chạy: TEST_DATABASE_URL=postgres://… node --test packages/platform/test/  (sau npm run build). Không có TEST_DATABASE_URL ⇒ bỏ qua.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= url ?? 'postgres://x@localhost/x';
const { runMigrations, planMigrations, pendingMigrations, requiredSchemaVersion } = await import('../dist/db/migrate.js');

const dir = (files) => { const d = mkdtempSync(path.join(tmpdir(), 'mig-')); for (const [n, s] of Object.entries(files)) writeFileSync(path.join(d, n), s); return d; };
const platform = dir({ '0001_nen.sql': 'CREATE TABLE nen (id int);', 'README.md': 'không phải migration' });
const app = dir({ '0101_app.sql': 'CREATE TABLE app_a (id int);', '0102_app.sql': 'CREATE TABLE app_b (id int);' });
const sources = [{ name: 'platform', dir: platform }, { name: 'cake', dir: app }];

test('gộp nhiều nguồn theo tên, bỏ tệp không phải NNNN_*.sql', () => {
  assert.deepEqual(planMigrations({ sources }).map((m) => `${m.source}:${m.file}`), ['platform:0001_nen.sql', 'cake:0101_app.sql', 'cake:0102_app.sql']);
  assert.equal(requiredSchemaVersion({ sources }), '0102_app.sql');
});

test('trùng tên giữa hai nguồn ⇒ dừng trước khi chạm DB (D-PLAT-5)', () => {
  const clash = dir({ '0101_app.sql': 'SELECT 1;' });
  assert.throws(() => planMigrations({ sources: [...sources, { name: 'khac', dir: clash }] }), /có ở cả nguồn "cake" và "khac"/);
});

test('áp một lần, chạy lại không áp nữa; hook được gọi; pending đúng', { skip: !url && 'không có TEST_DATABASE_URL' }, async () => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const calls = [];
    const hooks = { beforeApply: async (_q, done) => { calls.push(`before:${done.size}`); }, afterApply: async () => { calls.push('after'); } };
    assert.deepEqual(await runMigrations(() => {}, { connectionString: url, sources, hooks }), ['0001_nen.sql', '0101_app.sql', '0102_app.sql']);
    assert.deepEqual(await runMigrations(() => {}, { connectionString: url, sources, hooks }), []);
    assert.deepEqual(calls, ['before:0', 'after', 'before:3', 'after']);
    mkdirSync(app, { recursive: true }); writeFileSync(path.join(app, '0103_app.sql'), 'CREATE TABLE app_c (id int);');
    assert.deepEqual(await pendingMigrations(c, { sources }), ['0103_app.sql']);
    assert.deepEqual(await pendingMigrations(c, { sources, hooks: { isApplied: (f) => f === '0103_app.sql' } }), []);
  } finally { await c.end(); }
});

test('migration lỗi ⇒ quay lui, không ghi nhận, giữ lỗi gốc', { skip: !url && 'không có TEST_DATABASE_URL' }, async () => {
  const bad = dir({ '0201_loi.sql': 'CREATE TABLE ok_truoc (id int); SELECT * FROM khong_co_bang;' });
  await assert.rejects(runMigrations(() => {}, { connectionString: url, sources: [...sources, { name: 'loi', dir: bad }] }), (e) => /0201_loi\.sql lỗi/.test(e.message) && e.cause?.code === '42P01');
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    assert.equal((await c.query("SELECT to_regclass('ok_truoc') AS t")).rows[0].t, null);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM schema_migrations WHERE name = '0201_loi.sql'")).rows[0].n, 0);
  } finally { await c.end(); }
});

test('hook riêng open-ketoan vẫn giữ hành vi cũ (gộp file gốc, đổi tên) — chỉ khi app gắn vào', async () => {
  const { ketoanLegacyHooks: h } = await import('../dist/db/migrate-ketoan-legacy.js');
  const done = new Set(['0067_danh_muc_hang_chuan.sql', '0028_thue_kkkn.sql']);
  assert.equal(h.isApplied('0001_goc_nen_tang.sql', done), true);
  assert.equal(h.isApplied('0031_thue_kkkn.sql', done), true);
  assert.equal(h.isApplied('0101_app.sql', done), false);
});
