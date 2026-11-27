#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] C1 — kiểm khung open-core:
//   R-CORE-1 mọi packages/*/package.json cùng một số phiên bản (= package.json gốc) ·
//   R-PLAT-1 mã lõi không import gói nghiệp vụ, không chuỗi nghiệp vụ cứng (bỏ qua dòng chú thích) — CẢNH BÁO tới khi xong C4
//   (mã dời ở C2 còn chuỗi kế toán), từ C4 CI chạy --strict ⇒ chặn.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pkgDir = path.join(root, 'packages');
const want = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const bad = [];
const warn = [];
const strict = process.argv.includes('--strict');
const BIZ_IMPORT = /from\s+['"](@ketoan|@open-ketoan|@cake|@open-cake)\//;
const BIZ_WORD = /['"`][^'"`]*\b(ketoan|kt_|cake_|crm)\b[^'"`]*['"`]/i;

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist') continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx|mjs|js)$/.test(n)) out.push(p);
  }
  return out;
}

const pkgs = existsSync(pkgDir) ? readdirSync(pkgDir).filter((n) => existsSync(path.join(pkgDir, n, 'package.json'))) : [];
for (const n of pkgs) {
  const v = JSON.parse(readFileSync(path.join(pkgDir, n, 'package.json'), 'utf8')).version;
  if (v !== want) bad.push(`R-CORE-1 packages/${n}: phiên bản ${v} ≠ ${want} (mọi gói chung một số)`);
  for (const f of walk(path.join(pkgDir, n))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*(\*|\/\*)/.test(line)) return;
      if (BIZ_IMPORT.test(code) || BIZ_WORD.test(code)) (strict ? bad : warn).push(`R-PLAT-1 ${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
}

for (const b of bad) console.log(`✗ ${b}`);
for (const w of warn) console.log(`! ${w}`);
console.log(`kiem-khung: ${pkgs.length} gói, phiên bản ${want}, ${bad.length} chặn, ${warn.length} cảnh báo — ${bad.length ? 'KHÔNG ĐẠT' : 'ĐẠT'}`);
process.exitCode = bad.length ? 1 : 0;
