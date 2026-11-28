#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 10:05 PM Johnny Chu - Chu Hoàng Anh] S004-W1-3 (PHASE-004 · 20 §3) — bộ đo BẤT BIẾN cho diễn tập nâng cấp open-ketoan lên Core release trên bản sao CSDL.
// [2026-11-29 12:39 AM Johnny Chu - Chu Hoàng Anh] S004-W1-3b — bản 2 (bizcity_dien_tap_bat_bien@2): nội dung TỪNG DÒNG sổ / chứng từ (băm chia 256 ô + tệp dòng --dong),
//   nhóm M (Master Data — ADR-0001 MD-1…MD-4), nhóm R (kết quả báo cáo dựng lại bằng SQL), nhóm S (vân lược đồ + sổ migration), mục BẮT BUỘC theo hồ sơ
//   (thiếu bảng / cột ⇒ KHÔNG ĐẠT, không còn "không áp dụng" cho mục bắt buộc), chế độ so --chat (giống hệt — cho chạy lại migration và khôi phục bản sao lưu).
// CHỈ ĐỌC (mọi câu là SELECT, chạy trong giao dịch READ ONLY).
//   node tools/dien-tap/do-bat-bien.mjs --db <url> [--ho-so open-ketoan|core] [--out a.json] [--dong <thư mục>]   đo (thiếu mục bắt buộc ⇒ exit 1)
//   node tools/dien-tap/do-bat-bien.mjs --so a.json b.json [--chat] [--dong-truoc <thư mục> --dong-sau <thư mục>]  so: lệch ⇒ exit 1
//   node tools/dien-tap/do-bat-bien.mjs --db <url> --chi-tiet <mã> [--o <ô>]                                        chi tiết một mục (theo đơn vị / theo ô)
// Băm: md5 mỗi dòng → cộng tiền tố 60 bit (không phụ thuộc thứ tự) + số dòng; mục "dòng" chia 256 ô theo khoá ⇒ so chỉ ra ô lệch, --dong chỉ ra khoá lệch.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../packages/platform/package.json'));
const pg = require('pg');

export const CONTRACT = 'bizcity_dien_tap_bat_bien@2';
export const HO_SO = { 'open-ketoan': ['core', 'ketoan'], core: ['core'] };
const O = 256; // số ô của mục "dòng"

const ROW_HASH = (cols) => `coalesce(sum(('x' || substr(md5(concat_ws('|', ${cols.map((c) => `coalesce((${c})::text, '∅')`).join(', ')})), 1, 15))::bit(60)::bigint), 0)::text`;
/** Số dòng + băm (cột chỉ định) của một bảng. */
const hashOf = (table, cols, where = 'true') => `SELECT count(*)::bigint::text AS n, ${ROW_HASH(cols)} AS h FROM ${table} t WHERE ${where}`;
const hashByTenant = (table, cols, where = 'true') => `SELECT tenant_id::text AS tenant, count(*)::bigint::text AS n, ${ROW_HASH(cols)} AS h FROM ${table} t WHERE ${where} GROUP BY tenant_id ORDER BY tenant_id`;
/** Băm kết quả một câu (mỗi dòng kết quả là một "dòng báo cáo"). */
const hashQuery = (q, cols) => `SELECT count(*)::text AS n, ${ROW_HASH(cols.map((c) => `t.${c}`))} AS h FROM (${q}) t`;
const ALL = ['t']; // cả dòng (t::text)

/**
 * Mục "dòng": NỘI DUNG từng dòng (cả dòng t::text), chia ô theo khoá. Bảng nâng cấp lõi không đổi cột (sổ, chứng từ kế toán, danh mục) nên cả dòng phải giống hệt.
 * khoa: biểu thức khoá dòng (định vị dòng lệch).
 */
const dong = (ma, nhom, bang, khoa, bb, ten, can = []) => ({
  ma, nhom, bb, ten: `${ten ?? bang} — nội dung từng dòng`, kieu: 'bang', can: { [bang]: can }, dong: { bang, khoa },
  sql: `SELECT (abs(hashtext((${khoa})::text)) % ${O})::int AS o, count(*)::bigint::text AS n, ${ROW_HASH(ALL)} AS h FROM ${bang} t GROUP BY 1`,
  chiTiet: hashByTenant(bang, ALL),
  chiTietO: (o) => `SELECT (${khoa})::text AS khoa, md5(t::text) AS md5 FROM ${bang} t WHERE abs(hashtext((${khoa})::text)) % ${O} = ${Number(o)} ORDER BY 1 LIMIT 500`,
});
const LEDGER_BAL_KEY = `concat_ws('|', t.tenant_id, t.branch_id, t.account_code, t.posting_date, t.partner_id)`;

/**
 * Mục đo. kieu: 'bang' (trước = sau) · 'khong' (phải 0, hoặc giữ đúng mốc sai sẵn) · 'sau' (chỉ đo sau nâng cấp — phải 0) · 'luoc' (lược đồ: đổi là bình thường, chỉ so ở --chat).
 * bb: mục BẮT BUỘC của hồ sơ nào ('core' — bảng của lõi; 'ketoan' — bảng của open-ketoan). Thiếu bảng / cột của mục bắt buộc ⇒ KHÔNG ĐẠT.
 */
export const MUC = [
  // ── L: sổ cái
  ...['ledger_entries', 'ledger_lines', 'ledger_links', 'ledger_balances_daily'].map((b, i) => ({
    ma: `L-1.${i + 1}`, nhom: 'L', bb: 'ketoan', ten: `số dòng ${b} theo đơn vị`, kieu: 'bang', can: { [b]: ['tenant_id'] },
    sql: `SELECT count(*)::bigint::text AS n, coalesce(md5(string_agg(tenant_id::text || ':' || c::text, ',' ORDER BY tenant_id)), '') AS h FROM (SELECT tenant_id, count(*) c FROM ${b} GROUP BY tenant_id) x`,
    chiTiet: `SELECT tenant_id::text AS tenant, count(*)::text AS n FROM ${b} GROUP BY tenant_id ORDER BY tenant_id`,
  })),
  { ma: 'L-2', nhom: 'L', bb: 'ketoan', ten: 'bút toán lệch Nợ ≠ Có (phải 0)', kieu: 'khong', can: { ledger_lines: ['tenant_id', 'entry_id', 'debit', 'credit'] },
    sql: `SELECT count(*)::text AS n FROM (SELECT 1 FROM ledger_lines GROUP BY tenant_id, entry_id HAVING sum(debit) <> sum(credit)) x`,
    chiTiet: `SELECT tenant_id::text AS tenant, entry_id::text AS entry, sum(debit)::text AS no, sum(credit)::text AS co FROM ledger_lines GROUP BY tenant_id, entry_id HAVING sum(debit) <> sum(credit) ORDER BY 1, 2 LIMIT 50` },
  { ma: 'L-3', nhom: 'L', bb: 'ketoan', ten: 'số phát sinh theo (đơn vị, tài khoản, tháng)', kieu: 'bang', can: { ledger_lines: ['tenant_id', 'account_code', 'posting_date', 'debit', 'credit'] },
    sql: `SELECT count(*)::text AS n, ${ROW_HASH(['t.tenant_id', 't.account_code', 't.m', 't.no', 't.co'])} AS h FROM (SELECT tenant_id, account_code, date_trunc('month', posting_date)::date AS m, sum(debit) AS no, sum(credit) AS co FROM ledger_lines GROUP BY 1, 2, 3) t`,
    chiTiet: `SELECT tenant_id::text AS tenant, account_code AS tk, to_char(date_trunc('month', posting_date), 'YYYY-MM') AS thang, sum(debit)::text AS no, sum(credit)::text AS co FROM ledger_lines GROUP BY 1, 2, 3 ORDER BY 1, 2, 3` },
  { ma: 'L-4', nhom: 'L', bb: 'ketoan', ten: 'số dư ngày khớp tính lại từ dòng sổ (phải 0 lệch)', kieu: 'khong',
    can: { ledger_balances_daily: ['tenant_id', 'branch_id', 'account_code', 'posting_date', 'partner_id', 'debit', 'credit'], ledger_lines: ['tenant_id', 'branch_id', 'account_code', 'posting_date', 'partner_id', 'debit', 'credit'] },
    sql: `WITH l AS (SELECT tenant_id, branch_id, account_code, posting_date, partner_id, sum(debit) d, sum(credit) c FROM ledger_lines GROUP BY 1, 2, 3, 4, 5)
          SELECT count(*)::text AS n FROM l FULL JOIN ledger_balances_daily b USING (tenant_id, branch_id, account_code, posting_date, partner_id)
          WHERE coalesce(l.d, 0) <> coalesce(b.debit, 0) OR coalesce(l.c, 0) <> coalesce(b.credit, 0)` },
  { ma: 'L-5', nhom: 'L', bb: 'ketoan', ten: 'băm nội dung bút toán (content_hash, body_hash)', kieu: 'bang', can: { ledger_entries: ['id', 'content_hash', 'body_hash'] },
    sql: hashOf('ledger_entries', ['t.id', 't.content_hash', 't.body_hash']), chiTiet: hashByTenant('ledger_entries', ['t.id', 't.content_hash', 't.body_hash']) },
  { ma: 'L-6', nhom: 'L', bb: 'ketoan', ten: 'bút toán đảo mồ côi (phải 0)', kieu: 'khong', can: { ledger_entries: ['id', 'is_reversal', 'reverses_entry_id'] },
    sql: `SELECT count(*)::text AS n FROM ledger_entries e WHERE e.is_reversal AND (e.reverses_entry_id IS NULL OR NOT EXISTS (SELECT 1 FROM ledger_entries r WHERE r.id = e.reverses_entry_id))` },
  dong('L-7.1', 'L', 'period_locks', 't.id', 'ketoan', 'khoá kỳ', ['id']),
  dong('L-7.2', 'L', 'period_lock_events', 't.id', 'ketoan', 'lịch sử khoá kỳ', ['id']),
  dong('L-8.1', 'L', 'ledger_entries', 't.id', 'ketoan', 'bút toán', ['id']),
  dong('L-8.2', 'L', 'ledger_lines', 't.id', 'ketoan', 'dòng sổ', ['id']),
  dong('L-8.3', 'L', 'ledger_links', 't.id', 'ketoan', 'liên kết bút toán', ['id']),
  dong('L-8.4', 'L', 'ledger_balances_daily', LEDGER_BAL_KEY, 'ketoan', 'số dư ngày', ['tenant_id', 'branch_id', 'account_code', 'posting_date', 'partner_id']),

  // ── D: chứng từ
  dong('D-1', 'D', 'accounting_events', 't.id', 'ketoan', 'sự việc kế toán', ['id']),
  dong('D-2', 'D', 'accounting_event_versions', 't.id', 'ketoan', 'lịch sử nộp sổ (payload từng phiên bản)', ['id']),
  { ma: 'D-3', nhom: 'D', bb: 'core', ten: 'đầu phiếu chung — CỘT CŨ (doc_ref, status_raw, status, version, total)', kieu: 'bang', can: { business_documents: ['doc_ref', 'status_raw', 'status', 'version', 'total'] },
    sql: hashOf('business_documents', ['t.tenant_id', 't.doc_ref', 't.status_raw', 't.status', 't.version', 't.total']),
    chiTiet: `SELECT tenant_id::text AS tenant, doc_type, status, count(*)::text AS n FROM business_documents GROUP BY 1, 2, 3 ORDER BY 1, 2, 3` },
  ...['document_versions', 'document_links', 'document_signatures', 'document_attachments', 'document_sequences'].map((b) => ({
    ma: `D-${b === 'document_attachments' ? '5' : b === 'document_sequences' ? '7' : '4'}.${b}`, nhom: 'D', bb: 'core', ten: `${b} (cả dòng)`, kieu: 'bang', can: { [b]: ['tenant_id'] }, sql: hashOf(b, ALL), chiTiet: hashByTenant(b, ALL),
  })),
  ...['purchase_documents', 'sales_lines', 'sales_payments', 'tax_invoices', 'tax_invoice_lines', 'inventory_movements', 'inventory_costs', 'debt_items', 'debt_allocations'].map((b) => dong(`D-6.${b}`, 'D', b, 't.id', 'ketoan', b, ['id'])),

  // ── M: Master Data (ADR-0001 — open-ketoan là chủ; bất biến MD-1…MD-4)
  dong('M-1', 'M', 'items', 't.item_id', 'ketoan', 'mặt hàng (item_id)', ['item_id', 'tenant_id']),
  { ma: 'M-1.ulid', nhom: 'M', bb: 'ketoan', ten: 'item_id không phải ULID (MD-1, phải 0)', kieu: 'khong', can: { items: ['item_id'] },
    sql: `SELECT count(*)::text AS n FROM items WHERE item_id !~ '^[0-9A-HJKMNP-TV-Z]{26}$'` },
  { ma: 'M-1.sku', nhom: 'M', bb: 'ketoan', ten: 'ánh xạ mã hàng → item_id (products.sku, item_id)', kieu: 'bang', can: { products: ['tenant_id', 'sku', 'item_id'] },
    sql: hashOf('products', ['t.tenant_id', 't.sku', 't.item_id']), chiTiet: hashByTenant('products', ['t.tenant_id', 't.sku', 't.item_id']) },
  dong('M-1.products', 'M', 'products', 't.id', 'ketoan', 'hồ sơ mã hàng', ['id']),
  dong('M-2', 'M', 'item_codes', 't.id', 'ketoan', 'lịch sử mã mặt hàng', ['id', 'tenant_id', 'item_id', 'kind', 'code', 'valid_from', 'valid_to']),
  { ma: 'M-2.chong', nhom: 'M', bb: 'ketoan', ten: 'mã mặt hàng có hai khoảng hiệu lực chồng nhau (MD-2, phải 0)', kieu: 'khong', can: { item_codes: ['id', 'tenant_id', 'kind', 'code', 'valid_from', 'valid_to'] },
    sql: `SELECT count(*)::text AS n FROM item_codes a JOIN item_codes b ON a.tenant_id = b.tenant_id AND a.kind = b.kind AND a.code = b.code AND a.id < b.id
          AND daterange(a.valid_from, a.valid_to, '[)') && daterange(b.valid_from, b.valid_to, '[)')` },
  { ma: 'M-2.tai', nhom: 'M', bb: 'ketoan', ten: 'mã đã cấp dùng lại cho mặt hàng khác (MD-2, phải 0)', kieu: 'khong', can: { item_codes: ['tenant_id', 'kind', 'code', 'item_id'] },
    sql: `SELECT count(*)::text AS n FROM (SELECT 1 FROM item_codes GROUP BY tenant_id, kind, code HAVING count(DISTINCT item_id) > 1) x`,
    chiTiet: `SELECT tenant_id::text AS tenant, kind, code, string_agg(DISTINCT item_id, ', ') AS item_ids FROM item_codes GROUP BY 1, 2, 3 HAVING count(DISTINCT item_id) > 1 ORDER BY 1, 2, 3 LIMIT 50` },
  dong('M-2.entity_codes', 'M', 'entity_codes', 't.id', 'ketoan', 'lịch sử mã đối tượng / chi nhánh / kho', ['id', 'tenant_id', 'entity_type', 'kind', 'code', 'valid_from', 'valid_to']),
  { ma: 'M-2.entity_chong', nhom: 'M', bb: 'ketoan', ten: 'mã đối tượng / chi nhánh / kho có khoảng hiệu lực chồng nhau (MD-2, phải 0)', kieu: 'khong', can: { entity_codes: ['id', 'tenant_id', 'entity_type', 'kind', 'code', 'valid_from', 'valid_to'] },
    sql: `SELECT count(*)::text AS n FROM entity_codes a JOIN entity_codes b ON a.tenant_id = b.tenant_id AND a.entity_type = b.entity_type AND a.kind = b.kind AND a.code = b.code AND a.id < b.id
          AND daterange(a.valid_from, a.valid_to, '[)') && daterange(b.valid_from, b.valid_to, '[)')` },
  dong('M-3', 'M', 'product_units', 't.id', 'ketoan', 'đơn vị tính + tỷ lệ quy đổi', ['id', 'tenant_id', 'sku', 'unit', 'ratio']),
  { ma: 'M-3.goc', nhom: 'M', bb: 'ketoan', ten: 'mặt hàng có hơn một đơn vị tỷ lệ 1 (MD-3, phải 0)', kieu: 'khong', can: { product_units: ['tenant_id', 'sku', 'ratio'] },
    sql: `SELECT count(*)::text AS n FROM (SELECT 1 FROM product_units GROUP BY tenant_id, sku HAVING count(*) FILTER (WHERE ratio = 1) > 1) x` },
  { ma: 'M-3.ty_le', nhom: 'M', bb: 'ketoan', ten: 'tỷ lệ quy đổi ≤ 0 hoặc trống (MD-3, phải 0)', kieu: 'khong', can: { product_units: ['ratio'] },
    sql: `SELECT count(*)::text AS n FROM product_units WHERE ratio IS NULL OR ratio <= 0` },
  dong('M-3.unit_names', 'M', 'unit_names', 't.id', 'ketoan', 'tên đơn vị tính', ['id']),
  dong('M-4', 'M', 'warehouses', 't.id', 'ketoan', 'kho', ['id', 'tenant_id', 'branch_id', 'type_code']),
  dong('M-4.branches', 'M', 'branches', 't.id', 'ketoan', 'cây đơn vị / chi nhánh', ['id', 'tenant_id', 'parent_id']),
  dong('M-4.warehouse_types', 'M', 'warehouse_types', 't.id', 'ketoan', 'loại kho (phân kho)', ['id', 'tenant_id', 'code']),
  dong('M-4.warehouse_type_ops', 'M', 'warehouse_type_ops', `concat_ws('|', t.tenant_id, t.op)`, 'ketoan', 'nghiệp vụ theo loại kho', ['tenant_id', 'op']),
  { ma: 'M-4.mo_coi', nhom: 'M', bb: 'ketoan', ten: 'kho trỏ tới chi nhánh không có (MD-4, phải 0)', kieu: 'khong', can: { warehouses: ['tenant_id', 'branch_id'], branches: ['id', 'tenant_id'] },
    sql: `SELECT count(*)::text AS n FROM warehouses w WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = w.branch_id AND b.tenant_id = w.tenant_id)` },
  { ma: 'M-4.vong', nhom: 'M', bb: 'ketoan', ten: 'cây đơn vị có vòng (MD-4, phải 0)', kieu: 'khong', can: { branches: ['id', 'tenant_id', 'parent_id'] },
    sql: `WITH RECURSIVE r(id, tenant_id, parent_id, path, cyc) AS (
            SELECT id, tenant_id, parent_id, ARRAY[id], false FROM branches
            UNION ALL
            SELECT r.id, r.tenant_id, b.parent_id, r.path || b.id, b.id = ANY(r.path) FROM r JOIN branches b ON b.id = r.parent_id AND b.tenant_id = r.tenant_id WHERE NOT r.cyc)
          SELECT count(DISTINCT id)::text AS n FROM r WHERE cyc` },
  { ma: 'M-4.loai', nhom: 'M', bb: 'ketoan', ten: 'kho mang loại kho (phân kho) không có trong danh mục loại kho (MD-4, phải 0)', kieu: 'khong', can: { warehouses: ['tenant_id', 'type_code'], warehouse_types: ['tenant_id', 'code'] },
    sql: `SELECT count(*)::text AS n FROM warehouses w WHERE coalesce(w.type_code, '') <> '' AND NOT EXISTS (SELECT 1 FROM warehouse_types k WHERE k.tenant_id = w.tenant_id AND k.code = w.type_code)` },
  dong('M-5.item_classes', 'M', 'item_classes', 't.id', 'ketoan', 'nhóm hàng (Ngành → Nhãn → Nhóm)', ['id']),
  dong('M-5.item_classification', 'M', 'item_classification', 't.id', 'ketoan', 'phân loại hạch toán theo ngày', ['id']),
  dong('M-5.partners', 'M', 'partners', 't.id', 'ketoan', 'đối tượng', ['id']),
  dong('M-5.entity_attributes', 'M', 'entity_attributes', 't.id', 'ketoan', 'thuộc tính có phiên bản của đối tượng', ['id']),

  // ── R: kết quả báo cáo dựng lại bằng SQL (cùng nguồn với báo cáo của kế toán — so hành vi báo cáo qua API: tools/dien-tap/do-api.mjs)
  { ma: 'R-1', nhom: 'R', bb: 'ketoan', ten: 'bảng cân đối số phát sinh theo năm (phát sinh + dư cuối luỹ kế)', kieu: 'bang', can: { ledger_lines: ['tenant_id', 'account_code', 'posting_date', 'debit', 'credit'] },
    sql: hashQuery(`SELECT tenant_id, account_code, y, d, c, sum(d - c) OVER (PARTITION BY tenant_id, account_code ORDER BY y) AS du FROM
            (SELECT tenant_id, account_code, extract(year FROM posting_date)::int AS y, sum(debit) d, sum(credit) c FROM ledger_lines GROUP BY 1, 2, 3) x`, ['tenant_id', 'account_code', 'y', 'd', 'c', 'du']),
    chiTiet: `SELECT tenant_id::text AS tenant, account_code AS tk, extract(year FROM posting_date)::int AS nam, sum(debit)::text AS no, sum(credit)::text AS co FROM ledger_lines GROUP BY 1, 2, 3 ORDER BY 1, 2, 3` },
  { ma: 'R-2', nhom: 'R', bb: 'ketoan', ten: 'số dư công nợ theo (tài khoản, đối tượng)', kieu: 'bang', can: { ledger_lines: ['tenant_id', 'account_code', 'partner_id', 'debit', 'credit'] },
    sql: hashQuery(`SELECT tenant_id, account_code, partner_id, sum(debit - credit) AS du FROM ledger_lines WHERE partner_id IS NOT NULL GROUP BY 1, 2, 3`, ['tenant_id', 'account_code', 'partner_id', 'du']) },
  { ma: 'R-3', nhom: 'R', bb: 'ketoan', ten: 'nhập / xuất kho theo (kho, mặt hàng, loại)', kieu: 'bang', can: { inventory_movements: ['tenant_id', 'warehouse_code', 'item_id', 'sku', 'kind', 'qty', 'amount'] },
    sql: hashQuery(`SELECT tenant_id, warehouse_code, coalesce(item_id, sku) AS k, kind, sum(qty) AS q, sum(coalesce(amount, 0)) AS a FROM inventory_movements GROUP BY 1, 2, 3, 4`, ['tenant_id', 'warehouse_code', 'k', 'kind', 'q', 'a']) },
  { ma: 'R-4', nhom: 'R', bb: 'ketoan', ten: 'bảng kê thuế GTGT theo (chiều, tháng, mã thuế, trạng thái)', kieu: 'bang',
    can: { tax_invoices: ['id', 'tenant_id', 'direction', 'invoice_date', 'status', 'sign'], tax_invoice_lines: ['tax_invoice_id', 'tax_code', 'amount_before_tax', 'tax_amount'] },
    sql: hashQuery(`SELECT i.tenant_id, i.direction, date_trunc('month', i.invoice_date)::date AS m, l.tax_code, i.status, sum(l.amount_before_tax * i.sign) AS tien, sum(l.tax_amount * i.sign) AS thue
            FROM tax_invoices i JOIN tax_invoice_lines l ON l.tax_invoice_id = i.id GROUP BY 1, 2, 3, 4, 5`, ['tenant_id', 'direction', 'm', 'tax_code', 'status', 'tien', 'thue']) },

  // ── H: lịch sử, bằng chứng, quyền, cài đặt
  { ma: 'H-1.so', nhom: 'H', bb: 'core', ten: 'số dòng nhật ký bằng chứng', kieu: 'bang', can: { audit_logs: ['id', 'hash'] }, sql: hashOf('audit_logs', ['t.id', 't.hash']) },
  { ma: 'H-1.chuoi', nhom: 'H', bb: 'core', ten: 'chuỗi băm nhật ký đứt (phải 0) — cùng phép kiểm EVIDENCE_CHAIN của lane chẩn đoán', kieu: 'khong', can: { audit_logs: ['chain_seq', 'prev_hash', 'hash'] },
    sql: `WITH c AS (SELECT id, chain_seq, lag(hash) OVER w AS lag_hash, lag(chain_seq) OVER w AS lag_seq FROM audit_logs WHERE chain_seq IS NOT NULL WINDOW w AS (PARTITION BY tenant_id ORDER BY chain_seq))
          SELECT count(*)::text AS n FROM c JOIN audit_logs a ON a.id = c.id
          WHERE a.hash IS DISTINCT FROM audit_log_hash(a) OR a.prev_hash IS DISTINCT FROM c.lag_hash OR c.chain_seq <> coalesce(c.lag_seq, 0) + 1`,
    chiTiet: `WITH c AS (SELECT id, tenant_id, chain_seq, lag(hash) OVER w AS lag_hash, lag(chain_seq) OVER w AS lag_seq FROM audit_logs WHERE chain_seq IS NOT NULL WINDOW w AS (PARTITION BY tenant_id ORDER BY chain_seq))
          SELECT c.tenant_id::text AS tenant, c.chain_seq::text AS seq, a.id::text AS id FROM c JOIN audit_logs a ON a.id = c.id
          WHERE a.hash IS DISTINCT FROM audit_log_hash(a) OR a.prev_hash IS DISTINCT FROM c.lag_hash OR c.chain_seq <> coalesce(c.lag_seq, 0) + 1 ORDER BY 1, 2 LIMIT 50` },
  { ma: 'H-2', nhom: 'H', bb: 'core', ten: 'việc giao sự kiện theo trạng thái', kieu: 'bang', can: { event_deliveries: ['status'] },
    sql: `SELECT count(*)::text AS n, coalesce(md5(string_agg(status || ':' || c::text, ',' ORDER BY status)), '') AS h FROM (SELECT status, count(*) c FROM event_deliveries GROUP BY status) x` },
  { ma: 'H-2.outbox', nhom: 'H', bb: 'core', ten: 'số sự kiện outbox', kieu: 'bang', can: { event_outbox: ['id'] }, sql: hashOf('event_outbox', ['t.id']) },
  ...['users', 'tenant_roles', 'tenant_role_rules', 'user_role_assignments'].map((b) => ({ ma: `H-3.${b}`, nhom: 'H', bb: 'core', ten: `${b} (cả dòng)`, kieu: 'bang', can: { [b]: [] }, sql: hashOf(b, ALL) })),
  { ma: 'H-5.setting_values', nhom: 'H', bb: 'core', ten: 'cài đặt (cả dòng)', kieu: 'bang', can: { setting_values: [] }, sql: hashOf('setting_values', ALL) },
  { ma: 'H-5.tenant_secrets', nhom: 'H', bb: 'core', ten: 'bí mật — bản mã (không giải mã)', kieu: 'bang', can: { tenant_secrets: [] }, sql: hashOf('tenant_secrets', ALL) },

  // ── S: lược đồ (đổi là bình thường khi nâng cấp — chỉ so ở --chat: chạy lại migration, khôi phục bản sao lưu)
  { ma: 'S-1', nhom: 'S', bb: 'core', ten: 'vân lược đồ public (cột, ràng buộc, chỉ mục, trigger, hàm, khung nhìn)', kieu: 'luoc', can: {},
    sql: `SELECT count(*)::text AS n, md5(string_agg(x, E'\\n' ORDER BY x)) AS h FROM (
            SELECT 'c:' || table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') AS x FROM information_schema.columns WHERE table_schema = 'public'
            UNION ALL SELECT 'k:' || conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace = 'public'::regnamespace
            UNION ALL SELECT 'i:' || indexname || ':' || indexdef FROM pg_indexes WHERE schemaname = 'public'
            UNION ALL SELECT 't:' || tgrelid::regclass::text || '.' || tgname || ':' || pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
            UNION ALL SELECT 'f:' || proname || '(' || pg_get_function_identity_arguments(oid) || '):' || md5(prosrc) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
            UNION ALL SELECT 'v:' || viewname || ':' || md5(definition) FROM pg_views WHERE schemaname = 'public') s`,
    chiTiet: `SELECT table_name AS bang, count(*)::text AS cot FROM information_schema.columns WHERE table_schema = 'public' GROUP BY 1 ORDER BY 1` },
  { ma: 'S-2', nhom: 'S', bb: 'core', ten: 'sổ migration đã chạy (tên, module, nguồn — không tính giờ chạy)', kieu: 'luoc', can: { schema_migrations: ['name'] }, sql: hashOf('schema_migrations', ['t.name', 't.module', 't.source']),
    chiTiet: `SELECT * FROM schema_migrations ORDER BY 1` },

  // ── W: chỉ sau nâng cấp (danh sách trắng §3.4) — phải 0
  { ma: 'W-1', nhom: 'W', bb: 'core', ten: 'cột mới 0005 của đầu phiếu đều là mặc định (VND, tỷ giá 1, không nguyên tệ, chưa gắn nút, chưa lưu trữ)', kieu: 'sau',
    can: { business_documents: ['currency', 'fx_rate', 'total_fc', 'org_unit_code', 'archived_at'] },
    sql: `SELECT count(*)::text AS n FROM business_documents WHERE currency <> 'VND' OR fx_rate <> 1 OR total_fc IS NOT NULL OR org_unit_code <> '' OR archived_at IS NOT NULL` },
  { ma: 'W-2', nhom: 'W', bb: 'core', ten: 'bảng mới document_activities rỗng (lịch sử cũ không bịa ra)', kieu: 'sau', can: { document_activities: ['id'] }, sql: `SELECT count(*)::text AS n FROM document_activities` },
  { ma: 'W-3', nhom: 'W', bb: 'core', ten: 'không đầu phiếu nào vi phạm khuôn loại chứng từ (cũ lẫn mới)', kieu: 'sau', can: { business_documents: ['doc_type'] },
    sql: `SELECT count(*)::text AS n FROM business_documents WHERE doc_type !~ '^[a-z][a-z0-9_-]*\\.[a-z][a-z0-9_-]*$'` },
  // [2026-11-29 12:39 AM Johnny Chu - Chu Hoàng Anh] S004-W1-3b — bảng cơ chế 0007 (lane T, S004-DM-2/3; LANES §6): nâng cấp không được tự sinh ánh xạ / tự gán chủ dữ liệu
  { ma: 'W-4', nhom: 'W', bb: 'core', ten: 'bảng mới entity_links rỗng (nâng cấp không bịa ánh xạ ID)', kieu: 'sau', can: { entity_links: ['tenant_id'] }, sql: `SELECT count(*)::text AS n FROM entity_links` },
  { ma: 'W-5', nhom: 'W', bb: 'core', ten: 'bảng mới data_authority rỗng (chủ dữ liệu chỉ ghi khi app khai trục)', kieu: 'sau', can: { data_authority: ['tenant_id', 'axis'] }, sql: `SELECT count(*)::text AS n FROM data_authority` },
];

async function coCot(client) {
  const r = await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`);
  const m = new Map();
  for (const x of r.rows) { if (!m.has(x.table_name)) m.set(x.table_name, new Set()); m.get(x.table_name).add(x.column_name); }
  return m;
}
const batBuoc = (m, hoSo) => (HO_SO[hoSo] ?? []).includes(m.bb);
function tinhTrang(muc, cols, hoSo) {
  for (const [b, cs] of Object.entries(muc.can)) {
    const bb = batBuoc(muc, hoSo);
    if (!cols.has(b)) return { tt: bb ? 'thieu-bat-buoc' : 'khong-ap-dung', ly_do: `không có bảng ${b}` };
    const thieu = cs.filter((c) => !cols.get(b).has(c));
    if (thieu.length) return { tt: bb ? 'thieu-bat-buoc' : 'thieu-cot', ly_do: `${b} thiếu cột ${thieu.join(', ')}` };
  }
  return { tt: 'do' };
}
const sumH = (hs) => (hs.reduce((a, h) => a + BigInt(h), 0n)).toString();

/** Đo mọi mục (giao dịch READ ONLY). opts.hoSo: 'open-ketoan' (mặc định) | 'core'. opts.dong: thư mục ghi tệp dòng (khoá ⇥ md5) cho mục "dòng". */
export async function doBatBien(client, meta = {}, opts = {}) {
  const hoSo = opts.hoSo ?? meta.ho_so ?? 'open-ketoan';
  if (!HO_SO[hoSo]) throw new Error(`hồ sơ "${hoSo}" không có (${Object.keys(HO_SO).join(' | ')})`);
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const cols = await coCot(client);
    const ketQua = {};
    for (const m of MUC) {
      const base = { nhom: m.nhom, ten: m.ten, kieu: m.kieu, bat_buoc: batBuoc(m, hoSo) };
      const s = tinhTrang(m, cols, hoSo);
      if (s.tt !== 'do') { ketQua[m.ma] = { ...base, ...s }; continue; }
      await client.query('SAVEPOINT muc'); // một câu lỗi không làm hỏng mục sau
      try {
        if (m.dong) {
          const rows = (await client.query(m.sql)).rows;
          const o = Object.fromEntries(rows.sort((a, b) => a.o - b.o).map((r) => [String(r.o), `${r.n}:${r.h}`]));
          ketQua[m.ma] = { ...base, tt: 'do', n: String(rows.reduce((a, r) => a + Number(r.n), 0)), h: sumH(rows.map((r) => r.h)), o };
          if (opts.dong) {
            mkdirSync(opts.dong, { recursive: true });
            const d = (await client.query(`SELECT (${m.dong.khoa})::text AS k, md5(t::text) AS h FROM ${m.dong.bang} t ORDER BY 1`)).rows;
            writeFileSync(path.join(opts.dong, `${m.ma}.tsv`), d.map((r) => `${r.k}\t${r.h}`).join('\n') + (d.length ? '\n' : ''));
          }
        } else {
          const r = (await client.query(m.sql)).rows[0];
          ketQua[m.ma] = { ...base, tt: 'do', n: r.n, ...(r.h !== undefined ? { h: r.h } : {}) };
        }
        await client.query('RELEASE SAVEPOINT muc');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT muc');
        ketQua[m.ma] = { ...base, tt: 'loi', ly_do: String(e.message).slice(0, 200) };
      }
    }
    const v = (await client.query(`SELECT current_database() AS db, version() AS pg, now() AS luc`)).rows[0];
    return { contract: CONTRACT, ho_so: hoSo, luc: new Date(v.luc).toISOString(), csdl: v.db, postgres: String(v.pg).split(' ').slice(0, 2).join(' '), ...meta, ket_qua: ketQua };
  } finally { await client.query('ROLLBACK'); }
}

/** Mục bắt buộc chưa đo được (thiếu bảng / cột / câu lỗi) của một lần đo. */
export const thieuBatBuoc = (kq) => Object.entries(kq.ket_qua).filter(([, v]) => v.bat_buoc && v.tt !== 'do' && !(v.kieu === 'sau' && v.tt === 'thieu-bat-buoc' && kq.truoc_nang_cap));

const docDong = (dir, ma) => {
  const f = path.join(dir, `${ma}.tsv`);
  if (!existsSync(f)) return null;
  return new Map(readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { const i = l.lastIndexOf('\t'); return [l.slice(0, i), l.slice(i + 1)]; }));
};
/** Khoá dòng lệch giữa hai tệp dòng: thêm / mất / đổi (tối đa 10 mỗi loại). */
function dongLech(da, db) {
  const them = [], mat = [], doi = [];
  for (const [k, h] of db) { if (!da.has(k)) them.push(k); else if (da.get(k) !== h) doi.push(k); }
  for (const k of da.keys()) if (!db.has(k)) mat.push(k);
  const fmt = (n, xs) => (xs.length ? `${n} ${xs.length} (${xs.slice(0, 10).join(', ')}${xs.length > 10 ? ', …' : ''})` : null);
  return [fmt('đổi', doi), fmt('thêm', them), fmt('mất', mat)].filter(Boolean).join(' · ');
}
function oLech(x, y) {
  if (!x.o || !y.o) return '';
  const ks = new Set([...Object.keys(x.o), ...Object.keys(y.o)]);
  const d = [...ks].filter((k) => x.o[k] !== y.o[k]).map(Number).sort((a, b) => a - b);
  return d.length ? ` · ô lệch ${d.length}: ${d.slice(0, 12).join(', ')}${d.length > 12 ? ', …' : ''} (xem --chi-tiet <mã> --o <ô>)` : '';
}

/**
 * So hai lần đo (A trước, B sau). opts.chat: mọi mục (kể cả S, W) phải GIỐNG HỆT — dùng cho chạy lại migration / khôi phục bản sao lưu.
 * opts.dongTruoc / dongSau: thư mục tệp dòng ⇒ chỉ ra khoá dòng lệch. Trả { dat, lech[], ghi_chu[] }.
 */
export function soSanh(a, b, opts = {}) {
  const lech = []; const ghiChu = [];
  if (a.contract !== b.contract) lech.push({ ma: '—', ly_do: `hai lần đo khác hợp đồng (${a.contract} / ${b.contract}) — đo lại bằng cùng bản bộ đo` });
  if ((a.ho_so ?? 'open-ketoan') !== (b.ho_so ?? 'open-ketoan')) lech.push({ ma: '—', ly_do: `hai lần đo khác hồ sơ (${a.ho_so} / ${b.ho_so})` });
  for (const m of MUC) {
    const x = a.ket_qua[m.ma], y = b.ket_qua[m.ma];
    if (!x || !y) { lech.push({ ma: m.ma, ly_do: 'thiếu mục trong một lần đo (khác phiên bản bộ đo?)' }); continue; }
    const them = (ly) => { const d = m.dong && opts.dongTruoc && opts.dongSau ? (() => { const da = docDong(opts.dongTruoc, m.ma), db = docDong(opts.dongSau, m.ma); return da && db ? dongLech(da, db) : ''; })() : ''; lech.push({ ma: m.ma, ten: m.ten, ly_do: ly + oLech(x, y) + (d ? ` · dòng: ${d}` : '') }); };
    if (opts.chat) {
      if (x.tt !== y.tt || x.n !== y.n || x.h !== y.h) them(`không giống hệt: trước ${x.tt}${x.n !== undefined ? ` n=${x.n}` : ''}${x.h !== undefined ? ` h=${x.h}` : ''} · sau ${y.tt}${y.n !== undefined ? ` n=${y.n}` : ''}${y.h !== undefined ? ` h=${y.h}` : ''}${y.ly_do ? ` (${y.ly_do})` : ''}`);
      continue;
    }
    if (m.kieu === 'luoc') { if (x.tt === 'do' && y.tt === 'do' && (x.n !== y.n || x.h !== y.h)) ghiChu.push(`${m.ma}: lược đồ / sổ migration đổi (bình thường khi nâng cấp; so ở --chat khi chạy lại / khôi phục)`); if (y.tt !== 'do' && y.bat_buoc) them(`sau nâng cấp không đo được: ${y.ly_do}`); continue; }
    if (m.kieu === 'sau') {
      if (y.tt !== 'do') { if (y.bat_buoc) them(`sau nâng cấp không đo được: ${y.ly_do ?? y.tt} — migration lõi chưa chạy đủ?`); else ghiChu.push(`${m.ma}: không áp dụng (${y.ly_do})`); }
      else if (y.n !== '0') them(`sau nâng cấp còn ${y.n} dòng vi phạm`);
      continue;
    }
    if (y.tt === 'loi' || x.tt === 'loi') { them(`không đo được: ${(y.tt === 'loi' ? y : x).ly_do}`); continue; }
    if (x.tt === 'thieu-bat-buoc' || y.tt === 'thieu-bat-buoc') { them(`MỤC BẮT BUỘC không đo được (${(x.tt === 'thieu-bat-buoc' ? x : y).ly_do}) — không bỏ qua vì thiếu bảng / cột`); continue; }
    if (y.tt === 'thieu-cot' || (x.tt === 'do' && y.tt !== 'do')) { them(`sau nâng cấp: ${y.ly_do ?? y.tt}`); continue; }
    if (x.tt !== 'do' && y.tt !== 'do') { ghiChu.push(`${m.ma}: không áp dụng (${y.ly_do})`); continue; }
    if (x.tt !== 'do' && y.tt === 'do') { them(`trước nâng cấp ${x.ly_do} nhưng sau lại có — bảng sổ / chứng từ không được sinh ra do nâng cấp`); continue; }
    if (m.kieu === 'khong') {
      // phải 0; dữ liệu thật đã sai từ trước (mốc) thì sau nâng cấp phải GIỮ ĐÚNG số đó — tăng hay giảm đều là nâng cấp đã chạm dữ liệu
      if (y.n !== '0' && y.n !== x.n) them(`trước ${x.n} · sau ${y.n} chỗ sai`);
      else if (y.n === '0' && x.n !== '0') them(`trước ${x.n} chỗ sai, sau 0 — nâng cấp không được tự sửa dữ liệu`);
      if (x.n !== '0') ghiChu.push(`${m.ma}: TRƯỚC nâng cấp đã có ${x.n} chỗ sai — mốc của dữ liệu thật, ghi biên bản, không sửa trong diễn tập`);
      continue;
    }
    if (x.n !== y.n || x.h !== y.h) them(`trước n=${x.n}${x.h !== undefined ? ` h=${x.h}` : ''} · sau n=${y.n}${y.h !== undefined ? ` h=${y.h}` : ''}`);
  }
  return { dat: lech.length === 0, lech, ghi_chu: ghiChu };
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--so')) {
    const [fa, fb] = args.slice(args.indexOf('--so') + 1);
    const a = JSON.parse(readFileSync(fa, 'utf8')), b = JSON.parse(readFileSync(fb, 'utf8'));
    const r = soSanh(a, b, { chat: args.includes('--chat'), dongTruoc: val('--dong-truoc'), dongSau: val('--dong-sau') });
    for (const g of r.ghi_chu) console.log(`  · ${g}`);
    for (const l of r.lech) console.log(`  ✗ ${l.ma} ${l.ten ?? ''}: ${l.ly_do}`);
    console.log(r.dat ? `ĐẠT${args.includes('--chat') ? ' (giống hệt)' : ''}: ${Object.keys(b.ket_qua).length} mục — lệch = 0` : `KHÔNG ĐẠT: ${r.lech.length} mục lệch — dừng, không đổi nguồn (PHASE-004 · 20 §5)`);
    process.exit(r.dat ? 0 : 1);
  }
  const db = val('--db');
  if (!db) { console.error('Dùng: --db <url> [--ho-so open-ketoan|core] [--out tệp.json] [--dong thư-mục] | --db <url> --chi-tiet <mã> [--o <ô>] | --so a.json b.json [--chat] [--dong-truoc d1 --dong-sau d2]'); process.exit(2); }
  const client = new pg.Client({ connectionString: db }); await client.connect();
  try {
    const ma = val('--chi-tiet');
    if (ma) {
      const m = MUC.find((x) => x.ma === ma);
      if (!m) { console.error(`Không có mục ${ma}. Mục: ${MUC.map((x) => x.ma).join(' ')}`); process.exit(2); }
      const o = val('--o');
      if (o !== undefined && !m.chiTietO) { console.error(`${ma} không chia ô`); process.exit(2); }
      await client.query('BEGIN READ ONLY');
      const rows = (await client.query(o !== undefined ? m.chiTietO(o) : (m.chiTiet ?? m.sql))).rows; await client.query('ROLLBACK');
      console.table(rows);
      return;
    }
    const kq = await doBatBien(client, { nhan: val('--nhan') ?? '', ...(args.includes('--truoc-nang-cap') ? { truoc_nang_cap: true } : {}) }, { hoSo: val('--ho-so'), dong: val('--dong') });
    const out = val('--out');
    if (out) { writeFileSync(out, JSON.stringify(kq, null, 2) + '\n'); console.log(`Đã ghi ${out}: ${Object.keys(kq.ket_qua).length} mục (hồ sơ ${kq.ho_so}).`); }
    else console.log(JSON.stringify(kq, null, 2));
    for (const [k, v] of Object.entries(kq.ket_qua).filter(([, v]) => (v.kieu === 'khong' || v.kieu === 'sau') && v.tt === 'do' && v.n !== '0')) console.log(`  ! ${k} ${v.ten}: ${v.n}`);
    const thieu = thieuBatBuoc(kq);
    if (thieu.length) {
      for (const [k, v] of thieu) console.error(`  ✗ ${k} ${v.ten}: ${v.ly_do ?? v.tt}`);
      console.error(`THIẾU ${thieu.length} mục bắt buộc (hồ sơ ${kq.ho_so}) — không bỏ qua; kiểm CSDL có đúng là bản sao của ${kq.ho_so === 'core' ? 'lõi' : 'open-ketoan'} không`);
      process.exitCode = 1;
    }
  } finally { await client.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
