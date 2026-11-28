#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-29 01:09 AM Johnny Chu - Chu Hoàng Anh] S005-F0-1 — Scoreboard DX (PHASE-005 · 60): developer còn phải tự viết bao nhiêu.
//   Nguồn: docs/scoreboard/dx.json (mức D0–D3 của 30 thao tác TP-01…30 × app, có bằng chứng; mốc tính năng vàng; mốc nợ viết tay).
//   Ba con số: (1) điểm DX mỗi app; (2) số dòng module mẫu golden (đếm thật từ packages/platform/test/golden/*); (3) nợ viết tay ở app (đo thật trên repo app).
// Dùng: node tools/scoreboard-dx.mjs                 sinh docs/scoreboard/DX.md
//       node tools/scoreboard-dx.mjs --check         kiểm dữ liệu + bánh cóc golden (trong pnpm test)
//       node tools/scoreboard-dx.mjs --check --app open-cake=../open-cake --app open-ketoan=../open-ketoan   + bánh cóc nợ viết tay
//       node tools/scoreboard-dx.mjs --measure --app open-cake=../open-cake   in số đo, không so (để cập nhật mốc có chủ ý)
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs/scoreboard/dx.json');
const dx = JSON.parse(readFileSync(SRC, 'utf8'));
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const MEASURE = argv.includes('--measure');
const apps = Object.fromEntries(argv.flatMap((a, i) => (a === '--app' ? [argv[i + 1].split('=')] : [])));

/* ── số dòng viết tay: bỏ dòng trống và dòng chỉ là chú thích (// -- /* *) ── */
function loc(file) {
  return readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => {
    const t = l.trim();
    return t && !t.startsWith('//') && !t.startsWith('--') && !t.startsWith('/*') && !t.startsWith('*');
  }).length;
}
function walk(dir, ok, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ok, out); else if (ok(p)) out.push(p);
  }
  return out;
}

/* ── (3) nợ viết tay của một app: đếm theo luật cố định, lặp lại được ── */
const ROUTE_RE = /\b(app|r|fastify|server|instance)\.(get|post|put|patch|delete|route|all|head|options)(<[^>]*>)?\(/g;
function debtOf(dir) {
  const isTest = (p) => /[\\/](test|tests|__tests__)[\\/]|\.test\.|\.spec\./.test(p);
  const api = ['apps/api/src', 'modules'].flatMap((d) => walk(path.join(dir, d), (p) => /\.(ts|mts|js|mjs)$/.test(p) && !isTest(p)));
  const web = walk(path.join(dir, 'apps/web/src'), (p) => /\.(tsx|jsx)$/.test(p) && !isTest(p));
  let directRoutes = 0;
  for (const f of api) directRoutes += (readFileSync(f, 'utf8').match(ROUTE_RE) ?? []).length;
  const handTables = web.filter((f) => /<table\b/.test(readFileSync(f, 'utf8'))).length;
  let sha = '';
  try { sha = execSync('git rev-parse --short HEAD', { cwd: dir, encoding: 'utf8' }).trim(); } catch { /* repo không có git: để trống */ }
  return { directRoutes, handTables, sha };
}

/* ── kiểm dữ liệu ── */
const bad = [];
const ids = dx.ops.map((o) => o.id);
if (ids.length !== 30 || new Set(ids).size !== 30) bad.push(`cần đúng 30 thao tác TP-01…30, có ${ids.length}`);
for (const o of dx.ops) {
  for (const a of dx.apps) {
    const c = dx.levels[o.id]?.[a];
    if (!c || !Number.isInteger(c.level) || c.level < 0 || c.level > 3) { bad.push(`${o.id} ${a}: mức phải 0..3`); continue; }
    if (c.level > 0 && !(c.evidence ?? '').trim()) bad.push(`${o.id} ${a}: mức D${c.level} thiếu bằng chứng`);
  }
}
const goldenFiles = dx.golden.files.map((f) => path.join(ROOT, f));
for (const f of goldenFiles) if (!existsSync(f)) bad.push(`golden: thiếu tệp ${path.relative(ROOT, f)}`);
const goldenLoc = goldenFiles.filter(existsSync).reduce((s, f) => s + loc(f), 0);
if (CHECK && goldenLoc > dx.golden.baselineLoc) bad.push(`golden: ${goldenLoc} dòng > mốc ${dx.golden.baselineLoc} (bánh cóc: không được tăng)`);

const measured = {};
for (const [a, dir] of Object.entries(apps)) {
  const abs = path.resolve(ROOT, dir);
  if (!existsSync(abs)) { console.log(`SKIP nợ viết tay ${a}: không có ${abs}`); continue; }
  measured[a] = debtOf(abs);
  const base = dx.debt[a];
  if (CHECK && base) {
    for (const k of ['directRoutes', 'handTables']) {
      if (measured[a][k] > base[k]) bad.push(`nợ viết tay ${a}.${k}: ${measured[a][k]} > mốc ${base[k]} (bánh cóc)`);
    }
  }
}
if (MEASURE) { console.log(JSON.stringify({ goldenLoc, debt: measured }, null, 2)); process.exit(0); }
if (bad.length) { for (const b of bad) console.log('✗ ' + b); console.log('KẾT LUẬN: KHÔNG ĐẠT'); process.exit(1); }

const pct = (a) => Math.round((dx.ops.reduce((s, o) => s + dx.levels[o.id][a].level, 0) / (dx.ops.length * 3)) * 100);
if (CHECK) {
  const skipped = Object.keys(apps).length ? '' : ' · nợ viết tay: SKIP (không truyền --app)';
  console.log(`scoreboard-dx: 30 thao tác × ${dx.apps.length} app; golden ${goldenLoc} / mốc ${dx.golden.baselineLoc} dòng — ĐẠT${skipped}`);
  process.exit(0);
}

/* ── sinh DX.md ── */
const md = [
  '# Scoreboard DX — developer còn phải tự viết bao nhiêu',
  '',
  '<!-- sinh bởi tools/scoreboard-dx.mjs từ dx.json — đừng sửa tay tệp này -->',
  '',
  `> **Đo lúc:** ${dx.measuredAt} · **open-core:** ${dx.coreRef} · **Nguồn:** [\`dx.json\`](dx.json) · **Phương pháp:** [PHASE-005 · 60](../phases/PHASE-005-KHUNG-UNG-DUNG-KHAI-BAO/60-SCOREBOARD-DX.md)`,
  '> **Thang:** D0 viết tay toàn bộ · D1 có helper, vẫn ráp nhiều · D2 khai một dòng / khối · D3 tự sinh',
  '',
  '| App | Điểm DX | Repo đo |', '|---|---|---|',
  ...dx.apps.map((a) => `| ${a} | **${pct(a)} %** | ${dx.appRefs?.[a] ?? ''} |`),
  '',
  `## Tính năng vàng (module mẫu \`golden\`)`,
  '',
  `- **${goldenLoc} dòng viết tay** (đếm thật, bỏ dòng trống / chú thích) trong ${dx.golden.files.length} tệp: ${dx.golden.files.map((f) => `\`${f}\``).join(', ')}. Mốc bánh cóc: ${dx.golden.baselineLoc}.`,
  `- Chạy thật: \`${dx.golden.test}\`.`,
  `- ${dx.golden.note}`,
  '',
  '## Nợ viết tay ở app (đo thật, bánh cóc: không được tăng)',
  '',
  '| App | route Fastify viết tay | tệp React tự vẽ `<table` | SHA đo | Ghi chú |', '|---|---|---|---|---|',
  ...Object.entries(dx.debt).map(([a, d]) => `| ${a} | ${d.directRoutes} | ${d.handTables} | \`${d.sha}\` | ${d.note ?? ''} |`),
  '',
  `## Ba mươi thao tác × app`,
  '',
  `| # | Thao tác | ${dx.apps.join(' | ')} |`, `|---|---|${dx.apps.map(() => '---').join('|')}|`,
  ...dx.ops.map((o) => `| ${o.id} | ${o.name} | ${dx.apps.map((a) => `D${dx.levels[o.id][a].level}`).join(' | ')} |`),
  '',
  '## Bằng chứng',
  '',
  ...dx.ops.flatMap((o) => [`### ${o.id} ${o.name}`, ...dx.apps.map((a) => `- **${a}** (D${dx.levels[o.id][a].level}): ${dx.levels[o.id][a].evidence || '—'}`), '']),
].join('\n');
writeFileSync(path.join(ROOT, 'docs/scoreboard/DX.md'), md);
console.log(`đã sinh DX.md — ${dx.apps.map((a) => `${a} ${pct(a)} %`).join(' · ')} · golden ${goldenLoc} dòng`);
