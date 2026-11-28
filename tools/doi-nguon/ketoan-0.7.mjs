#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-29 12:10 AM Johnny Chu - Chu Hoàng Anh] S004-W2-2 (PHASE-004 · 10 bản đồ tương thích) — codemod ĐỔI NGUỒN cho open-ketoan khi chuyển sang lõi 0.7:
//   kiểu bảng kế toán đã ra khỏi Database của lõi (khu cách ly @bizcity/platform/ketoan-legacy/*). Codemod làm đúng ba việc, không đụng logic:
//   (1) `import type { Account, … } from '@bizcity/platform/db/types'` — tên thuộc khu cách ly chuyển sang '@bizcity/platform/ketoan-legacy/db-types';
//   (2) tệp chuyển tiếp `export * from '@bizcity/platform/db/types'` thêm dòng xuất lại khu cách ly;
//   (3) mỗi gói có src dùng lõi: thêm `src/ketoan-legacy-nap.ts` nạp kiểu bảng (gộp khai báo vào AppDatabase); apps/api còn gọi installKetoanLegacy()
//       (móc khoá cài đặt open-pos `okti_`) và main.ts import tệp nạp ở dòng đầu.
// Dùng: node tools/doi-nguon/ketoan-0.7.mjs <thư mục open-ketoan> [--thu]   (--thu: chỉ in, không ghi)
//   Ma trận app (tools/ma-tran-app.mjs) gọi doiNguon() trên bản tạm rồi trả lại tệp gốc.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEGACY = path.join(CORE, 'packages/platform/src/ketoan-legacy/db-types.ts');
const FROM = '@bizcity/platform/db/types';
const TO = '@bizcity/platform/ketoan-legacy/db-types';
const GOI = ['apps/api', 'packages/kernel', 'packages/module-sdk']; // gói có tsc riêng và dùng Database của lõi

/** Tên kiểu khu cách ly xuất ra (interface / type). */
export function legacyNames(file = LEGACY) {
  const s = readFileSync(file, 'utf8');
  return new Set([...s.matchAll(/^export (?:interface|type) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]));
}

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const n of readdirSync(d)) { if (n === 'node_modules' || n === 'dist') continue; const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx|mts)$/.test(n) && !n.endsWith('.d.ts')) out.push(p); }
  return out;
}

/** Trả { changed: Map<tệp, nội dung gốc>, created: tệp mới }. Không ghi khi dry. */
export function doiNguon(dir, { dry = false } = {}) {
  const names = legacyNames();
  const changed = new Map(); const created = [];
  const put = (f, s) => { if (!changed.has(f) && existsSync(f)) changed.set(f, readFileSync(f, 'utf8')); if (!dry) writeFileSync(f, s); };
  const files = [...GOI.map((g) => path.join(dir, g, 'src')), path.join(dir, 'modules'), path.join(dir, 'apps/api/test')].flatMap((d) => walk(d));
  const reImport = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*(['"])@bizcity\/platform\/db\/types\3;?/g;
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    let o = s.replace(reImport, (m, typeKw, list, q) => {
      const items = list.split(',').map((x) => x.trim()).filter(Boolean);
      const base = (x) => x.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      const leg = items.filter((x) => names.has(base(x))); const keep = items.filter((x) => !names.has(base(x)));
      if (!leg.length) return m;
      const kw = typeKw ? 'type ' : '';
      return [keep.length ? `import ${kw}{ ${keep.join(', ')} } from ${q}${FROM}${q};` : null, `import ${kw}{ ${leg.join(', ')} } from ${q}${TO}${q};`].filter(Boolean).join('\n');
    });
    if (/^export \* from ['"]@bizcity\/platform\/db\/types['"];?\s*$/m.test(o) && !o.includes(TO)) o = o.replace(/^(export \* from (['"])@bizcity\/platform\/db\/types\2;?)\s*$/m, `$1\nexport * from $2${TO}$2; // đổi nguồn lõi 0.7 (S004-W2-2): kiểu bảng kế toán ở khu cách ly`);
    // [2026-11-29 12:45 AM Johnny Chu - Chu Hoàng Anh] S004-W1-7a (E-7) — SYSTEM_ROLES (danh sách vai tĩnh của kế toán) không còn ở core/authz/legacy ⇒ lấy từ khu cách ly
    o = o.replace(/import\s+\{([^}]*\bSYSTEM_ROLES\b[^}]*)\}\s*from\s*(['"])@bizcity\/platform\/core\/authz\/legacy\2;?/, (m, list, q) => {
      const keep = list.split(',').map((x) => x.trim()).filter((x) => x && x !== 'SYSTEM_ROLES');
      return [keep.length ? `import { ${keep.join(', ')} } from ${q}@bizcity/platform/core/authz/legacy${q};` : null, `import { SYSTEM_ROLES } from ${q}@bizcity/platform/ketoan-legacy/index${q}; // đổi nguồn lõi 0.7 (E-7)`].filter(Boolean).join('\n');
    });
    // (E-5, E-6) Role của lõi là string; Role của @ketoan/contracts là union vai kế toán ⇒ ép kiểu vai bổ sung đọc từ lõi (chỉ kiểu, không đổi logic)
    if (/import\s+type\s+\{[^}]*\bRole\b[^}]*\}\s*from\s*['"]@ketoan\/contracts['"]/.test(o) && /\bextraAuthz\b/.test(o)) o = o.replace(/\.\.\.extra\.roles\]/g, '...(extra.roles as Role[])]');
    if (o !== s) put(f, o);
  }
  for (const g of GOI) {
    const src = path.join(dir, g, 'src'); if (!existsSync(src)) continue;
    const nap = path.join(src, 'ketoan-legacy-nap.ts');
    const api = g === 'apps/api';
    const body = `// Đổi nguồn lõi 0.7 (open-core tools/doi-nguon/ketoan-0.7.mjs, S004-W2-2): nạp kiểu bảng kế toán vào Database (khu cách ly ketoan-legacy).\nimport '${TO}';\n` +
      (api ? `import { installKetoanLegacy } from '@bizcity/platform/ketoan-legacy/index';\n\ninstallKetoanLegacy(); // móc khoá cài đặt open-pos (okti_) — lõi 0.7 không tự đọc pos_installations\n` : `export {};\n`);
    if (!existsSync(nap)) { created.push(nap); if (!dry) writeFileSync(nap, body); }
    if (api) {
      const main = path.join(src, 'main.ts');
      if (existsSync(main)) { const cur = readFileSync(main, 'utf8'); if (!cur.includes('./ketoan-legacy-nap.js')) put(main, `import './ketoan-legacy-nap.js'; // đổi nguồn lõi 0.7 — nạp trước mọi import khác\n` + cur); }
    }
  }
  return { changed, created };
}

/** Trả lại tệp gốc (ma trận dùng sau khi đo). */
export function traLai({ changed, created }) {
  for (const [f, s] of changed) writeFileSync(f, s);
  for (const f of created) rmSync(f, { force: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) { console.error('Dùng: node tools/doi-nguon/ketoan-0.7.mjs <thư mục open-ketoan> [--thu]'); process.exit(2); }
  const dry = process.argv.includes('--thu');
  const r = doiNguon(path.resolve(dir), { dry });
  console.log(`${dry ? '(thử) ' : ''}sửa ${r.changed.size} tệp · thêm ${r.created.length} tệp`);
  for (const f of [...r.changed.keys(), ...r.created]) console.log('  ' + path.relative(dir, f).split(path.sep).join('/'));
}
