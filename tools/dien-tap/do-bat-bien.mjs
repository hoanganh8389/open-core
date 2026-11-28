#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 10:05 PM Johnny Chu - Chu Hoàng Anh] S004-W1-3 (PHASE-004 · 20 §3) — bộ đo BẤT BIẾN cho diễn tập nâng cấp open-ketoan lên Core release trên bản sao CSDL.
// CHỈ ĐỌC (mọi câu là SELECT, chạy trong giao dịch READ ONLY). Đo sổ cái (L), chứng từ (D), lịch sử / quyền (H) và mục "chỉ sau nâng cấp" (W — danh sách trắng §3.4).
//   node tools/dien-tap/do-bat-bien.mjs --db <url> [--out truoc.json]      đo, in / ghi JSON
//   node tools/dien-tap/do-bat-bien.mjs --so truoc.json sau.json            so hai lần đo: lệch ngoài danh sách trắng ⇒ KHÔNG ĐẠT (exit 1)
//   node tools/dien-tap/do-bat-bien.mjs --db <url> --chi-tiet <mã>          in chi tiết một mục theo đơn vị (tìm chỗ lệch)
// Bảng / cột không có ⇒ "khong-ap-dung" / "thieu-cot" (không đoán). Băm: md5 mỗi dòng → cộng tiền tố 60 bit (không phụ thuộc thứ tự, nhẹ với bảng lớn) + số dòng.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../packages/platform/package.json'));
const pg = require('pg');

const ROW_HASH = (cols) => `coalesce(sum(('x' || substr(md5(concat_ws('|', ${cols.map((c) => `coalesce((${c})::text, '∅')`).join(', ')})), 1, 15))::bit(60)::bigint), 0)::text`;
/** Số dòng + băm (cột chỉ định) của một bảng. */
const hashOf = (table, cols, where = 'true') => `SELECT count(*)::bigint::text AS n, ${ROW_HASH(cols)} AS h FROM ${table} t WHERE ${where}`;
/** Như hashOf nhưng theo đơn vị — cho --chi-tiet. */
const hashByTenant = (table, cols, where = 'true') => `SELECT tenant_id::text AS tenant, count(*)::bigint::text AS n, ${ROW_HASH(cols)} AS h FROM ${table} t WHERE ${where} GROUP BY tenant_id ORDER BY tenant_id`;
const ALL = ['t']; // cả dòng (t::text) — chỉ cho bảng nâng cấp KHÔNG đổi cột

/**
 * Mục đo. kieu: 'bang' (A = B) · 'khong' (phải 0 ở mọi lần đo có bảng) · 'sau' (chỉ đo khi có bảng mới — phải 0; danh sách trắng §3.4).
 * can: bảng → cột cần có. sql: một dòng { n, h } (hoặc { n }). chiTiet: câu theo đơn vị cho --chi-tiet.
 */
export const MUC = [
  // ── L: sổ cái
  ...['ledger_entries', 'ledger_lines', 'ledger_links', 'ledger_balances_daily'].map((b, i) => ({
    ma: `L-1.${i + 1}`, nhom: 'L', ten: `số dòng ${b} theo đơn vị`, kieu: 'bang', can: { [b]: ['tenant_id'] },
    sql: `SELECT count(*)::bigint::text AS n, coalesce(md5(string_agg(tenant_id::text || ':' || c::text, ',' ORDER BY tenant_id)), '') AS h FROM (SELECT tenant_id, count(*) c FROM ${b} GROUP BY tenant_id) x`,
    chiTiet: `SELECT tenant_id::text AS tenant, count(*)::text AS n FROM ${b} GROUP BY tenant_id ORDER BY tenant_id`,
  })),
  { ma: 'L-2', nhom: 'L', ten: 'bút toán lệch Nợ ≠ Có (phải 0)', kieu: 'khong', can: { ledger_lines: ['tenant_id', 'entry_id', 'debit', 'credit'] },
    sql: `SELECT count(*)::text AS n FROM (SELECT 1 FROM ledger_lines GROUP BY tenant_id, entry_id HAVING sum(debit) <> sum(credit)) x`,
    chiTiet: `SELECT tenant_id::text AS tenant, entry_id::text AS entry, sum(debit)::text AS no, sum(credit)::text AS co FROM ledger_lines GROUP BY tenant_id, entry_id HAVING sum(debit) <> sum(credit) ORDER BY 1, 2 LIMIT 50` },
  { ma: 'L-3', nhom: 'L', ten: 'số phát sinh theo (đơn vị, tài khoản, tháng)', kieu: 'bang', can: { ledger_lines: ['tenant_id', 'account_code', 'posting_date', 'debit', 'credit'] },
    sql: `SELECT count(*)::text AS n, ${ROW_HASH(['t.tenant_id', 't.account_code', 't.m', 't.no', 't.co'])} AS h FROM (SELECT tenant_id, account_code, date_trunc('month', posting_date)::date AS m, sum(debit) AS no, sum(credit) AS co FROM ledger_lines GROUP BY 1, 2, 3) t`,
    chiTiet: `SELECT tenant_id::text AS tenant, account_code AS tk, to_char(date_trunc('month', posting_date), 'YYYY-MM') AS thang, sum(debit)::text AS no, sum(credit)::text AS co FROM ledger_lines GROUP BY 1, 2, 3 ORDER BY 1, 2, 3` },
  { ma: 'L-4', nhom: 'L', ten: 'số dư ngày khớp tính lại từ dòng sổ (phải 0 lệch)', kieu: 'khong',
    can: { ledger_balances_daily: ['tenant_id', 'branch_id', 'account_code', 'posting_date', 'partner_id', 'debit', 'credit'], ledger_lines: ['tenant_id', 'branch_id', 'account_code', 'posting_date', 'partner_id', 'debit', 'credit'] },
    sql: `WITH l AS (SELECT tenant_id, branch_id, account_code, posting_date, partner_id, sum(debit) d, sum(credit) c FROM ledger_lines GROUP BY 1, 2, 3, 4, 5)
          SELECT count(*)::text AS n FROM l FULL JOIN ledger_balances_daily b USING (tenant_id, branch_id, account_code, posting_date, partner_id)
          WHERE coalesce(l.d, 0) <> coalesce(b.debit, 0) OR coalesce(l.c, 0) <> coalesce(b.credit, 0)` },
  { ma: 'L-5', nhom: 'L', ten: 'băm nội dung bút toán (content_hash, body_hash)', kieu: 'bang', can: { ledger_entries: ['id', 'content_hash', 'body_hash'] },
    sql: hashOf('ledger_entries', ['t.id', 't.content_hash', 't.body_hash']), chiTiet: hashByTenant('ledger_entries', ['t.id', 't.content_hash', 't.body_hash']) },
  { ma: 'L-6', nhom: 'L', ten: 'bút toán đảo mồ côi (phải 0)', kieu: 'khong', can: { ledger_entries: ['id', 'is_reversal', 'reverses_entry_id'] },
    sql: `SELECT count(*)::text AS n FROM ledger_entries e WHERE e.is_reversal AND (e.reverses_entry_id IS NULL OR NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.id = e.reverses_entry_id))` },
  ...['period_locks', 'period_lock_events'].map((b, i) => ({ ma: `L-7.${i + 1}`, nhom: 'L', ten: `${b} (cả dòng)`, kieu: 'bang', can: { [b]: [] }, sql: hashOf(b, ALL), chiTiet: hashByTenant(b, ALL) })),

  // ── D: chứng từ
  { ma: 'D-1', nhom: 'D', ten: 'sự việc kế toán (doc_key, version, status, posted_version, total)', kieu: 'bang', can: { accounting_events: ['doc_key', 'version', 'status', 'posted_version', 'total'] },
    sql: hashOf('accounting_events', ['t.id', 't.doc_key', 't.version', 't.status', 't.posted_version', 't.total']), chiTiet: hashByTenant('accounting_events', ['t.id', 't.doc_key', 't.version', 't.status', 't.posted_version', 't.total']) },
  { ma: 'D-2', nhom: 'D', ten: 'lịch sử nộp sổ (payload từng phiên bản)', kieu: 'bang', can: { accounting_event_versions: ['event_id', 'version', 'payload'] },
    sql: hashOf('accounting_event_versions', ['t.event_id', 't.version', 'md5(t.payload::text)']) },
  { ma: 'D-3', nhom: 'D', ten: 'đầu phiếu chung — CỘT CŨ (doc_ref, status_raw, status, version, total)', kieu: 'bang', can: { business_documents: ['doc_ref', 'status_raw', 'status', 'version', 'total'] },
    sql: hashOf('business_documents', ['t.tenant_id', 't.doc_ref', 't.status_raw', 't.status', 't.version', 't.total']),
    chiTiet: `SELECT tenant_id::text AS tenant, doc_type, status, count(*)::text AS n FROM business_documents GROUP BY 1, 2, 3 ORDER BY 1, 2, 3` },
  ...['document_versions', 'document_links', 'document_signatures', 'document_attachments', 'document_sequences'].map((b) => ({
    ma: `D-${b === 'document_attachments' ? '5' : b === 'document_sequences' ? '7' : '4'}.${b}`, nhom: 'D', ten: `${b} (cả dòng)`, kieu: 'bang', can: { [b]: ['tenant_id'] }, sql: hashOf(b, ALL), chiTiet: hashByTenant(b, ALL),
  })),
  ...['purchase_documents', 'sales_lines', 'sales_payments', 'tax_invoices', 'tax_invoice_lines', 'inventory_movements', 'inventory_costs', 'debt_items', 'debt_allocations'].map((b) => ({
    ma: `D-6.${b}`, nhom: 'D', ten: `${b} (cả dòng)`, kieu: 'bang', can: { [b]: [] }, sql: hashOf(b, ALL),
  })),

  // ── H: lịch sử, bằng chứng, quyền, cài đặt
  { ma: 'H-1.so', nhom: 'H', ten: 'số dòng nhật ký bằng chứng', kieu: 'bang', can: { audit_logs: ['id'] }, sql: hashOf('audit_logs', ['t.id', 't.hash']) },
  { ma: 'H-1.chuoi', nhom: 'H', ten: 'chuỗi băm nhật ký đứt (phải 0) — cùng phép kiểm EVIDENCE_CHAIN của lane chẩn đoán', kieu: 'khong', can: { audit_logs: ['chain_seq', 'prev_hash', 'hash'] },
    sql: `WITH c AS (SELECT id, chain_seq, lag(hash) OVER w AS lag_hash, lag(chain_seq) OVER w AS lag_seq FROM audit_logs WHERE chain_seq IS NOT NULL WINDOW w AS (PARTITION BY tenant_id ORDER BY chain_seq))
          SELECT count(*)::text AS n FROM c JOIN audit_logs a ON a.id = c.id
          WHERE a.hash IS DISTINCT FROM audit_log_hash(a) OR a.prev_hash IS DISTINCT FROM c.lag_hash OR c.chain_seq <> coalesce(c.lag_seq, 0) + 1`,
    chiTiet: `WITH c AS (SELECT id, tenant_id, chain_seq, lag(hash) OVER w AS lag_hash, lag(chain_seq) OVER w AS lag_seq FROM audit_logs WHERE chain_seq IS NOT NULL WINDOW w AS (PARTITION BY tenant_id ORDER BY chain_seq))
          SELECT c.tenant_id::text AS tenant, c.chain_seq::text AS seq, a.id::text AS id FROM c JOIN audit_logs a ON a.id = c.id
          WHERE a.hash IS DISTINCT FROM audit_log_hash(a) OR a.prev_hash IS DISTINCT FROM c.lag_hash OR c.chain_seq <> coalesce(c.lag_seq, 0) + 1 ORDER BY 1, 2 LIMIT 50` },
  { ma: 'H-2', nhom: 'H', ten: 'việc giao sự kiện theo trạng thái', kieu: 'bang', can: { event_deliveries: ['status'] },
    sql: `SELECT count(*)::text AS n, coalesce(md5(string_agg(status || ':' || c::text, ',' ORDER BY status)), '') AS h FROM (SELECT status, count(*) c FROM event_deliveries GROUP BY status) x` },
  { ma: 'H-2.outbox', nhom: 'H', ten: 'số sự kiện outbox', kieu: 'bang', can: { event_outbox: ['id'] }, sql: hashOf('event_outbox', ['t.id']) },
  ...['users', 'tenant_roles', 'tenant_role_rules', 'user_role_assignments'].map((b) => ({ ma: `H-3.${b}`, nhom: 'H', ten: `${b} (cả dòng)`, kieu: 'bang', can: { [b]: [] }, sql: hashOf(b, ALL) })),
  { ma: 'H-5.setting_values', nhom: 'H', ten: 'cài đặt (cả dòng)', kieu: 'bang', can: { setting_values: [] }, sql: hashOf('setting_values', ALL) },
  { ma: 'H-5.tenant_secrets', nhom: 'H', ten: 'bí mật — bản mã (không giải mã)', kieu: 'bang', can: { tenant_secrets: [] }, sql: hashOf('tenant_secrets', ALL) },

  // ── W: chỉ sau nâng cấp (danh sách trắng §3.4) — phải 0
  { ma: 'W-1', nhom: 'W', ten: 'cột mới 0005 của đầu phiếu đều là mặc định (VND, tỷ giá 1, không nguyên tệ, chưa gắn nút, chưa lưu trữ)', kieu: 'sau',
    can: { business_documents: ['currency', 'fx_rate', 'total_fc', 'org_unit_code', 'archived_at'] },
    sql: `SELECT count(*)::text AS n FROM business_documents WHERE currency <> 'VND' OR fx_rate <> 1 OR total_fc IS NOT NULL OR org_unit_code <> '' OR archived_at IS NOT NULL` },
  { ma: 'W-2', nhom: 'W', ten: 'bảng mới document_activities rỗng (lịch sử cũ không bịa ra)', kieu: 'sau', can: { document_activities: ['id'] }, sql: `SELECT count(*)::text AS n FROM document_activities` },
  { ma: 'W-3', nhom: 'W', ten: 'không đầu phiếu nào vi phạm khuôn loại chứng từ (cũ lẫn mới)', kieu: 'sau', can: { business_documents: ['doc_type'] },
    sql: `SELECT count(*)::text AS n FROM business_documents WHERE doc_type !~ '^[a-z][a-z0-9_-]*\\.[a-z][a-z0-9_-]*$'` },
];

async function coCot(client) {
  const r = await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`);
  const m = new Map();
  for (const x of r.rows) { if (!m.has(x.table_name)) m.set(x.table_name, new Set()); m.get(x.table_name).add(x.column_name); }
  return m;
}
function tinhTrang(muc, cols) {
  for (const [b, cs] of Object.entries(muc.can)) {
    if (!cols.has(b)) return { tt: 'khong-ap-dung', ly_do: `không có bảng ${b}` };
    const thieu = cs.filter((c) => !cols.get(b).has(c));
    if (thieu.length) return { tt: 'thieu-cot', ly_do: `${b} thiếu cột ${thieu.join(', ')}` };
  }
  return { tt: 'do' };
}

/** Đo mọi mục trên một kết nối (giao dịch READ ONLY). */
export async function doBatBien(client, meta = {}) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const cols = await coCot(client);
    const ketQua = {};
    for (const m of MUC) {
      const s = tinhTrang(m, cols);
      if (s.tt !== 'do') { ketQua[m.ma] = { nhom: m.nhom, ten: m.ten, kieu: m.kieu, ...s }; continue; }
      // mỗi mục một SAVEPOINT: một câu lỗi (vd thiếu hàm audit_log_hash) không làm hỏng các mục sau
      await client.query('SAVEPOINT muc');
      try {
        const r = (await client.query(m.sql)).rows[0];
        ketQua[m.ma] = { nhom: m.nhom, ten: m.ten, kieu: m.kieu, tt: 'do', n: r.n, ...(r.h !== undefined ? { h: r.h } : {}) };
        await client.query('RELEASE SAVEPOINT muc');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT muc');
        ketQua[m.ma] = { nhom: m.nhom, ten: m.ten, kieu: m.kieu, tt: 'loi', ly_do: String(e.message).slice(0, 200) };
      }
    }
    const v = (await client.query(`SELECT current_database() AS db, version() AS pg, now() AS luc`)).rows[0];
    return { contract: 'bizcity_dien_tap_bat_bien@1', luc: new Date(v.luc).toISOString(), csdl: v.db, postgres: String(v.pg).split(' ').slice(0, 2).join(' '), ...meta, ket_qua: ketQua };
  } finally { await client.query('ROLLBACK'); }
}

/** So hai lần đo (A trước, B sau). Trả { dat, lech[], ghi_chu[] }. */
export function soSanh(a, b) {
  const lech = []; const ghiChu = [];
  for (const m of MUC) {
    const x = a.ket_qua[m.ma], y = b.ket_qua[m.ma];
    if (!x || !y) { lech.push({ ma: m.ma, ly_do: 'thiếu mục trong một lần đo (khác phiên bản bộ đo?)' }); continue; }
    if (m.kieu === 'sau') {
      if (y.tt === 'do' && y.n !== '0') lech.push({ ma: m.ma, ten: m.ten, ly_do: `sau nâng cấp còn ${y.n} dòng vi phạm` });
      continue;
    }
    if (y.tt === 'loi' || x.tt === 'loi') { lech.push({ ma: m.ma, ten: m.ten, ly_do: `không đo được: ${(y.tt === 'loi' ? y : x).ly_do}` }); continue; }
    if (y.tt === 'thieu-cot' || (x.tt === 'do' && y.tt !== 'do')) { lech.push({ ma: m.ma, ten: m.ten, ly_do: `sau nâng cấp: ${y.ly_do ?? y.tt}` }); continue; }
    if (x.tt !== 'do' && y.tt !== 'do') { ghiChu.push(`${m.ma}: không áp dụng (${y.ly_do})`); continue; }
    if (x.tt !== 'do' && y.tt === 'do') { lech.push({ ma: m.ma, ten: m.ten, ly_do: `trước nâng cấp ${x.ly_do} nhưng sau lại có — bảng sổ / chứng từ không được sinh ra do nâng cấp` }); continue; }
    if (m.kieu === 'khong') {
      // phải 0; nếu dữ liệu thật đã sai từ trước (mốc) thì sau nâng cấp phải GIỮ ĐÚNG số đó — tăng hay giảm đều là nâng cấp đã chạm dữ liệu
      if (y.n !== '0' && y.n !== x.n) lech.push({ ma: m.ma, ten: m.ten, ly_do: `trước ${x.n} · sau ${y.n} chỗ sai` });
      else if (y.n === '0' && x.n !== '0') lech.push({ ma: m.ma, ten: m.ten, ly_do: `trước ${x.n} chỗ sai, sau 0 — nâng cấp không được tự sửa dữ liệu` });
      if (x.n !== '0') ghiChu.push(`${m.ma}: TRƯỚC nâng cấp đã có ${x.n} chỗ sai — mốc của dữ liệu thật, ghi biên bản, không sửa trong diễn tập`);
      continue;
    }
    if (x.n !== y.n || x.h !== y.h) lech.push({ ma: m.ma, ten: m.ten, ly_do: `trước n=${x.n}${x.h !== undefined ? ` h=${x.h}` : ''} · sau n=${y.n}${y.h !== undefined ? ` h=${y.h}` : ''}` });
  }
  return { dat: lech.length === 0, lech, ghi_chu: ghiChu };
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--so')) {
    const [fa, fb] = args.slice(args.indexOf('--so') + 1);
    const a = JSON.parse(readFileSync(fa, 'utf8')), b = JSON.parse(readFileSync(fb, 'utf8'));
    const r = soSanh(a, b);
    for (const g of r.ghi_chu) console.log(`  · ${g}`);
    for (const l of r.lech) console.log(`  ✗ ${l.ma} ${l.ten ?? ''}: ${l.ly_do}`);
    console.log(r.dat ? `ĐẠT: ${Object.keys(b.ket_qua).length} mục — lệch ngoài danh sách trắng = 0` : `KHÔNG ĐẠT: ${r.lech.length} mục lệch — dừng, không đổi nguồn (PHASE-004 · 20 §5)`);
    process.exit(r.dat ? 0 : 1);
  }
  const db = val('--db');
  if (!db) { console.error('Dùng: --db <url> [--out tệp.json] | --db <url> --chi-tiet <mã> | --so truoc.json sau.json'); process.exit(2); }
  const client = new pg.Client({ connectionString: db }); await client.connect();
  try {
    const ma = val('--chi-tiet');
    if (ma) {
      const m = MUC.find((x) => x.ma === ma);
      if (!m) { console.error(`Không có mục ${ma}. Mục: ${MUC.map((x) => x.ma).join(' ')}`); process.exit(2); }
      await client.query('BEGIN READ ONLY');
      const rows = (await client.query(m.chiTiet ?? m.sql)).rows; await client.query('ROLLBACK');
      console.table(rows);
      return;
    }
    const kq = await doBatBien(client, { nhan: val('--nhan') ?? '' });
    const out = val('--out');
    if (out) { writeFileSync(out, JSON.stringify(kq, null, 2) + '\n'); console.log(`Đã ghi ${out}: ${Object.keys(kq.ket_qua).length} mục.`); }
    else console.log(JSON.stringify(kq, null, 2));
    const sai = Object.entries(kq.ket_qua).filter(([, v]) => v.kieu !== 'bang' && v.tt === 'do' && v.n !== '0');
    for (const [k, v] of sai) console.log(`  ! ${k} ${v.ten}: ${v.n}`);
  } finally { await client.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
