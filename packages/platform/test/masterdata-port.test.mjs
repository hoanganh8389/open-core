// [2026-11-29 12:55 AM Johnny Chu - Chu Hoàng Anh] S004-W2-9 (ADR-0001 D5, B-15) — phạm vi vai đi qua cổng MASTERDATA:
//   (1) có nhà cấp (bản của open-ketoan trong khu cách ly) ⇒ lần gán chi nhánh / kho / nút ra ĐÚNG như câu SQL cũ đọc branches / warehouses;
//   (2) chưa có nhà cấp ⇒ ĐÓNG: không ra phạm vi nào, lần gán org_unit không có scope (không còn path '' lọt vào orgPaths).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { csdlMoi, themDonVi, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_masterdata');
const { db } = await import('../dist/db/client.js');
const { lanGanTheoChiNhanh } = await import('../dist/core/authz/scope.js');
const { loadAuthzSnapshot } = await import('../dist/core/authz/store.js');
const { providePort, clearPorts } = await import('../dist/core/ports.js');
const { MASTERDATA } = await import('../dist/core/masterdata-port.js');
const { ketoanMasterdata } = await import('../dist/ketoan-legacy/index.js');

let t, u;
before(async () => {
  if (!url) return;
  t = await themDonVi(url, 'md-1');
  // bảng của open-ketoan (bản thu gọn, đúng cột dùng): cây đơn vị theo unit_path (0174), kho thuộc chi nhánh
  await sql`CREATE TABLE branches (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, code text NOT NULL, unit_path text NOT NULL)`.execute(db);
  await sql`CREATE TABLE warehouses (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, branch_id bigint NOT NULL)`.execute(db);
  await sql.raw(`INSERT INTO branches VALUES (1, ${t}, 'MIEN-BAC', '1'), (2, ${t}, 'CN-HN', '1/2'), (3, ${t}, 'CH-HN-1', '1/2/3'), (4, ${t}, 'CN-HCM', '4'), (12, ${t}, 'CN-LA', '12')`).execute(db);
  await sql.raw(`INSERT INTO warehouses VALUES (10, ${t}, 3)`).execute(db);
  u = (await sql`INSERT INTO users (tenant_id, email, full_name, password_hash, role) VALUES (${t}, 'md@x.vn', 'MD', 'x', 'viewer') RETURNING id::text`.execute(db)).rows[0].id;
  const gan = (type, id, purpose = 'operate') => sql`INSERT INTO user_role_assignments (tenant_id, user_id, role, scope_type, scope_id, purpose, reason, granted_by) VALUES (${t}, ${u}, 'viewer', ${type}, ${id}, ${purpose}, 'thử cổng', 'test')`.execute(db);
  await gan('branch', 4); await gan('warehouse', 10); await gan('org_unit', 2, 'report'); await gan('org_unit', 99, 'approve'); // 99: nút không có
});
after(async () => { clearPorts(); await db.destroy(); });

/** Câu SQL lõi dùng TRƯỚC S004-W2-9 (đọc thẳng branches / warehouses) — mốc để so. */
const cauCu = async () => (await sql`
  WITH a AS (SELECT a.user_id::text AS user_id, a.scope_type, a.scope_id FROM user_role_assignments a WHERE a.tenant_id = ${t} AND a.revoked_at IS NULL AND a.scope_type IN ('branch', 'warehouse', 'org_unit'))
  SELECT a.user_id, b.code, a.scope_type, NULL::text AS nut FROM a JOIN branches b ON a.scope_type = 'branch' AND b.tenant_id = ${t} AND b.id = a.scope_id
  UNION ALL SELECT a.user_id, b.code, a.scope_type, NULL::text FROM a JOIN warehouses w ON a.scope_type = 'warehouse' AND w.tenant_id = ${t} AND w.id = a.scope_id JOIN branches b ON b.tenant_id = ${t} AND b.id = w.branch_id
  UNION ALL SELECT a.user_id, b.code, a.scope_type, n.code FROM a JOIN branches n ON a.scope_type = 'org_unit' AND n.tenant_id = ${t} AND n.id = a.scope_id
    JOIN branches b ON b.tenant_id = ${t} AND (b.unit_path = n.unit_path OR left(b.unit_path, length(n.unit_path) + 1) = n.unit_path || '/')`.execute(db)).rows;
const key = (r) => `${r.user_id}|${r.scope_type}|${r.code}|${r.nut ?? ''}`;

test('có nhà cấp (bản open-ketoan): lần gán chi nhánh / kho / nút ra đúng như câu SQL cũ; nút con theo unit_path (CN-LA "12" không lọt vào nút "1")', { skip }, async () => {
  clearPorts(); providePort(MASTERDATA, (c) => ketoanMasterdata(c.tx, c.tenantId));
  const moi = await lanGanTheoChiNhanh(db, t, u);
  assert.deepEqual(moi.map(key).sort(), (await cauCu()).map(key).sort());
  assert.deepEqual(moi.map(key).sort(), [`${u}|branch|CN-HCM|`, `${u}|org_unit|CH-HN-1|CN-HN`, `${u}|org_unit|CN-HN|CN-HN`, `${u}|warehouse|CH-HN-1|`].sort());
  const snap = await loadAuthzSnapshot(db, t, u);
  const org = snap.assignments.filter((a) => a.id.startsWith('ura:') && a.purposes.includes('report'));
  assert.deepEqual(org[0].scopes[0], { kind: 'org_unit', id: '2', path: '1\\2', subtree: true });
  assert.deepEqual(org[0].scopes.filter((s) => s.kind === 'branch').map((s) => s.id).sort(), ['2', '3']);
  assert.deepEqual(snap.assignments.find((a) => a.id.startsWith('ura:') && a.purposes.includes('approve')).scopes, [], 'nút 99 không có ⇒ không phạm vi');
});

test('chưa có nhà cấp ⇒ ĐÓNG: không ra dòng chi nhánh nào; lần gán org_unit không có scope (không mở rộng quyền)', { skip }, async () => {
  clearPorts();
  assert.deepEqual(await lanGanTheoChiNhanh(db, t, u), []);
  const snap = await loadAuthzSnapshot(db, t, u);
  for (const a of snap.assignments.filter((x) => x.id.startsWith('ura:') && (x.purposes.includes('report') || x.purposes.includes('approve')))) assert.deepEqual(a.scopes, []);
  assert.ok(snap.assignments.some((a) => a.scopes.some((s) => s.kind === 'branch' && s.id === '4')), 'lần gán chi nhánh giữ id của lõi (không cần tra)');
});
