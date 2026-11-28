// [2026-11-28 11:47 PM Johnny Chu - Chu Hoàng Anh] S004-DM-1…3 — cơ chế danh mục ở lõi chạy thật (NC-008): newId + vector ULID, entity_links chỉ thêm
// (đổi ánh xạ có dấu vết, tra theo thời điểm, không gộp ngầm, RLS), data_authority (local, cổng ghi, epoch không giảm, đi một chiều).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { csdlMoi, themDonVi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_master_data');
const { newId, ulidFrom, ulidTime, ID_KINDS } = await import('@bizcity/contracts');
const { entityLinks, dataAuthority } = await import('../dist/core/master-data.js');
const { db } = await import('../dist/db/client.js');

let t1, t2, c;
before(async () => { if (!url) return; t1 = await themDonVi(url, 'md-1'); t2 = await themDonVi(url, 'md-2'); c = new pg.Client({ connectionString: url }); await c.connect(); });
after(async () => { await c?.end(); await db.destroy(); });
const tx = (fn) => db.transaction().execute(fn);

test('S004-DM-1 newId: vector ULID cố định (bản PHP cùng vector làm ở W1), sắp theo thời gian, trục khoá bằng code bị từ chối', () => {
  // Vector: thời điểm 1469918176385 ms + 10 byte 0x00…0x09 ⇒ phải ra đúng chuỗi này ở mọi hiện thực (bizcity_sync@1 vector, W1).
  const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(ulidFrom(1469918176385, bytes), '01ARYZ6S41000G40R40M30E209');
  assert.equal(ulidFrom(0, new Uint8Array(10)), '00000000000000000000000000');
  assert.equal(ulidFrom(2 ** 48 - 1, new Uint8Array(10).fill(255)), '7ZZZZZZZZZZZZZZZZZZZZZZZZZ');
  assert.throws(() => ulidFrom(2 ** 48, bytes), RangeError);
  assert.throws(() => ulidFrom(1, new Uint8Array(9)), RangeError);
  assert.equal(ulidTime(ulidFrom(1469918176385, bytes)), 1469918176385);
  for (const k of ID_KINDS) assert.match(newId(k), /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(newId('item', 1000) < newId('item', 2000), 'ULID sắp theo thời gian');
  assert.throws(() => newId('partner'), /code \+ uid/);
  assert.throws(() => newId('bat-ky'), /trục lạ/);
  const many = new Set(Array.from({ length: 2000 }, () => newId('document', 5)));
  assert.equal(many.size, 2000, 'cùng mili-giây vẫn không trùng');
});

const L = { entityType: 'item', peerInstance: 'ketoan-01' };

test('S004-DM-2 link: gắn lặp trả dòng cũ; đổi ánh xạ đóng dòng cũ + thêm dòng mới; tra theo thời điểm', { skip }, async () => {
  const a = await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-1', remoteId: '01ARYZ6S41000G40R40M30E209', remoteCode: 'SUA900' }, 'user:1'));
  const again = await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-1', remoteId: '01ARYZ6S41000G40R40M30E209', remoteCode: 'SUA900' }, 'user:1'));
  assert.equal(again.id, a.id, 'idempotent');
  const mid = (await c.query('SELECT now() AS t')).rows[0].t.toISOString();
  await new Promise((r) => setTimeout(r, 20));
  const b = await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-1', remoteId: '01BX5ZZKBKACTAV9WEVGEMMVRZ', evidenceRef: 'cake.catalog_proposal:01' }, 'user:2'));
  assert.notEqual(b.id, a.id);
  const now = await tx((trx) => entityLinks.resolveLocal(trx, t1, { ...L, localId: 'cake-sp-1' }));
  assert.equal(now.remoteId, '01BX5ZZKBKACTAV9WEVGEMMVRZ');
  const past = await tx((trx) => entityLinks.resolveLocal(trx, t1, { ...L, localId: 'cake-sp-1', at: mid }));
  assert.equal(past.remoteId, '01ARYZ6S41000G40R40M30E209', 'tra lại ánh xạ cũ tại thời điểm trước khi đổi');
  const h = await tx((trx) => entityLinks.history(trx, t1, { entityType: 'item', localId: 'cake-sp-1' }));
  assert.deepEqual(h.map((x) => [x.remoteId, x.validTo === null]), [['01ARYZ6S41000G40R40M30E209', false], ['01BX5ZZKBKACTAV9WEVGEMMVRZ', true]]);
  const back = await tx((trx) => entityLinks.resolveRemote(trx, t1, { ...L, remoteId: '01BX5ZZKBKACTAV9WEVGEMMVRZ' }));
  assert.equal(back.localId, 'cake-sp-1');
  const byCode = await tx((trx) => entityLinks.resolveRemote(trx, t1, { ...L, remoteCode: 'SUA900', at: mid }));
  assert.equal(byCode.localId, 'cake-sp-1');
});

test('S004-DM-2 không gộp ngầm: một remote đã thuộc local khác ⇒ CONFLICT; alias / proposal không chiếm chỗ canonical', { skip }, async () => {
  await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-2', remoteId: '01BX5ZZKBKACTAV9WEVGEMMVS0' }, 'user:1'));
  assert.equal(await ma(tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-3', remoteId: '01BX5ZZKBKACTAV9WEVGEMMVS0' }, 'user:1'))), 'CONFLICT');
  const p = await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-3', remoteId: '01BX5ZZKBKACTAV9WEVGEMMVS0', kind: 'proposal' }, 'system:doi-chieu'));
  assert.equal(p.kind, 'proposal');
  assert.equal(await tx((trx) => entityLinks.resolveLocal(trx, t1, { ...L, localId: 'cake-sp-3' })), undefined, 'đề xuất không phải ánh xạ');
  assert.equal(await ma(tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'x' }, 'user:1'))), 'VALIDATION_ERROR');
  assert.equal(await ma(tx((trx) => entityLinks.link(trx, t1, { ...L, entityType: 'Hang Hoa', localId: 'x', remoteId: 'y' }, 'user:1'))), 'VALIDATION_ERROR');
});

test('S004-DM-2 chỉ thêm ở CSDL: sửa cột / xoá / mở lại dòng đã đóng đều bị trigger chặn; đóng một lần thì được', { skip }, async () => {
  const l = await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'cake-sp-9', remoteId: '01BX5ZZKBKACTAV9WEVGEMMVS9' }, 'user:1'));
  await assert.rejects(c.query('UPDATE entity_links SET remote_id = $2 WHERE id = $1', [l.id, 'khac']), /chỉ thêm/);
  await assert.rejects(c.query('DELETE FROM entity_links WHERE id = $1', [l.id]), /chỉ thêm/);
  const closed = await tx((trx) => entityLinks.close(trx, t1, l.id, 'user:1'));
  assert.ok(closed.validTo);
  await assert.rejects(c.query('UPDATE entity_links SET valid_to = NULL WHERE id = $1', [l.id]), /chỉ thêm/);
  assert.equal(await ma(tx((trx) => entityLinks.close(trx, t1, l.id, 'user:1'))), 'NOT_FOUND', 'đóng lần hai');
});

test('S004-DM-2 cô lập đơn vị: RLS — đơn vị khác không thấy, không ghi hộ', { skip }, async () => {
  await tx((trx) => entityLinks.link(trx, t1, { ...L, localId: 'rls-1', remoteId: '01BX5ZZKBKACTAV9WEVGEMMVSR' }, 'user:1'));
  const app = new pg.Client({ connectionString: url }); await app.connect();
  try {
    await app.query("SET ROLE oc_app; SELECT set_config('bizcity.tenant_id', $1, false)", [t2]).catch(async () => {
      await app.query('SET ROLE oc_app'); await app.query("SELECT set_config('bizcity.tenant_id', $1, false)", [t2]);
    });
    const r = await app.query("SELECT count(*)::int AS n FROM entity_links WHERE local_id = 'rls-1'");
    assert.equal(r.rows[0].n, 0);
    await assert.rejects(app.query("INSERT INTO entity_links (tenant_id, entity_type, local_id, peer_instance, remote_id, link_kind, created_by) VALUES ($1, 'item', 'x', 'p', 'y', 'canonical', 'u')", [t1]), /row-level security/);
  } finally { await app.end(); }
});

test('S004-DM-3 data_authority: ensureLocal không giành chủ; cổng ghi theo trạng thái; epoch không giảm; không đi tắt local → replica', { skip }, async () => {
  const a = await tx((trx) => dataAuthority.ensureLocal(trx, t1, 'item', 'cake-01'));
  assert.deepEqual([a.ownerInstance, a.state, a.epoch], ['cake-01', 'local', 1]);
  const b = await tx((trx) => dataAuthority.ensureLocal(trx, t1, 'item', 'kiot-01'));
  assert.equal(b.ownerInstance, 'cake-01', 'không giành chủ');
  assert.equal(await ma(tx((trx) => dataAuthority.assertWritable(trx, t1, 'item', 'cake-01'))), 'OK');
  assert.equal(await ma(tx((trx) => dataAuthority.assertWritable(trx, t1, 'partner', 'cake-01'))), 'OK', 'trục chưa ghi nhận');
  assert.equal(await ma(tx((trx) => dataAuthority.assertWritable(trx, t1, 'item', 'kiot-01'))), 'CONFLICT');

  await assert.rejects(c.query("UPDATE data_authority SET state = 'replica', epoch = 2 WHERE tenant_id = $1 AND axis = 'item'", [t1]), /transferring/);
  await c.query("UPDATE data_authority SET state = 'transferring' WHERE tenant_id = $1 AND axis = 'item'", [t1]);
  const e1 = await tx((trx) => dataAuthority.assertWritable(trx, t1, 'item', 'cake-01')).catch((e) => e);
  assert.equal(e1.details.reason, 'AXIS_TRANSFERRING');
  await assert.rejects(c.query("UPDATE data_authority SET state = 'replica' WHERE tenant_id = $1 AND axis = 'item'", [t1]), /tăng epoch/);
  await c.query("UPDATE data_authority SET state = 'replica', epoch = 2, owner_instance = 'ketoan-01' WHERE tenant_id = $1 AND axis = 'item'", [t1]);
  const e2 = await tx((trx) => dataAuthority.assertWritable(trx, t1, 'item', 'cake-01')).catch((e) => e);
  assert.deepEqual([e2.code, e2.details.reason, e2.details.owner, e2.details.epoch], ['CONFLICT', 'AXIS_READ_ONLY', 'ketoan-01', 2]);
  await assert.rejects(c.query("UPDATE data_authority SET epoch = 1 WHERE tenant_id = $1 AND axis = 'item'", [t1]), /không được giảm/);
  await assert.rejects(c.query("UPDATE data_authority SET state = 'local' WHERE tenant_id = $1 AND axis = 'item'", [t1]), /không quay lại/);
  await assert.rejects(c.query("DELETE FROM data_authority WHERE tenant_id = $1 AND axis = 'item'", [t1]), /không xoá/);
});
