// [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 — authzManifest(): ảnh chụp sổ quyền / vai / phạm vi khoá đúng khuôn bizcity_authz_manifest@1,
//   qua được bộ kiểm chung tools/users-check.mjs (schema + luật chéo), thứ tự ổn định, không xuất vai owner của nền.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL ??= 'postgres://x@localhost/x';
const auth = await import('../dist/core/auth.js');
const roles = await import('../dist/core/roles.js');
const { authzManifest } = await import('../dist/core/authz-manifest.js');
const TOOL = fileURLToPath(new URL('../../../tools/users-check.mjs', import.meta.url));

test('authzManifest: đủ phần, sắp xếp ổn định, không có owner, qua users-check', () => {
  auth.registerModulePermissions('mrp', [
    { key: 'mrp:lenh-sx-xem', label: 'Xem lệnh sản xuất' },
    { key: 'mrp:lenh-sx-duyet', label: 'Duyệt lệnh sản xuất', risk: 'high' },
  ]);
  roles.registerRoles('mrp', [
    { key: 'to_truong', label: 'Tổ trưởng', permissions: ['mrp:lenh-sx-xem', 'reports:read', 'mrp:lenh-sx-xem'] },
    { key: 'quan_doc', label: 'Quản đốc', permissions: ['mrp:lenh-sx-duyet', 'mrp:lenh-sx-xem'] },
  ]);
  roles.registerApiScopes('mrp', { 'mrp:read': ['mrp:lenh-sx-xem'] });
  const m = authzManifest('open-mrp', {
    userMeta: [{ key: 'mrp.lenh.columns', label: 'Cột hiện', type: 'string[]' }],
    settings: [{ key: 'bizcity.mrp.ca_lam_viec', label: 'Ca làm việc', scopes: ['tenant'], permission: 'settings:write' }],
  });
  assert.equal(m.schema, 'bizcity_authz_manifest@1');
  assert.deepEqual(m.permissions.map((p) => p.key), ['mrp:lenh-sx-duyet', 'mrp:lenh-sx-xem']);
  assert.equal(m.permissions[0].risk, 'high');
  assert.deepEqual(m.roles.map((r) => r.key), ['quan_doc', 'to_truong']);
  assert.ok(!m.roles.some((r) => r.key === 'owner'));
  assert.deepEqual(m.roles[1].permissions, ['mrp:lenh-sx-xem', 'reports:read']); // bỏ trùng, sắp xếp
  assert.deepEqual(m.api_scopes['mrp:read'], ['mrp:lenh-sx-xem']);
  assert.ok(m.core_permissions.includes('users:write'));

  const dir = mkdtempSync(join(tmpdir(), 'authz-'));
  const ok = join(dir, 'ok.json');
  writeFileSync(ok, JSON.stringify(m));
  execFileSync(process.execPath, [TOOL, '--manifest', ok]); // ném lỗi nếu KHÔNG ĐẠT

  // thử ngược: phạm vi khoá mang quyền rủi ro cao ⇒ bộ kiểm chặn
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ ...m, api_scopes: { 'mrp:read': ['mrp:lenh-sx-duyet'] } }));
  assert.throws(() => execFileSync(process.execPath, [TOOL, '--manifest', bad], { stdio: 'pipe' }));
  roles.resetRolesForTest();
});
