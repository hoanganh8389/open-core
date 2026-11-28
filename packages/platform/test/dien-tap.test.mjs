// [2026-11-28 10:05 PM Johnny Chu - Chu Hoàng Anh] S004-W1-3 — tự kiểm bộ đo bất biến (tools/dien-tap/do-bat-bien.mjs) trên CSDL lõi + bảng sổ dựng giả theo cột thật của open-ketoan:
// nâng cấp không chạm dữ liệu ⇒ ĐẠT; làm sai từng loại (lệch Nợ / Có, đổi trạng thái chứng từ, cột mới khác mặc định, hoạt động bịa ra, bảng sổ mất) ⇒ bắt đúng mục;
// mốc sai sẵn của dữ liệu thật giữ nguyên ⇒ không tính là lệch; bộ đo chỉ đọc; CLI --out / --so trả mã thoát đúng.
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
const { doBatBien, soSanh, MUC } = await import(new URL('../../../tools/dien-tap/do-bat-bien.mjs', import.meta.url).href);

let c, t1;
before(async () => {
  if (!url) return;
  t1 = await themDonVi(url, 'dien-tap-1');
  c = new pg.Client({ connectionString: url }); await c.connect();
  // bảng sổ của open-ketoan, đúng tên + cột bộ đo dùng (bản thu gọn)
  await c.query(`
    CREATE TABLE ledger_entries (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, content_hash text, body_hash text, is_reversal boolean NOT NULL DEFAULT false, reverses_entry_id bigint);
    CREATE TABLE ledger_lines (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, entry_id bigint NOT NULL, branch_id bigint, account_code text NOT NULL, posting_date date NOT NULL, partner_id bigint, debit numeric(18,2) NOT NULL DEFAULT 0, credit numeric(18,2) NOT NULL DEFAULT 0);
    CREATE TABLE ledger_balances_daily (tenant_id bigint, branch_id bigint, account_code text, posting_date date, partner_id bigint, debit numeric(18,2), credit numeric(18,2));
    CREATE TABLE accounting_events (id bigint PRIMARY KEY, tenant_id bigint NOT NULL, doc_key text, version int, status text, posted_version int, total numeric(18,2));
    CREATE TABLE accounting_event_versions (id bigint PRIMARY KEY, event_id bigint, version int, payload jsonb);`);
  await c.query(`
    INSERT INTO ledger_entries VALUES (1, ${t1}, 'c1', 'b1', false, null), (2, ${t1}, 'c2', 'b2', false, null), (3, ${t1}, 'c3', 'b3', true, 2);
    INSERT INTO ledger_lines VALUES (1, ${t1}, 1, 1, '156', '2026-10-05', 9, 1000000, 0), (2, ${t1}, 1, 1, '331', '2026-10-05', 9, 0, 1000000),
                                    (3, ${t1}, 2, 1, '131', '2026-11-02', 7, 500000, 0), (4, ${t1}, 2, 1, '511', '2026-11-02', 7, 0, 500000),
                                    (5, ${t1}, 3, 1, '511', '2026-11-03', 7, 500000, 0), (6, ${t1}, 3, 1, '131', '2026-11-03', 7, 0, 500000);
    INSERT INTO ledger_balances_daily SELECT tenant_id, branch_id, account_code, posting_date, partner_id, sum(debit), sum(credit) FROM ledger_lines GROUP BY 1, 2, 3, 4, 5;
    INSERT INTO accounting_events VALUES (10, ${t1}, 'mh:PN-1', 1, 'posted', 1, 1000000), (11, ${t1}, 'ban:HD-1', 2, 'posted', 2, 500000);
    INSERT INTO accounting_event_versions VALUES (1, 10, 1, '{"a":1}'), (2, 11, 1, '{"a":2}'), (3, 11, 2, '{"a":3}');
    INSERT INTO business_documents (tenant_id, doc_ref, module, doc_type, doc_no, status_raw, status, total)
      VALUES (${t1}, 'mua-hang.phieu:PN-1', 'mua-hang', 'mua_hang.phieu', 'PN-1', 'posted', 'done', 1000000), (${t1}, 'ban-hang.hd:HD-1', 'ban-hang', 'ban_hang.hd', 'HD-1', 'posted', 'done', 500000);
    INSERT INTO audit_logs (tenant_id, actor, action, object_type, object_id) VALUES (${t1}, 'user:1', 'a', 'x', '1'), (${t1}, 'user:1', 'b', 'x', '2');`);
});
after(async () => { await c?.end(); });
const doLan = async () => doBatBien(c);

test('đủ mục L / D / H / W, mã không trùng', () => {
  const ma = MUC.map((m) => m.ma);
  assert.equal(new Set(ma).size, ma.length);
  for (const g of ['L', 'D', 'H', 'W']) assert.ok(MUC.some((m) => m.nhom === g), g);
});

test('đo: sổ cân, số dư khớp, không đảo mồ côi, chuỗi bằng chứng nguyên vẹn; bảng không có ⇒ không áp dụng; chỉ đọc', { skip }, async () => {
  const a = await doLan();
  const k = a.ket_qua;
  assert.deepEqual([k['L-2'].n, k['L-4'].n, k['L-6'].n, k['H-1.chuoi'].n, k['W-1'].n, k['W-2'].n], ['0', '0', '0', '0', '0', '0']);
  assert.equal(k['L-1.2'].n, '1', 'một đơn vị có dòng sổ');
  assert.equal(k['D-1'].n, '2'); assert.equal(k['D-2'].n, '3'); assert.equal(k['D-3'].n, '2');
  assert.equal(k['D-6.purchase_documents'].tt, 'khong-ap-dung');
  assert.equal(k['L-7.1'].tt, 'khong-ap-dung');
  // chỉ đọc: đo xong không để lại gì (giao dịch READ ONLY + ROLLBACK)
  assert.equal((await c.query(`SELECT count(*)::int n FROM pg_stat_activity WHERE state = 'idle in transaction' AND datname = current_database()`)).rows[0].n, 0);
});

test('nâng cấp không chạm dữ liệu ⇒ ĐẠT (thêm migration, cột mới đúng mặc định, bảng mới rỗng)', { skip }, async () => {
  const a = await doLan();
  await c.query(`INSERT INTO schema_migrations (name, source) VALUES ('0187_truc_chung_tu.sql', 'app') ON CONFLICT DO NOTHING`);
  const b = await doLan();
  const r = soSanh(a, b);
  assert.equal(r.dat, true, JSON.stringify(r.lech));
});

test('bắt lệch: Nợ ≠ Có, phát sinh đổi, số dư không khớp — đúng ba mục sổ', { skip }, async () => {
  const a = await doLan();
  await c.query(`UPDATE ledger_lines SET debit = debit + 1 WHERE id = 1`);
  const r = soSanh(a, await doLan());
  await c.query(`UPDATE ledger_lines SET debit = debit - 1 WHERE id = 1`);
  assert.equal(r.dat, false);
  assert.deepEqual(r.lech.map((x) => x.ma).sort(), ['L-2', 'L-3', 'L-4']);
});

test('bắt lệch chứng từ: đổi trạng thái đầu phiếu (D-3), sửa payload lịch sử nộp sổ (D-2), thêm bút toán ngoài luồng (L-1, L-5)', { skip }, async () => {
  const a = await doLan();
  await c.query(`UPDATE business_documents SET status = 'cancelled', status_raw = 'cancelled' WHERE doc_no = 'HD-1'`);
  await c.query(`UPDATE accounting_event_versions SET payload = '{"a":99}' WHERE id = 3`);
  await c.query(`INSERT INTO ledger_entries VALUES (4, ${t1}, 'c4', 'b4', false, null)`);
  const r = soSanh(a, await doLan());
  assert.deepEqual(r.lech.map((x) => x.ma).sort(), ['D-2', 'D-3', 'L-1.1', 'L-5']);
  await c.query(`UPDATE business_documents SET status = 'done', status_raw = 'posted' WHERE doc_no = 'HD-1'`);
  await c.query(`UPDATE accounting_event_versions SET payload = '{"a":3}' WHERE id = 3`);
  await c.query(`DELETE FROM ledger_entries WHERE id = 4`);
});

test('danh sách trắng chỉ cho phép đúng mặc định: cột 0005 khác mặc định (W-1), hoạt động bịa ra (W-2) ⇒ lệch', { skip }, async () => {
  const a = await doLan();
  await c.query(`UPDATE business_documents SET currency = 'USD', fx_rate = 25000, total_fc = 40 WHERE doc_no = 'PN-1'`);
  await c.query(`INSERT INTO document_activities (tenant_id, doc_ref, kind, actor) VALUES (${t1}, 'mua-hang.phieu:PN-1', 'note', 'he-thong')`);
  const r = soSanh(a, await doLan());
  assert.deepEqual(r.lech.map((x) => x.ma).sort(), ['W-1', 'W-2']);
  await c.query(`UPDATE business_documents SET currency = 'VND', fx_rate = 1, total_fc = NULL WHERE doc_no = 'PN-1'`);
});

test('mốc sai sẵn của dữ liệu thật: giữ nguyên ⇒ không lệch (ghi chú); nâng cấp tự "sửa" hay làm nặng thêm ⇒ lệch', { skip }, async () => {
  await c.query(`DROP TABLE document_activities CASCADE`); // tách bài trước: W-2 không còn áp dụng
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

test('bảng sổ mất sau nâng cấp ⇒ lệch; CLI --out / --so trả mã thoát 0 khi đạt, 1 khi lệch', { skip }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dt-'));
  const run = (...args) => { try { return { code: 0, out: execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
  assert.equal(run('--db', url, '--out', path.join(dir, 'a.json')).code, 0);
  assert.equal(run('--db', url, '--out', path.join(dir, 'b.json')).code, 0);
  const ok = run('--so', path.join(dir, 'a.json'), path.join(dir, 'b.json'));
  assert.equal(ok.code, 0); assert.match(ok.out, /ĐẠT/);
  await c.query(`ALTER TABLE ledger_entries RENAME TO ledger_entries_cu`);
  assert.equal(run('--db', url, '--out', path.join(dir, 'c.json')).code, 0);
  await c.query(`ALTER TABLE ledger_entries_cu RENAME TO ledger_entries`);
  const bad = run('--so', path.join(dir, 'a.json'), path.join(dir, 'c.json'));
  assert.equal(bad.code, 1); assert.match(bad.out, /KHÔNG ĐẠT/); assert.match(bad.out, /L-1\.1/);
  const ct = run('--db', url, '--chi-tiet', 'L-3');
  assert.equal(ct.code, 0); assert.match(ct.out, /156/);
});
