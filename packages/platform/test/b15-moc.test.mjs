// [2026-11-29 01:09 AM Johnny Chu - Chu Hoàng Anh] S004-W2-10 (B-15) — lõi không đọc bảng kế toán bằng SQL ở cài đặt / sao lưu:
//   kỳ khoá + bể chờ nạp do app đăng ký (registerSettingImpactSource); bậc cài đặt branch xác nhận qua cổng MASTERDATA (thiếu ⇒ từ chối);
//   bảng bắt buộc của bản sao lưu do app khai (registerBackupRequiredTables). Bản của open-ketoan (khu cách ly) = đúng SQL cũ.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import { csdlMoi, themDonVi, skip } from './_csdl.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'b15-'));
mkdirSync(path.join(root, 'docs/contracts'), { recursive: true });
writeFileSync(path.join(root, 'docs/contracts/bizcity-settings.registry.json'), JSON.stringify({
  settings: [{ key: 'bizcity.thu.b15', owner: 'thu', scopes: ['tenant', 'branch'], storage: 'setting_values', class: 'A', valueType: 'integer', default: '1', basis: 'thử' }],
}));
process.env.BIZCITY_APP_ROOT = root;

const url = await csdlMoi('oc_t_b15');
const S = await import('../dist/core/settings.js');
const { clearPorts } = await import('../dist/core/ports.js');
const { ketoanSettingImpact } = await import('../dist/ketoan-legacy/index.js');
const { registerBackupRequiredTables } = await import('../dist/db/site-backup.js');
const { db } = await import('../dist/db/client.js');

let t;
before(async () => {
  if (!url) return;
  t = await themDonVi(url, 'b15-1');
  // bảng của open-ketoan (bản thu gọn): kỳ kế toán + khoá kỳ + bể chờ nạp
  await sql`CREATE TABLE fiscal_periods (id bigint PRIMARY KEY, tenant_id bigint, year int, month int, start_date date, end_date date)`.execute(db);
  await sql`CREATE TABLE period_locks (id bigint PRIMARY KEY, tenant_id bigint, period_id bigint, doc_type text, branch_id bigint)`.execute(db);
  await sql`CREATE TABLE intake_inbox (id bigint PRIMARY KEY, tenant_id bigint, status text)`.execute(db);
  await sql.raw(`INSERT INTO fiscal_periods VALUES (1, ${t}, 2026, 10, '2026-10-01', '2026-10-31'), (2, ${t}, 2026, 11, '2026-11-01', '2026-11-30');
    INSERT INTO period_locks VALUES (1, ${t}, 1, '*', NULL);
    INSERT INTO intake_inbox VALUES (1, ${t}, 'open'), (2, ${t}, 'trial'), (3, ${t}, 'done')`).execute(db);
});
after(async () => { S.resetSettingImpactSource(); clearPorts(); await db.destroy(); });
const tx = (fn) => db.transaction().execute(fn);

test('chưa đăng ký nguồn: không có kỳ khoá, bể chờ 0 — lõi không đọc fiscal_periods / intake_inbox', { skip }, async () => {
  S.resetSettingImpactSource();
  assert.equal(await tx((trx) => S.lockedPeriodAt(trx, t, '2026-10-15', null)), null);
  const imp = await tx((trx) => S.settingImpact(trx, t, 'bizcity.thu.b15', { validFrom: '2026-10-15' }));
  assert.equal(imp.periodLocked, null); assert.equal(imp.pendingIntake, 0);
});

test('nguồn open-ketoan (khu cách ly) = đúng SQL cũ: kỳ 10/2026 khoá, kỳ 11 mở; bể chờ đếm open + trial', { skip }, async () => {
  S.registerSettingImpactSource(ketoanSettingImpact);
  assert.deepEqual(await tx((trx) => S.lockedPeriodAt(trx, t, '2026-10-15', null)), { year: 2026, month: 10 });
  assert.equal(await tx((trx) => S.lockedPeriodAt(trx, t, '2026-11-15', null)), null);
  const imp = await tx((trx) => S.settingImpact(trx, t, 'bizcity.thu.b15', { validFrom: '2026-10-15' }));
  assert.deepEqual(imp.periodLocked, { year: 2026, month: 10 }); assert.equal(imp.pendingIntake, 2);
});

test('bậc cài đặt branch: chưa có nhà cấp MASTERDATA ⇒ từ chối (không xác nhận được chi nhánh)', { skip }, async () => {
  clearPorts();
  const who = { tenantId: t, actor: 'user:1', can: () => true };
  await assert.rejects(tx((trx) => S.setSetting(trx, who, 'bizcity.thu.b15', { value: 2, scope: 'branch', scopeId: '7', validFrom: '2026-11-15', reason: 'thử b15' })), (e) => e.code === 'NOT_FOUND' && /branch 7/.test(e.message));
});

test('registerBackupRequiredTables: tên bảng sai khuôn bị chặn', () => {
  assert.throws(() => registerBackupRequiredTables([{ table: 'Bảng Lạ', label: 'x' }]), /sai khuôn/);
  registerBackupRequiredTables([{ table: 'ledger_entries', label: 'sổ cái' }]);
});
