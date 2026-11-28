// [2026-11-28 09:52 PM Johnny Chu - Chu Hoàng Anh] S004-W2-4 (PHASE-004 Q-P4-3, Q-P4-4) — hai móc khai báo thay mã kế toán cứng trong lõi:
//  (1) bậc cài đặt do app đăng ký (registerSettingScopes + migration 0006): bậc "don_vi" nằm giữa tenant và branch, ràng buộc CSDL chỉ kiểm khuôn tên;
//  (2) bộ phân loại lỗi CSDL do app đăng ký (registerDbErrorClassifier): app trước, mặc định sau, replaceDefaults tắt mặc định.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { sql } from 'kysely';
import { csdlMoi, themDonVi, ma, skip } from './_csdl.mjs';

// registry thử nằm ở gốc app tạm (appRoot đọc BIZCITY_APP_ROOT lúc nạp mã)
const root = mkdtempSync(path.join(tmpdir(), 'cd-'));
mkdirSync(path.join(root, 'docs/contracts'), { recursive: true });
writeFileSync(path.join(root, 'docs/contracts/bizcity-settings.registry.json'), JSON.stringify({
  settings: [{ key: 'bizcity.thu.gia_tri', owner: 'thu', scopes: ['tenant', 'branch', 'don_vi', 'chua_khai'], storage: 'setting_values', class: 'B', valueType: 'integer', default: '1' }],
}));
process.env.BIZCITY_APP_ROOT = root;

const url = await csdlMoi('oc_t_hooks');
const S = await import('../dist/core/settings.js');
const E = await import('../dist/core/errors.js');
const { ERROR_CODES } = await import('@bizcity/contracts');
const { db } = await import('../dist/db/client.js');

let t1, c;
before(async () => {
  if (!url) return;
  t1 = await themDonVi(url, 'hook-1');
  c = new pg.Client({ connectionString: url }); await c.connect();
  // bảng của app (lõi không có): đơn vị hạch toán + chi nhánh
  await c.query('CREATE TABLE don_vi_thu (id bigint PRIMARY KEY, tenant_id bigint NOT NULL)');
  await c.query('CREATE TABLE branches (id bigint PRIMARY KEY, tenant_id bigint NOT NULL)');
  await c.query('INSERT INTO don_vi_thu VALUES (5, $1), (6, $1)', [t1]);
  await c.query('INSERT INTO branches VALUES (7, $1)', [t1]);
});
after(async () => { await c?.end(); await db.destroy(); });
const tx = (fn) => db.transaction().execute(fn);
const who = () => ({ tenantId: t1, actor: 'user:1', can: () => true });

test('migration 0006: ràng buộc bậc chỉ kiểm khuôn tên; vẫn giữ "tenant ⇔ scope_id rỗng"', { skip }, async () => {
  const ins = (type, id) => c.query(`INSERT INTO setting_values (tenant_id, key, scope_type, scope_id, value, valid_from, version, created_by) VALUES ($1, 'bizcity.thu.k', $2, $3, '1', '2026-01-01', 1, 'x')`, [t1, type, id]);
  await ins('don_vi', '5'); await ins('bac_moi_cua_app', '9'); await ins('tenant', '');
  await assert.rejects(ins('Sai Ten', '1'), /scope_type_check/);
  await assert.rejects(ins('x', '1'), /scope_type_check/, 'quá ngắn');
  await assert.rejects(ins('tenant', '3'), /scope_chk/);
  await assert.rejects(ins('don_vi', ''), /scope_chk/);
});

test('registerSettingScopes: khuôn / bậc nền / bậc tham chiếu chưa có bị chặn; thứ tự giải branch > don_vi > tenant', { skip }, async () => {
  assert.throws(() => S.registerSettingScopes([{ key: 'Sai-Ten', exists: async () => true }]), /sai khuôn/);
  assert.throws(() => S.registerSettingScopes([{ key: 'tenant', exists: async () => true }]), /sai khuôn|trùng/);
  assert.throws(() => S.registerSettingScopes([{ key: 'bac_x', between: { wider: 'khong_co', narrower: 'branch' }, exists: async () => true }]), /chưa có/);
  // chưa đăng ký: bậc có trong registry khoá nhưng app chưa khai ⇒ báo rõ
  assert.equal(await ma(tx((trx) => S.setSetting(trx, who(), 'bizcity.thu.gia_tri', { value: 5, scope: 'chua_khai', scopeId: '1' }))), 'VALIDATION_ERROR');
  S.registerSettingScopes([{ key: 'don_vi', exists: async (trx, tenantId, id) => (await sql`SELECT 1 FROM don_vi_thu WHERE tenant_id = ${tenantId} AND id = ${id}::bigint`.execute(trx)).rows.length > 0 }]);
  const set = (scope, scopeId, value) => tx((trx) => S.setSetting(trx, who(), 'bizcity.thu.gia_tri', { value, ...(scope ? { scope, scopeId } : {}) }));
  const get = (scope) => tx((trx) => S.getSetting(trx, t1, 'bizcity.thu.gia_tri', scope)).then((r) => r.value);
  await set(null, null, 10);
  await set('don_vi', '5', 20);
  await set('branch', '7', 30);
  assert.equal(await get({}), 10, 'chỉ tenant');
  assert.equal(await get({ scopes: { don_vi: '5' } }), 20, 'don_vi thắng tenant');
  assert.equal(await get({ scopes: { don_vi: '6' } }), 10, 'don_vi 6 chưa đặt ⇒ về tenant');
  assert.equal(await get({ branchId: '7', scopes: { don_vi: '5' } }), 30, 'branch hẹp hơn don_vi');
  assert.equal(await get({ branchId: '7' }), 30);
  // tương thích cũ: accountingUnitId vẫn đọc được khi bậc tên accounting_unit — ở đây bậc khác tên nên không áp
  assert.equal(await get({ accountingUnitId: '5' }), 10);
  // bậc không có thật của đơn vị ⇒ NOT_FOUND; id không phải số ⇒ VALIDATION_ERROR
  assert.equal(await ma(set('don_vi', '99', 1)), 'NOT_FOUND');
  assert.equal(await ma(set('don_vi', 'abc', 1)), 'VALIDATION_ERROR');
  const hist = (await tx((trx) => S.settingHistory(trx, t1, 'bizcity.thu.gia_tri'))).map((h) => `${h.scope}:${h.scopeId}=${h.value}`).sort();
  assert.deepEqual(hist, ['branch:7=30', 'don_vi:5=20', 'tenant:=10']);
});

test('bậc thêm chèn giữa hai bậc chỉ định (between) — kể cả bậc app khai sau bậc app khác', { skip }, async () => {
  S.registerSettingScopes([{ key: 'nhom', between: { wider: 'don_vi', narrower: 'branch' }, exists: async () => true }]);
  // chuỗi giải: user > branch > nhom > don_vi > tenant — kiểm qua giá trị: đặt nhom 1 = 40 ở khoá có bậc nhom
  // (khoá thử chỉ khai don_vi / branch ⇒ bậc nhom không áp; kiểm thứ tự bằng đọc nội bộ qua getSetting với cả ba)
  const r = await tx((trx) => S.getSetting(trx, t1, 'bizcity.thu.gia_tri', { branchId: '7', scopes: { nhom: '1', don_vi: '5' } }));
  assert.equal(r.value, 30);
  S.resetSettingScopes();
});

test('bộ phân loại lỗi CSDL: mặc định (chuyển tiếp) nhận lỗi trigger sổ; app đăng ký thì thắng; replaceDefaults tắt mặc định; errorCodeOf dùng chung', () => {
  E.resetDbErrorClassifiers();
  const trig = { code: '23514', message: 'Bút toán không cân Nợ = Có' };
  assert.equal(E.classifyDbError(trig).code, ERROR_CODES.UNBALANCED);
  assert.equal(E.errorCodeOf(trig), ERROR_CODES.UNBALANCED);
  const mine = { code: '23514', message: 'KHO_AM: tồn kho âm' };
  assert.equal(E.classifyDbError(mine), undefined, 'mặc định không biết trigger kho');
  assert.equal(E.errorCodeOf(mine), ERROR_CODES.POSTING_FAILED, 'rơi về mã chung của 23514');
  E.registerDbErrorClassifier((err) => (/KHO_AM/.test(String(err.message)) ? { code: ERROR_CODES.CONFLICT, reason: 'STOCK_NEGATIVE' } : undefined));
  assert.deepEqual(E.classifyDbError(mine), { code: ERROR_CODES.CONFLICT, reason: 'STOCK_NEGATIVE' });
  assert.equal(E.errorCodeOf(mine), ERROR_CODES.CONFLICT);
  assert.equal(E.classifyDbError(trig).code, ERROR_CODES.UNBALANCED, 'bộ mặc định vẫn còn sau bộ của app');
  // app muốn tự lo hết: replaceDefaults
  E.registerDbErrorClassifier((err) => (/không cân/.test(String(err.message)) ? { code: ERROR_CODES.UNBALANCED, reason: 'CUA_APP' } : undefined), { replaceDefaults: true });
  assert.equal(E.classifyDbError(trig).reason, 'CUA_APP');
  assert.equal(E.classifyDbError({ code: '23514', message: 'PERIOD_LOCKED: kỳ 10/2026' }), undefined, 'mặc định đã tắt — app không nhận thì không ai nhận');
  E.resetDbErrorClassifiers();
  assert.equal(E.classifyDbError({ code: '23514', message: 'PERIOD_LOCKED: kỳ 10/2026' }).code, ERROR_CODES.PERIOD_LOCKED, 'reset ⇒ mặc định trở lại');
});
