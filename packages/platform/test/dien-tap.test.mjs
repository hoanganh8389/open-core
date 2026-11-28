// [2026-11-28 10:05 PM Johnny Chu - Chu Hoàng Anh] S004-W1-3 — tự kiểm bộ đo bất biến (tools/dien-tap/do-bat-bien.mjs) trên CSDL lõi + bảng sổ dựng giả theo cột thật của open-ketoan:
// nâng cấp không chạm dữ liệu ⇒ ĐẠT; làm sai từng loại (lệch Nợ / Có, đổi trạng thái chứng từ, cột mới khác mặc định, hoạt động bịa ra, bảng sổ mất) ⇒ bắt đúng mục;
// mốc sai sẵn của dữ liệu thật giữ nguyên ⇒ không tính là lệch; bộ đo chỉ đọc; CLI --out / --so trả mã thoát đúng.
// [2026-11-29 12:39 AM Johnny Chu - Chu Hoàng Anh] S004-W1-3b — bản 2: nội dung từng dòng (ô lệch + khoá dòng lệch), Master Data (MD-1…MD-4), báo cáo dựng lại (R),
//   mục bắt buộc thiếu bảng ⇒ KHÔNG ĐẠT (hồ sơ open-ketoan / core), so --chat giống hệt (S: lược đồ + sổ migration).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { csdlMoi, themDonVi, skip } from './_csdl.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(here, '../../../tools/dien-tap/do-bat-bien.mjs');
const url = await csdlMoi('oc_t_dientap');
const { doBatBien, soSanh, MUC, thieuBatBuoc } = await import(new URL('../../../tools/dien-tap/do-bat-bien.mjs', import.meta.url).href);

const U1 = '01JD0000000000000000000001', U2 = '01JD0000000000000000000002';
let c, t1;
before(async () => {
  if (!url) return;
  t1 = await themDonVi(url, 'dien-tap-1');
  c = new pg.Client({ connectionString: url }); await c.connect();
  // bảng của open-ketoan, đúng tên + cột bộ đo dùng (bản thu gọn) — đủ mọi mục bắt buộc của hồ sơ open-ketoan
  await c.query(`
    CREATE TABLE ledger_entries (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, content_hash text, body_hash text, is_reversal boolean NOT NULL DEFAULT false, reverses_entry_id bigint);
    CREATE TABLE ledger_lines (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, entry_id bigint NOT NULL, branch_id bigint, account_code text NOT NULL, posting_date date NOT NULL, partner_id bigint, debit numeric(18,2) NOT NULL DEFAULT 0, credit numeric(18,2) NOT NULL DEFAULT 0, description text NOT NULL DEFAULT '');
    CREATE TABLE ledger_links (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, entry_id bigint);
    CREATE TABLE ledger_balances_daily (tenant_id bigint, branch_id bigint, account_code text, posting_date date, partner_id bigint, debit numeric(18,2), credit numeric(18,2));
    CREATE TABLE period_locks (id bigint PRIMARY KEY, tenant_id bigint NOT NULL);
    CREATE TABLE period_lock_events (id bigint PRIMARY KEY, tenant_id bigint NOT NULL);
    CREATE TABLE accounting_events (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, doc_key text, version int, status text, posted_version int, total numeric(18,2));
    CREATE TABLE accounting_event_versions (id bigint PRIMARY KEY, event_id bigint, version int, payload jsonb);
    CREATE TABLE purchase_documents (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE sales_lines (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE sales_payments (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE inventory_costs (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE debt_items (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE debt_allocations (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE tax_invoices (id bigint PRIMARY KEY, tenant_id bigint, direction text, invoice_date date, status text, sign int);
    CREATE TABLE tax_invoice_lines (id bigint PRIMARY KEY, tax_invoice_id bigint, tax_code text, amount_before_tax numeric(18,2), tax_amount numeric(18,2));
    CREATE TABLE inventory_movements (id bigint PRIMARY KEY, tenant_id bigint, warehouse_code text, item_id text, sku text, kind text, qty numeric(18,4), amount numeric(18,2));
    CREATE TABLE items (item_id text PRIMARY KEY, tenant_id bigint, name text);
    CREATE TABLE products (id bigint PRIMARY KEY, tenant_id bigint, sku text, item_id text);
    CREATE TABLE item_codes (id bigint PRIMARY KEY, tenant_id bigint, item_id text, kind text, code text, valid_from date, valid_to date);
    CREATE TABLE entity_codes (id bigint PRIMARY KEY, tenant_id bigint, entity_type text, kind text, code text, valid_from date, valid_to date);
    CREATE TABLE product_units (id bigint PRIMARY KEY, tenant_id bigint, sku text, unit text, ratio numeric(18,6));
    CREATE TABLE unit_names (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE branches (id bigint PRIMARY KEY, tenant_id bigint, parent_id bigint);
    CREATE TABLE warehouses (id bigint PRIMARY KEY, tenant_id bigint, branch_id bigint, type_code text);
    CREATE TABLE warehouse_types (id bigint PRIMARY KEY, tenant_id bigint, code text);
    CREATE TABLE warehouse_type_ops (tenant_id bigint, op text);
    CREATE TABLE item_classes (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE item_classification (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE partners (id bigint PRIMARY KEY, tenant_id bigint);
    CREATE TABLE entity_attributes (id bigint PRIMARY KEY, tenant_id bigint);`);
  await c.query(`
    INSERT INTO ledger_entries VALUES (1, ${t1}, 'c1', 'b1', false, null), (2, ${t1}, 'c2', 'b2', false, null), (3, ${t1}, 'c3', 'b3', true, 2);
    INSERT INTO ledger_lines VALUES (1, ${t1}, 1, 1, '156', '2026-10-05', 9, 1000000, 0), (2, ${t1}, 1, 1, '331', '2026-10-05', 9, 0, 1000000),
                                    (3, ${t1}, 2, 1, '131', '2026-11-02', 7, 500000, 0), (4, ${t1}, 2, 1, '511', '2026-11-02', 7, 0, 500000),
                                    (5, ${t1}, 3, 1, '511', '2026-11-03', 7, 500000, 0), (6, ${t1}, 3, 1, '131', '2026-11-03', 7, 0, 500000);
    INSERT INTO ledger_balances_daily SELECT tenant_id, branch_id, account_code, posting_date, partner_id, sum(debit), sum(credit) FROM ledger_lines GROUP BY 1, 2, 3, 4, 5;
    INSERT INTO accounting_events VALUES (10, ${t1}, 'mh:PN-1', 1, 'posted', 1, 1000000), (11, ${t1}, 'ban:HD-1', 2, 'posted', 2, 500000);
    INSERT INTO accounting_event_versions VALUES (1, 10, 1, '{"a":1}'), (2, 11, 1, '{"a":2}'), (3, 11, 2, '{"a":3}');
    INSERT INTO tax_invoices VALUES (1, ${t1}, 'out', '2026-11-02', 'issued', 1);
    INSERT INTO tax_invoice_lines VALUES (1, 1, 'R10', 500000, 50000);
    INSERT INTO inventory_movements VALUES (1, ${t1}, 'K1', '${U1}', '110063101', 'in', 10, 1000000);
    INSERT INTO items VALUES ('${U1}', ${t1}, 'Bánh mì'), ('${U2}', ${t1}, 'Bánh bông lan');
    INSERT INTO products VALUES (1, ${t1}, '110063101', '${U1}'), (2, ${t1}, '110063102', '${U2}');
    INSERT INTO item_codes VALUES (1, ${t1}, '${U1}', 'sku', '110063101', '2026-01-01', null), (2, ${t1}, '${U2}', 'sku', '110063102', '2026-01-01', '2026-06-01'), (3, ${t1}, '${U2}', 'sku', '110063103', '2026-06-01', null);
    INSERT INTO entity_codes VALUES (1, ${t1}, 'warehouse', 'code', 'K1', '2026-01-01', null);
    INSERT INTO product_units VALUES (1, ${t1}, '110063101', 'cái', 1), (2, ${t1}, '110063101', 'thùng', 24);
    INSERT INTO branches VALUES (1, ${t1}, null), (2, ${t1}, 1);
    INSERT INTO warehouse_types VALUES (1, ${t1}, 'ban');
    INSERT INTO warehouses VALUES (1, ${t1}, 2, 'ban');
    INSERT INTO business_documents (tenant_id, doc_ref, module, doc_type, doc_no, status_raw, status, total)
      VALUES (${t1}, 'mua-hang.phieu:PN-1', 'mua-hang', 'mua_hang.phieu', 'PN-1', 'posted', 'done', 1000000), (${t1}, 'ban-hang.hd:HD-1', 'ban-hang', 'ban_hang.hd', 'HD-1', 'posted', 'done', 500000);
    INSERT INTO audit_logs (tenant_id, actor, action, object_type, object_id) VALUES (${t1}, 'user:1', 'a', 'x', '1'), (${t1}, 'user:1', 'b', 'x', '2');`);
});
after(async () => { await c?.end(); });
const doLan = async (opts) => doBatBien(c, {}, opts);
const maLech = (r) => r.lech.map((x) => x.ma).sort();

test('đủ nhóm L / D / M / R / H / S / W, mã không trùng; mỗi mục khai bắt buộc theo hồ sơ', () => {
  const ma = MUC.map((m) => m.ma);
  assert.equal(new Set(ma).size, ma.length);
  for (const g of ['L', 'D', 'M', 'R', 'H', 'S', 'W']) assert.ok(MUC.some((m) => m.nhom === g), g);
  for (const m of MUC) assert.ok(m.bb === 'core' || m.bb === 'ketoan', `${m.ma} thiếu bb`);
});

test('đo: sổ cân, số dư khớp, danh mục giữ MD-1…MD-4, chuỗi bằng chứng nguyên vẹn; đủ mục bắt buộc; chỉ đọc', { skip }, async () => {
  const a = await doLan();
  const k = a.ket_qua;
  for (const m of ['L-2', 'L-4', 'L-6', 'H-1.chuoi', 'W-1', 'W-2', 'W-4', 'W-5', 'M-1.ulid', 'M-2.chong', 'M-2.tai', 'M-3.goc', 'M-3.ty_le', 'M-4.mo_coi', 'M-4.vong', 'M-4.loai']) assert.equal(k[m].n, '0', m);
  assert.deepEqual(thieuBatBuoc(a).map(([x]) => x), [], 'đủ mục bắt buộc');
  assert.equal(k['L-8.2'].n, '6'); assert.ok(Object.keys(k['L-8.2'].o).length >= 1);
  assert.equal(k['D-1'].n, '2'); assert.equal(k['D-2'].n, '3'); assert.equal(k['D-3'].n, '2'); assert.equal(k['M-1'].n, '2');
  assert.equal((await c.query(`SELECT count(*)::int n FROM pg_stat_activity WHERE state = 'idle in transaction' AND datname = current_database()`)).rows[0].n, 0);
});

test('nâng cấp không chạm dữ liệu ⇒ ĐẠT; sổ migration đổi chỉ là ghi chú — nhưng --chat (chạy lại / khôi phục) đòi giống hệt', { skip }, async () => {
  const a = await doLan();
  assert.equal(soSanh(a, await doLan(), { chat: true }).dat, true, 'hai lần đo liền nhau giống hệt');
  await c.query(`INSERT INTO schema_migrations (name, source) VALUES ('0187_truc_chung_tu.sql', 'app') ON CONFLICT DO NOTHING`);
  const b = await doLan();
  const r = soSanh(a, b);
  assert.equal(r.dat, true, JSON.stringify(r.lech));
  assert.ok(r.ghi_chu.some((g) => g.startsWith('S-2')));
  assert.deepEqual(maLech(soSanh(a, b, { chat: true })), ['S-2'], 'sổ migration thêm một dòng ⇒ không giống hệt');
});

test('bắt lệch: Nợ ≠ Có ⇒ sổ (L-2, L-3, L-4), nội dung dòng (L-8.2) và báo cáo dựng lại (R-1, R-2)', { skip }, async () => {
  const a = await doLan();
  await c.query(`UPDATE ledger_lines SET debit = debit + 1 WHERE id = 1`);
  const r = soSanh(a, await doLan());
  await c.query(`UPDATE ledger_lines SET debit = debit - 1 WHERE id = 1`);
  assert.deepEqual(maLech(r), ['L-2', 'L-3', 'L-4', 'L-8.2', 'R-1', 'R-2']);
});

test('nội dung TỪNG DÒNG: đổi cột không vào tổng (diễn giải) ⇒ chỉ L-8.2 lệch, chỉ ra ô; --dong chỉ ra đúng khoá dòng', { skip }, async () => {
  const d1 = mkdtempSync(path.join(tmpdir(), 'dt-d1-')), d2 = mkdtempSync(path.join(tmpdir(), 'dt-d2-'));
  const a = await doLan({ dong: d1 });
  await c.query(`UPDATE ledger_lines SET description = 'sửa lén' WHERE id = 5`);
  const b = await doLan({ dong: d2 });
  await c.query(`UPDATE ledger_lines SET description = '' WHERE id = 5`);
  const r = soSanh(a, b, { dongTruoc: d1, dongSau: d2 });
  assert.deepEqual(maLech(r), ['L-8.2'], 'số dòng, phát sinh, số dư không đổi — chỉ nội dung');
  assert.match(r.lech[0].ly_do, /ô lệch 1/);
  assert.match(r.lech[0].ly_do, /dòng: đổi 1 \(5\)/);
});

test('Master Data: item_id không ULID, mã chồng hiệu lực / cấp lại, tỷ lệ ≤ 0, kho mồ côi, cây có vòng, loại kho lạ ⇒ bắt đúng mục', { skip }, async () => {
  const a = await doLan();
  await c.query(`INSERT INTO items VALUES ('bánh-3', ${t1}, 'sai khuôn')`);
  await c.query(`INSERT INTO item_codes VALUES (4, ${t1}, '${U1}', 'sku', '110063103', '2026-07-01', null)`); // 110063103 đã của U2, chồng hiệu lực
  await c.query(`UPDATE product_units SET ratio = 0 WHERE id = 2`);
  await c.query(`INSERT INTO warehouses VALUES (2, ${t1}, 99, 'la')`);
  await c.query(`UPDATE branches SET parent_id = 2 WHERE id = 1`);
  const r = soSanh(a, await doLan());
  assert.deepEqual(maLech(r), ['M-1', 'M-1.ulid', 'M-2', 'M-2.chong', 'M-2.tai', 'M-3', 'M-3.ty_le', 'M-4', 'M-4.branches', 'M-4.loai', 'M-4.mo_coi', 'M-4.vong']);
  await c.query(`DELETE FROM items WHERE item_id = 'bánh-3'; DELETE FROM item_codes WHERE id = 4; UPDATE product_units SET ratio = 24 WHERE id = 2; DELETE FROM warehouses WHERE id = 2; UPDATE branches SET parent_id = null WHERE id = 1`);
  assert.equal(soSanh(a, await doLan()).dat, true);
});

test('bắt lệch chứng từ + kho: trạng thái đầu phiếu (D-3), payload lịch sử (D-2), bút toán ngoài luồng (L-1, L-5, L-8.1), số lượng kho (D-6, R-3)', { skip }, async () => {
  const a = await doLan();
  await c.query(`UPDATE business_documents SET status = 'cancelled', status_raw = 'cancelled' WHERE doc_no = 'HD-1'`);
  await c.query(`UPDATE accounting_event_versions SET payload = '{"a":99}' WHERE id = 3`);
  await c.query(`INSERT INTO ledger_entries VALUES (4, ${t1}, 'c4', 'b4', false, null)`);
  await c.query(`UPDATE inventory_movements SET qty = 11 WHERE id = 1`);
  const r = soSanh(a, await doLan());
  assert.deepEqual(maLech(r), ['D-2', 'D-3', 'D-6.inventory_movements', 'L-1.1', 'L-5', 'L-8.1', 'R-3']);
  await c.query(`UPDATE business_documents SET status = 'done', status_raw = 'posted' WHERE doc_no = 'HD-1'`);
  await c.query(`UPDATE accounting_event_versions SET payload = '{"a":3}' WHERE id = 3`);
  await c.query(`DELETE FROM ledger_entries WHERE id = 4`);
  await c.query(`UPDATE inventory_movements SET qty = 10 WHERE id = 1`);
});

test('danh sách trắng chỉ cho phép đúng mặc định: cột 0005 khác mặc định (W-1), hoạt động bịa ra (W-2) ⇒ lệch', { skip }, async () => {
  const a = await doLan();
  await c.query(`UPDATE business_documents SET currency = 'USD', fx_rate = 25000, total_fc = 40 WHERE doc_no = 'PN-1'`);
  await c.query(`INSERT INTO document_activities (tenant_id, doc_ref, kind, actor) VALUES (${t1}, 'mua-hang.phieu:PN-1', 'note', 'he-thong')`);
  const r = soSanh(a, await doLan());
  assert.deepEqual(maLech(r), ['W-1', 'W-2']);
  await c.query(`UPDATE business_documents SET currency = 'VND', fx_rate = 1, total_fc = NULL WHERE doc_no = 'PN-1'`);
  await c.query(`ALTER TABLE document_activities DISABLE TRIGGER USER; DELETE FROM document_activities; ALTER TABLE document_activities ENABLE TRIGGER USER`);
});

test('mốc sai sẵn của dữ liệu thật: giữ nguyên ⇒ không lệch (ghi chú); nâng cấp tự "sửa" hay làm nặng thêm ⇒ lệch', { skip }, async () => {
  await c.query(`INSERT INTO ledger_lines VALUES (7, ${t1}, 1, 1, '156', '2026-10-06', 9, 3, 0)`); // mốc: bút toán 1 lệch 3 đồng
  await c.query(`DELETE FROM ledger_balances_daily; INSERT INTO ledger_balances_daily SELECT tenant_id, branch_id, account_code, posting_date, partner_id, sum(debit), sum(credit) FROM ledger_lines GROUP BY 1, 2, 3, 4, 5`);
  const a = await doLan();
  assert.equal(a.ket_qua['L-2'].n, '1');
  const giu = soSanh(a, await doLan());
  assert.equal(giu.dat, true, JSON.stringify(giu.lech));
  assert.ok(giu.ghi_chu.some((g) => g.startsWith('L-2')), 'ghi chú mốc vào biên bản');
  await c.query(`DELETE FROM ledger_lines WHERE id = 7`);
  await c.query(`DELETE FROM ledger_balances_daily; INSERT INTO ledger_balances_daily SELECT tenant_id, branch_id, account_code, posting_date, partner_id, sum(debit), sum(credit) FROM ledger_lines GROUP BY 1, 2, 3, 4, 5`);
  const sua = soSanh(a, await doLan());
  assert.ok(sua.lech.some((x) => x.ma === 'L-2' && /không được tự sửa/.test(x.ly_do)), 'nâng cấp không được tự sửa dữ liệu');
});

test('mục BẮT BUỘC thiếu bảng / cột ⇒ không bỏ qua: hồ sơ open-ketoan báo thiếu + so lệch; hồ sơ core không đòi bảng kế toán', { skip }, async () => {
  const a = await doLan();
  await c.query(`ALTER TABLE item_codes RENAME COLUMN valid_to TO het_han`);
  const b = await doLan();
  const core = await doLan({ hoSo: 'core' });
  await c.query(`ALTER TABLE item_codes RENAME COLUMN het_han TO valid_to`);
  assert.equal(b.ket_qua['M-2.chong'].tt, 'thieu-bat-buoc');
  assert.deepEqual(thieuBatBuoc(b).map(([x]) => x).sort(), ['M-2', 'M-2.chong']);
  const r = soSanh(a, b);
  assert.ok(r.lech.some((x) => x.ma === 'M-2.chong' && /BẮT BUỘC|không đo được/.test(x.ly_do)));
  assert.equal(core.ket_qua['M-2.chong'].tt, 'thieu-cot', 'hồ sơ core: bảng kế toán không bắt buộc');
  assert.deepEqual(thieuBatBuoc(core), []);
});

test('CLI: --out / --so mã thoát 0 khi đạt; bảng sổ mất ⇒ đo exit 1 (THIẾU) và so exit 1; --chi-tiet theo ô', { skip }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dt-'));
  const run = (...args) => { try { return { code: 0, out: execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
  assert.equal(run('--db', url, '--out', path.join(dir, 'a.json')).code, 0);
  assert.equal(run('--db', url, '--out', path.join(dir, 'b.json')).code, 0);
  const ok = run('--so', path.join(dir, 'a.json'), path.join(dir, 'b.json'), '--chat');
  assert.equal(ok.code, 0); assert.match(ok.out, /ĐẠT \(giống hệt\)/);
  await c.query(`ALTER TABLE ledger_entries RENAME TO ledger_entries_cu`);
  const thieu = run('--db', url, '--out', path.join(dir, 'c.json'));
  await c.query(`ALTER TABLE ledger_entries_cu RENAME TO ledger_entries`);
  assert.equal(thieu.code, 1); assert.match(thieu.out, /THIẾU \d+ mục bắt buộc/);
  const bad = run('--so', path.join(dir, 'a.json'), path.join(dir, 'c.json'));
  assert.equal(bad.code, 1); assert.match(bad.out, /KHÔNG ĐẠT/); assert.match(bad.out, /L-1\.1/);
  const ct = run('--db', url, '--chi-tiet', 'L-3');
  assert.equal(ct.code, 0); assert.match(ct.out, /156/);
  const o = Object.keys(JSON.parse((await import('node:fs')).readFileSync(path.join(dir, 'a.json'), 'utf8')).ket_qua['L-8.2'].o)[0];
  const co = run('--db', url, '--chi-tiet', 'L-8.2', '--o', o);
  assert.equal(co.code, 0); assert.match(co.out, /khoa/);
});
