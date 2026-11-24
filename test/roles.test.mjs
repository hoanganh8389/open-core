// [2026-11-24 06:20 PM Johnny Chu - Chu Hoàng Anh] P2b-3 — kiểm cổng vai / quyền / phạm vi khoá: nền chỉ có owner; app khai vai; bộ cấu hình open-ketoan tái tạo
//   ĐÚNG bảng ROLE_PERMISSIONS / SCOPE_PERMISSIONS cũ (6ad77b6); migration 0002 nhận vai của app, vẫn chặn owner làm vai nền.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= url ?? 'postgres://x@localhost/x';
const auth = await import('../dist/core/auth.js');
const roles = await import('../dist/core/roles.js');
const sorted = (s) => [...s].sort();

test('nền: chỉ owner, 12 quyền nền, phạm vi khoá nền', () => {
  assert.deepEqual(roles.listRoles().map((r) => r.key), ['owner']);
  assert.equal(auth.PERMISSIONS.length, 12);
  assert.ok(!auth.PERMISSIONS.includes('ledger:read'));
  assert.deepEqual(sorted(auth.rolePermissions('owner')), sorted(auth.PERMISSIONS));
  assert.deepEqual(sorted(auth.scopePermissions(['reports:read'])), ['conformance:read', 'reports:read']);
  assert.equal(auth.rolePermissions('accountant').size, 0); // vai chưa khai ⇒ không quyền
});

test('app khai vai: được; trùng app khác / sai dạng / quyền module cộng theo roles', () => {
  auth.registerModulePermissions('cake', [{ key: 'cake:inbox-xem', label: 'Xem hộp thư', roles: ['sale'] }]);
  roles.registerRoles('cake', [{ key: 'sale', label: 'Nhân viên bán hàng', permissions: ['documents:read'] }]);
  assert.deepEqual(sorted(auth.rolePermissions('sale')), ['cake:inbox-xem', 'documents:read']);
  assert.ok(auth.rolePermissions('owner').has('cake:inbox-xem')); // quản trị cao nhận mọi quyền module
  assert.throws(() => roles.registerRoles('khac', [{ key: 'sale', label: 'x', permissions: [] }]), /đã thuộc cake/);
  assert.throws(() => roles.registerRoles('cake', [{ key: 'Sai Vai', label: 'x', permissions: [] }]), /phải dạng/);
  roles.resetRolesForTest();
});

test('bộ cấu hình open-ketoan tái tạo đúng bảng vai / phạm vi cũ', async () => {
  const { ketoanAuthzPreset } = await import('../dist/core/authz-ketoan-legacy.js');
  ketoanAuthzPreset();
  const OLD_ACC = ['catalog:read', 'catalog:write', 'documents:read', 'documents:write', 'ledger:read', 'reports:read', 'conformance:read', 'conformance:run', 'review:read'];
  const OLD_CHIEF = [...OLD_ACC, 'documents:edit-all', 'documents:bypass-date-lock', 'payments:approve', 'periods:lock', 'settings:write', 'conformance:approve'];
  assert.deepEqual(sorted(auth.rolePermissions('accountant')), sorted(OLD_ACC));
  assert.deepEqual(sorted(auth.rolePermissions('chief_accountant')), sorted(OLD_CHIEF));
  assert.deepEqual(sorted(auth.rolePermissions('staff')), ['catalog:read']);
  const OLD_CORE_18 = ['catalog:read', 'catalog:write', 'documents:read', 'documents:write', 'documents:edit-all', 'documents:bypass-date-lock', 'ledger:read', 'reports:read',
    'payments:approve', 'payments:approve-final', 'periods:lock', 'settings:write', 'users:write', 'conformance:read', 'conformance:run', 'conformance:approve', 'review:read', 'devtools:read'];
  assert.deepEqual(sorted(auth.rolePermissions('owner')).filter((k) => !k.startsWith('cake:')), sorted(OLD_CORE_18)); // bỏ quyền cake: của ca trước (sổ quyền module không reset)
  assert.deepEqual(sorted(auth.scopePermissions(['reports:read'])), ['catalog:read', 'conformance:read', 'ledger:read', 'reports:read']);
  assert.deepEqual(sorted(auth.scopePermissions(['documents:write'])), ['catalog:read', 'documents:edit-all', 'documents:read', 'documents:write']);
  assert.ok(auth.isHighRiskPermission('periods:lock'));
});

test('migration 0002: vai của app vào được, owner không làm vai nền', { skip: !url && 'không có TEST_DATABASE_URL' }, async () => {
  const { runMigrations } = await import('../dist/db/migrate.js');
  const { PLATFORM_MIGRATIONS_DIR } = await import('../dist/db/paths.js');
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(() => {}, { connectionString: url, sources: [{ name: 'platform', dir: PLATFORM_MIGRATIONS_DIR }] });
    const { rows: [t] } = await c.query("INSERT INTO tenants (code, name) VALUES ('hoa-mai', 'Shop Hoa Mai') RETURNING id");
    await c.query("INSERT INTO users (tenant_id, email, full_name, password_hash, role) VALUES ($1, 'a@x.vn', 'A', 'x', 'sale')", [t.id]);
    await assert.rejects(c.query("INSERT INTO users (tenant_id, email, full_name, password_hash, role) VALUES ($1, 'b@x.vn', 'B', 'x', 'Sai Vai')", [t.id]), /users_role_check/);
    await assert.rejects(c.query("INSERT INTO tenant_roles (tenant_id, code, label, kind, base_role, created_by) VALUES ($1, 'quan_ly', 'Quản lý', 'job', 'owner', 'wp:1')", [t.id]), /tenant_roles_base_role_check/);
  } finally { await c.end(); }
});
