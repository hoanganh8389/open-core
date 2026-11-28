#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 06:56 PM Johnny Chu - Chu Hoàng Anh] PHASE-003 S003-13 — scoreboard ERP-12 × app: đọc docs/scoreboard/scoreboard.json (nguồn duy nhất, sửa tay khi
//   có bằng chứng mới) ⇒ sinh docs/scoreboard/SCOREBOARD.md (người đọc) + chép dữ liệu vào thẻ #sb của mockup web-shell (màn Tình trạng nền tảng).
//   Kiểm: mỗi mức > 0 phải có bằng chứng (đường dẫn); mức ∈ 0..4; app trong levels khớp danh sách apps. Lệch ⇒ mã thoát 1.
// Dùng: node tools/scoreboard.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs/scoreboard/scoreboard.json');
const sb = JSON.parse(readFileSync(SRC, 'utf8'));
const bad = [];
for (const p of sb.primitives) {
  for (const a of sb.apps) {
    const lv = p.levels[a];
    if (!Number.isInteger(lv) || lv < 0 || lv > 4) bad.push(`${p.id} ${a}: mức ${lv} ngoài 0..4`);
    if (lv > 0 && !(p.evidence?.[a] ?? '').trim()) bad.push(`${p.id} ${a}: mức ${lv} thiếu bằng chứng`);
  }
  for (const a of Object.keys(p.levels)) if (!sb.apps.includes(a)) bad.push(`${p.id}: app lạ ${a}`);
}
if (bad.length) { for (const b of bad) console.log('✗ ' + b); console.log('KẾT LUẬN: KHÔNG ĐẠT'); process.exit(1); }
if (process.argv.includes('--check')) { console.log(`scoreboard: ${sb.primitives.length} mục × ${sb.apps.length} app — ĐẠT`); process.exit(0); }

const pct = (a) => Math.round((sb.primitives.reduce((s, p) => s + p.levels[a], 0) / (sb.primitives.length * 4)) * 100);
const LV = ['0 chưa có', '1 mới tài liệu', '2 có một phần', '3 có mã + test ở app', '4 ở open-core, có test, app dùng'];
const md = [
  '# Scoreboard — mã đáp ứng tài liệu tới đâu (ERP-12 × app)',
  '',
  `<!-- sinh bởi tools/scoreboard.mjs từ scoreboard.json — đừng sửa tay tệp này -->`,
  '',
  `> **Đo lúc:** ${sb.measuredAt} · **open-core:** ${sb.version} · **Nguồn:** [\`scoreboard.json\`](scoreboard.json) · **Màn trong app:** Cài đặt hệ thống › Tình trạng nền tảng ([mockup](../ui/mockup-shots/f5-tinh-trang-nen-tang.png))`,
  `> **Thang:** ${LV.join(' · ')}`,
  '',
  `| App | Mức trung bình |`, '|---|---|',
  ...sb.apps.map((a) => `| ${a} | **${pct(a)} %** |`),
  '',
  `| # | Thứ dùng chung | ${sb.apps.join(' | ')} | Còn thiếu chính |`,
  `|---|---|${sb.apps.map(() => '---').join('|')}|---|`,
  ...sb.primitives.map((p) => `| ${p.id} | ${p.name} | ${sb.apps.map((a) => `**${p.levels[a]}**`).join(' | ')} | ${p.gap ?? ''} |`),
  '',
  '## Bằng chứng',
  '',
  ...sb.primitives.flatMap((p) => [`### ${p.id} ${p.name}`, ...sb.apps.map((a) => `- **${a}** (${p.levels[a]}): ${p.evidence?.[a] || '—'}`), '']),
  '## Mười khoảng trống lớn nhất (theo tác động ERP)',
  '',
  ...(sb.topGaps ?? []).map((g, i) => `${i + 1}. ${g}`),
  '',
].join('\n');
writeFileSync(path.join(ROOT, 'docs/scoreboard/SCOREBOARD.md'), md);
const mock = path.join(ROOT, 'docs/ui/mockup-src/web-shell.html');
const html = readFileSync(mock, 'utf8').replace(/<script id="sb" type="application\/json">[\s\S]*?<\/script>/, `<script id="sb" type="application/json">${JSON.stringify(sb)}</script>`);
writeFileSync(mock, html);
console.log(`đã sinh SCOREBOARD.md + dữ liệu mockup — ${sb.apps.map((a) => `${a} ${pct(a)} %`).join(' · ')}`);
