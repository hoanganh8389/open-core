#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 09:37 PM Johnny Chu - Chu Hoàng Anh] S004-W2-1 (PHASE-004 W2, R-CORE-8) — kiểm ranh giới Core: mã lõi KHÔNG chứa nghiệp vụ kế toán.
// Đo theo từng (tệp, luật) rồi so với sổ nợ docs/scoreboard/ranh-gioi.json: số vi phạm chỉ được GIẢM (như no-chuan của open-platform).
//   node tools/kiem-ranh-gioi.mjs            in số đo + so với sổ nợ (không chặn — chế độ đo, tới S004-W2-6)
//   node tools/kiem-ranh-gioi.mjs --check    TĂNG so với sổ nợ (hoặc tệp / luật mới) ⇒ thoát 1; giảm ⇒ nhắc cập nhật sổ (--ghi)
//   node tools/kiem-ranh-gioi.mjs --strict   MỌI vi phạm ⇒ thoát 1 (S004-W2-6: sổ nợ phải rỗng)
//   node tools/kiem-ranh-gioi.mjs --ghi      ghi số đo hiện tại làm sổ nợ (chỉ khi KHÔNG tăng, trừ khi thêm --cho-phep-tang)
// Chú thích dòng / khối được bỏ trước khi đếm (chữ "kế toán" trong chú thích không phải vi phạm).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const NO = path.join(root, 'docs/scoreboard/ranh-gioi.json');
const args = new Set(process.argv.slice(2));

// Bảng nghiệp vụ của kế toán (đo theo tên đã trích dẫn / khoá kiểu / SQL — không đếm chữ thường trong văn xuôi).
const TABLES = ['ledger_entries', 'ledger_lines', 'ledger_links', 'ledger_balances_daily', 'accounting_events', 'accounting_event_versions', 'accounting_profiles', 'accounting_units',
  'inventory_movements', 'inventory_movements_cur', 'inventory_costs', 'stock_levels', 'stock_sku_settings', 'stock_max_requests', 'stock_purposes',
  'tax_codes', 'tax_invoices', 'tax_invoice_lines', 'tax_id_versions', 'tax_info_patches', 'taxpayer_profiles', 'debt_items', 'debt_allocations',
  'purchase_documents', 'purchase_policies', 'sales_lines', 'sales_payments', 'warehouses', 'warehouse_types', 'warehouse_type_ops',
  'items', 'item_codes', 'item_classification', 'item_classes', 'partners', 'partner_groups', 'period_locks', 'period_lock_events', 'cost_norms',
  'voucher_templates', 'voucher_recurrences', 'voucher_recurrence_runs'];
const tableRe = new RegExp(`(?:['"\`]|\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+|^\\s{2}|\\bselectFrom\\()(?:${TABLES.join('|')})(?:['"\`]|\\s*:\\s*\\w+Table\\b|\\s|$)`, 'gm');

/** Luật → hàm đếm trên mã đã bỏ chú thích. id ổn định (ghi vào sổ nợ). */
const RULES = {
  'R-BANG': { label: 'tên bảng kế toán trong mã lõi', count: (s) => (s.match(tableRe) ?? []).length },
  'R-IMPORT': { label: 'import @ketoan/* hoặc đường dẫn của app', count: (s) => (s.match(/from\s+['"](?:@ketoan|@open-ketoan|@cake|@open-cake)\//g) ?? []).length },
  'R-SO': { label: 'cổng sổ cứng (ctx.ledger / registerLedger*)', count: (s) => (s.match(/\bctx\.ledger\b|\bregisterLedger[A-Z]\w*\b|\bLedgerQuery\b|\bIngestResult\b/g) ?? []).length },
  'R-VAI': { label: 'vai / vai ký / quyền kế toán cứng', count: (s) => (s.match(/\b(?:chief_accountant|cashier|ketoan_truong)\b|['"](?:ledger|catalog|payments|invoices|inventory):[a-z-]+['"]/g) ?? []).length },
  'R-THANG': { label: 'bậc cài đặt kế toán cứng (accounting_unit)', count: (s) => (s.match(/\baccounting_unit(?:_id)?\b/g) ?? []).length },
  'R-ENV': { label: 'cấu hình sổ cứng (BOOK_MODE)', count: (s) => (s.match(/\bBOOK_MODE\b/g) ?? []).length },
};

function stripComments(src) {
  let out = ''; let i = 0; const n = src.length; let q = null;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (q) { out += c; if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    out += c; i++;
  }
  return out;
}
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (['node_modules', 'dist', 'test'].includes(n)) continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx|mjs|js)$/.test(n)) out.push(p);
  }
  return out;
}

const measured = {}; // { 'packages/platform/src/db/types.ts': { 'R-BANG': 51, … } }
const pkgRoot = path.join(root, 'packages');
for (const pkg of readdirSync(pkgRoot)) {
  const src = path.join(pkgRoot, pkg, 'src');
  if (!existsSync(src)) continue;
  for (const f of walk(src)) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const [id, r] of Object.entries(RULES)) {
      const k = r.count(code);
      if (k) (measured[rel] ??= {})[id] = k;
    }
    if (/-ketoan-/.test(path.basename(f))) (measured[rel] ??= {})['R-TEP'] = 1; // tệp chuyển tiếp *-ketoan-* (xoá sau B4, S004-W2-7)
  }
}
RULES['R-TEP'] = { label: 'tệp chuyển tiếp *-ketoan-* (xoá sau B4)' };

const debt = existsSync(NO) ? JSON.parse(readFileSync(NO, 'utf8')) : { files: {} };
const base = debt.files ?? {};
const total = (m) => Object.values(m).reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0);
const up = [], down = [];
for (const f of new Set([...Object.keys(measured), ...Object.keys(base)])) {
  for (const id of new Set([...Object.keys(measured[f] ?? {}), ...Object.keys(base[f] ?? {})])) {
    const now = measured[f]?.[id] ?? 0, was = base[f]?.[id] ?? 0;
    if (now > was) up.push({ f, id, was, now }); else if (now < was) down.push({ f, id, was, now });
  }
}

if (args.has('--ghi')) {
  if (up.length && !args.has('--cho-phep-tang')) { console.error('Từ chối ghi: số vi phạm TĂNG — sổ nợ chỉ được giảm:\n' + up.map((x) => `  ${x.f} ${x.id}: ${x.was} → ${x.now}`).join('\n')); process.exit(1); }
  const files = Object.fromEntries(Object.entries(measured).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(NO, JSON.stringify({
    $comment: '[2026-11-28 09:37 PM Johnny Chu - Chu Hoàng Anh] S004-W2-1 — sổ nợ ranh giới Core (R-CORE-8, PHASE-004 · 30): số vi phạm mỗi (tệp, luật) còn lại; CHỈ ĐƯỢC GIẢM. Sinh bằng node tools/kiem-ranh-gioi.mjs --ghi. S004-W2-6: sổ rỗng + chạy --strict.',
    rules: Object.fromEntries(Object.entries(RULES).map(([k, v]) => [k, v.label])),
    total: total(measured), files,
  }, null, 2) + '\n');
  console.log(`Đã ghi ${path.relative(root, NO)} — tổng ${total(measured)} vi phạm ở ${Object.keys(files).length} tệp.`);
  process.exit(0);
}

const byRule = {};
for (const r of Object.values(measured)) for (const [id, k] of Object.entries(r)) byRule[id] = (byRule[id] ?? 0) + k;
console.log(`Ranh giới Core (R-CORE-8): ${total(measured)} vi phạm · ${Object.keys(measured).length} tệp · sổ nợ ${debt.total ?? 0}`);
for (const [id, k] of Object.entries(byRule)) console.log(`  ${id.padEnd(9)} ${String(k).padStart(5)}  ${RULES[id].label}`);
for (const x of down) console.log(`  ↓ ${x.f} ${x.id}: ${x.was} → ${x.now} (trả nợ — chạy --ghi để cập nhật sổ)`);

if (args.has('--strict')) {
  if (total(measured)) { console.error(`\nKHÔNG ĐẠT (--strict): còn ${total(measured)} vi phạm — mã kế toán phải ra khỏi lõi (PHASE-004 · 30).`); process.exit(1); }
  console.log('ĐẠT (--strict): lõi sạch.');
} else if (args.has('--check')) {
  if (up.length) { console.error('\nKHÔNG ĐẠT: số vi phạm TĂNG so với sổ nợ (lõi không được thêm nghiệp vụ kế toán):\n' + up.map((x) => `  ${x.f} ${x.id} (${RULES[x.id].label}): ${x.was} → ${x.now}`).join('\n')); process.exit(1); }
  console.log(`ĐẠT: không tăng so với sổ nợ${down.length ? ` (đã giảm ${down.length} chỗ — cập nhật sổ bằng --ghi)` : ''}.`);
}
