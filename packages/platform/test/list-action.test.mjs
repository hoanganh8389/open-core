// [2026-11-28 09:05 PM Johnny Chu - Chu Hoàng Anh] S003-4 — defineListAction chạy thật: khai danh sách ⇒ action danh sách + action xuất; ListDef JSON hợp lệ theo schema bizcity_list@1;
// xuất csv (BOM, nhãn cột, số thuần, thoát dấu phẩy) / json (bizcity_list_export@1) / ndjson; quyền xuất riêng; bằng chứng ghi băm bộ lọc + số dòng; che cột theo quyền; quá 10 000 dòng bị chặn.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { csdlMoi, themDonVi, nguoi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_list');
const { defineListAction, listDefJson, validateListDef, maskValue, EXPORT_MAX_ROWS } = await import('../dist/core/list.js');
const { documentExportAction, documentListAction } = await import('../dist/core/document-search.js');
const { runAction } = await import('../dist/core/actions.js');
const { db } = await import('../dist/db/client.js');

const here = dirname(fileURLToPath(import.meta.url));
const PLATFORM = join(here, '../../../../bizcity-platform');
const hasStd = existsSync(join(PLATFORM, 'tools/lib/json-schema.mjs'));

let t1, t2, c;
before(async () => {
  if (!url) return;
  t1 = await themDonVi(url, 'xuat-1'); t2 = await themDonVi(url, 'xuat-2');
  c = new pg.Client({ connectionString: url }); await c.connect();
  // 6 chứng từ cho t1 (có dấu phẩy / nháy kép trong tiêu đề), 1 cho t2
  const rows = [['A1', 'Khách "Lan", Q.1', 'CN01', 100000], ['A2', 'Khách Hùng', 'CN01', 250000.5], ['A3', 'Khách Mai', 'CN02', 0], ['A4', 'Nhập kho', 'CN02', 50000], ['A5', 'Xuất kho', 'CN01', 75000], ['A6', 'Hoàn tiền', 'CN03', 1]];
  for (const [k, title, cn, total] of rows) {
    await c.query(`INSERT INTO business_documents (tenant_id, doc_ref, module, doc_type, doc_no, doc_date, title, partner_ref, org_unit_code, status_raw, status, total, created_by)
                   VALUES ($1, $2, 'thu', 'thu.hoa_don', $3, '2026-11-20', $4, '0912345678', $5, 'moi', 'draft', $6, 'user:1')`, [t1, `thu.hoa_don:${k}`, k, title, cn, total]);
  }
  await c.query(`INSERT INTO business_documents (tenant_id, doc_ref, module, doc_type, doc_no, status_raw, status) VALUES ($1, 'thu.hoa_don:Z1', 'thu', 'thu.hoa_don', 'Z1', 'moi', 'draft')`, [t2]);
});
after(async () => { await c?.end(); await db.destroy(); });
const goi = (def, auth, input) => runAction(def, input, { auth, requestId: 'r-xuat' });
const xem = (t, ...p) => nguoi(t, 1, 'documents:read', ...p);

test('ListDef JSON: hợp lệ theo schema bizcity_list@1 của bizcity-platform; khai sai bị chặn ngay lúc khai', { skip: !hasStd && 'không có bizcity-platform cạnh repo' }, async () => {
  const std = await import(pathToFileURL(join(PLATFORM, 'tools/lib/json-schema.mjs')).href);
  const { documentList } = await import('../dist/core/document-search.js');
  const root = JSON.parse((await import('node:fs')).readFileSync(join(PLATFORM, 'schema/list/list.schema.json'), 'utf8'));
  const errs = std.validate(root, root.$defs.ListDef, listDefJson(documentList.def));
  assert.deepEqual(errs, []);
  const j = listDefJson(documentList.def);
  assert.equal(j.id, 'core.document.list'); assert.equal(j.exportPermission, 'documents:read');
  const bad = (patch) => { try { validateListDef({ ...documentList.def, ...patch }); return 'OK'; } catch (e) { return e.message; } };
  assert.match(bad({ id: 'sai-ma' }), /dạng <module>/);
  assert.match(bad({ from: 'bang; DROP TABLE x' }), /định danh SQL/);
  assert.match(bad({ defaultSort: [{ field: 'title', dir: 'asc' }] }), /phải là cột sort/);
  assert.match(bad({ columns: [...documentList.def.columns, documentList.def.columns[0]] }), /trùng/);
});

test('xuất csv: BOM, nhãn cột, số thuần, thoát dấu phẩy / nháy kép; theo đúng bộ lọc; chỉ đơn vị của mình', { skip }, async () => {
  const r = (await goi(documentExportAction, xem(t1), { format: 'csv', 'f.org_unit_code.eq': 'CN01', sort: 'doc_no' })).data;
  assert.equal(r.format, 'csv'); assert.equal(r.rowCount, 3);
  assert.match(r.filename, /^core\.document-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.ok(r.content.startsWith('﻿Mã chứng từ,Loại,Module,Số,Ngày,Tiêu đề,'));
  const lines = r.content.replace('﻿', '').trim().split('\r\n');
  assert.equal(lines.length, 4);
  assert.ok(lines[1].includes('"Khách ""Lan"", Q.1"'), 'dấu phẩy + nháy kép được thoát');
  assert.ok(lines[2].includes(',250000.5,'), 'tiền là số thuần');
  assert.ok(!r.content.includes('Z1'), 'không lẫn đơn vị khác');
});

test('xuất json / ndjson: header bizcity_list_export@1 có bộ lọc, cột, tổng; ndjson dòng đầu là header', { skip }, async () => {
  const j = JSON.parse((await goi(documentExportAction, xem(t1), { format: 'json', 'f.total.gte': '75000', sort: '-total' })).data.content);
  assert.equal(j.contract, 'bizcity_list_export@1'); assert.equal(j.list, 'core.document.list'); assert.equal(j.tenant, 'xuat-1');
  assert.equal(j.generatedBy, 'user:1'); assert.equal(j.total, 3); assert.equal(j.rows.length, 3);
  assert.deepEqual(j.query.filters, [{ field: 'total', op: 'gte', value: '75000' }]);
  assert.deepEqual(j.rows.map((r) => r.doc_no), ['A2', 'A1', 'A5']);
  assert.ok(j.columns.some((x) => x.field === 'total' && x.type === 'money'));
  const nd = (await goi(documentExportAction, xem(t1), { format: 'ndjson' })).data.content.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(nd[0].contract, 'bizcity_list_export@1'); assert.equal(nd[0].rows, undefined); assert.equal(nd.length, 1 + 6);
});

test('quyền xuất riêng + bằng chứng: audit ghi list, format, số dòng, băm bộ lọc; AI không xuất được; định dạng lạ bị chặn', { skip }, async () => {
  assert.equal(await ma(goi(documentExportAction, nguoi(t1, 2, 'documents:write'), { format: 'csv' })), 'FORBIDDEN');
  assert.equal(await ma(goi(documentExportAction, xem(t1), { format: 'xlsx' })), 'ZOD');
  assert.equal(await ma(goi(documentExportAction, xem(t1), {})), 'ZOD');
  assert.equal(documentExportAction.expose.ai, 'deny'); assert.equal(documentExportAction.expose.mcp, false);
  assert.equal(documentListAction.expose.mcp, true);
  await goi(documentExportAction, xem(t1), { format: 'csv', 'f.org_unit_code.eq': 'CN02' });
  const a = (await c.query(`SELECT action, object_type, object_id, result_ok, after_data FROM audit_logs WHERE action = 'core.document.export' AND tenant_id = $1 ORDER BY id DESC LIMIT 1`, [t1])).rows[0];
  assert.deepEqual([a.action, a.object_type, a.object_id, a.result_ok], ['core.document.export', 'list', 'core.document.list', true]);
  assert.equal(a.after_data.notes.rows, 2); assert.equal(a.after_data.notes.format, 'csv'); assert.match(a.after_data.notes.filterHash, /^[0-9a-f]{16}$/);
});

test('che cột theo quyền xem cột (R-STD-LIST-11): thiếu quyền ⇒ che giá trị, không bỏ cột; báo masked', { skip }, async () => {
  const { listEngine, defineListAction: dla } = await import('../dist/core/list.js');
  const { documentList } = await import('../dist/core/document-search.js');
  const def = { ...documentList.def, columns: documentList.def.columns.map((x) => (x.field === 'partner_ref' ? { ...x, permission: 'documents:edit-all' } : x)) };
  const run = (viewer) => db.transaction().execute((tx) => listEngine.run(tx, t1, def, { limit: 2, sort: [{ field: 'doc_no', dir: 'asc' }] }, {}, viewer));
  const masked = await run({ can: () => false });
  assert.equal(masked.data[0].partner_ref, '09…678'); assert.deepEqual(masked.meta.masked, ['partner_ref']);
  const clear = await run({ can: () => true });
  assert.equal(clear.data[0].partner_ref, '0912345678'); assert.equal(clear.meta.masked, undefined);
  assert.equal(maskValue('abc'), '***'); assert.equal(maskValue(12345), null); assert.equal(maskValue(null), null);
  void dla;
});

test(`quá ${10_000} dòng ⇒ NOT_READY nêu cách xử lý, không treo kết nối`, { skip }, async () => {
  await c.query(`INSERT INTO business_documents (tenant_id, doc_ref, module, doc_type, doc_no, status_raw, status)
                 SELECT $1, 'thu.hoa_don:L' || g, 'thu', 'thu.hoa_don', 'L' || g, 'moi', 'draft' FROM generate_series(1, ${EXPORT_MAX_ROWS}) g`, [t2]);
  assert.equal(await ma(goi(documentExportAction, xem(t2), { format: 'csv' })), 'NOT_READY');
  const small = await goi(documentExportAction, xem(t2), { format: 'csv', 'f.doc_no.eq': 'Z1' });
  assert.equal(small.data.rowCount, 1);
});
