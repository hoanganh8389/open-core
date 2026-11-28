#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 04:47 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-1 — ma trận app (D-PLAT-6): open-core đang sửa có còn khớp open-ketoan và open-cake không.
//   Mỗi app: (1) KHỚP TÊN — mọi import tới @bizcity/platform/<đường>, @bizcity/contracts, @ketoan/contracts có đúng tệp + tên export ở open-core;
//            (2) KHỚP KIỂU — tsc của app trên mã lõi đang sửa; báo lỗi MỚI so với mốc (cùng app trên bản lõi nó đang dùng).
//   Không sửa repo app: chép bản git vào thư mục tạm (--work), cài phụ thuộc ở đó, nối gói lõi bằng junction / symlink.
// Dùng: node tools/ma-tran-app.mjs [--ketoan ../open-ketoan] [--ketoan-ref origin/dev] [--cake ../open-cake] [--cake-ref HEAD] [--work <tạm>] [--only ketoan|cake] [--strict]
//        [--chay-that]  (open-cake: cài lõi bằng tgz, chạy đủ test — cần CAKE_TEST_DATABASE_URL)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const WORK = path.resolve(arg('work', path.join(tmpdir(), 'open-core-ma-tran')));
const ONLY = arg('only', '');
const sh = (cmd, cwd, ok = false) => { try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20 }); } catch (e) { if (ok) return `${e.stdout ?? ''}${e.stderr ?? ''}`; throw new Error(`${cmd}\n${e.stdout ?? ''}${e.stderr ?? ''}`.slice(0, 4000)); } };
const log = (s) => console.log(s);
const link = (target, at) => { rmSync(at, { recursive: true, force: true }); mkdirSync(path.dirname(at), { recursive: true }); symlinkSync(target, at, 'junction'); };

/* ── (1) khớp tên ── */
function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const n of readdirSync(d)) { if (n === 'node_modules' || n === 'dist') continue; const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx|mts|mjs)$/.test(n)) out.push(p); }
  return out;
}
const resolveTs = (base) => [base + '.ts', path.join(base, 'index.ts')].find((c) => existsSync(c)) ?? null;
const namesCache = new Map();
function exportNames(file, seen = new Set()) {
  if (namesCache.has(file)) return namesCache.get(file);
  if (seen.has(file)) return new Set(); seen.add(file);
  const s = readFileSync(file, 'utf8'); const names = new Set();
  for (const m of s.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function\*?|class|type|interface|enum|abstract class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of s.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) for (const x of m[1].split(',')) { const n = x.trim().split(/\s+as\s+/).pop().replace(/^type\s+/, '').trim(); if (n) names.add(n); }
  for (const m of s.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) { const t = resolveTs(path.resolve(path.dirname(file), m[1].replace(/\.js$/, ''))); if (t) for (const n of exportNames(t, seen)) names.add(n); }
  namesCache.set(file, names); return names;
}
function nameCheck(root, dirs) {
  let n = 0; const miss = [];
  for (const d of dirs) for (const f of walk(path.join(root, d))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/import\s+(?:type\s+)?(\{[^}]*\})?[^'"]*?from\s+['"](@bizcity\/platform|@bizcity\/contracts|@ketoan\/contracts)(\/[^'"]*)?['"]/g)) {
      n++;
      const pkg = m[2] === '@bizcity/platform' ? 'platform' : 'contracts';
      const sub = (m[3] ?? '').replace(/^\//, '').replace(/\.js$/, '') || 'index';
      const file = resolveTs(path.join(CORE, 'packages', pkg, 'src', sub));
      if (!file) { miss.push(`${m[2]}/${sub} (không có tệp) ← ${path.relative(root, f)}`); continue; }
      for (const raw of (m[1] ?? '').replace(/[{}]/g, '').split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name && !exportNames(file).has(name)) miss.push(`${m[2]}/${sub} → ${name} ← ${path.relative(root, f)}`);
      }
    }
  }
  return { n, miss };
}

/* ── (2) khớp kiểu ── */
const tscErrors = (out) => new Set(out.split('\n').filter((l) => /error TS\d+/.test(l)).map((l) => l.replace(/\\/g, '/').replace(/^.*?((?:apps|packages|modules)\/)/, '$1').trim()));

function prepare(name, repo, ref, install) {
  const dir = path.join(WORK, name);
  const rev = sh(`git -C "${repo}" rev-parse ${ref}`).trim();
  const stamp = path.join(dir, '.ma-tran-rev');
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === rev) { log(`  ${name}: dùng lại bản tạm @ ${rev.slice(0, 7)}`); return dir; }
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const tar = path.join(WORK, `${name}.tar`);
  sh(`git -C "${repo}" archive -o "${tar}" ${rev}`); sh(`tar -xf ../${name}.tar`, dir); rmSync(tar, { force: true }); // đường tương đối: GNU tar trên Windows hiểu "C:" là máy ở xa
  log(`  ${name}: chép @ ${rev.slice(0, 7)}, cài phụ thuộc…`); sh(install, dir);
  writeFileSync(stamp, rev); return dir;
}

function ketoan() {
  const repo = path.resolve(arg('ketoan', path.join(CORE, '..', 'open-ketoan')));
  const dir = prepare('open-ketoan', repo, arg('ketoan-ref', 'origin/dev'), 'npm ci --ignore-scripts --no-audit --no-fund');
  const build = 'npm run build -w @ketoan/contracts -w @bizcity/mua-hang-domain -w @bizcity/platform -w @bizcity/kernel -w @bizcity/module-sdk';
  const names = nameCheck(dir, ['apps/api/src', 'packages/kernel/src', 'packages/module-sdk/src', 'modules']);
  // mốc: bản lõi riêng của app
  for (const p of ['platform', 'contracts']) { const keep = path.join(dir, 'packages', p, 'src.app'); if (existsSync(keep)) { rmSync(path.join(dir, 'packages', p, 'src'), { recursive: true, force: true }); cpSync(keep, path.join(dir, 'packages', p, 'src'), { recursive: true }); } else cpSync(path.join(dir, 'packages', p, 'src'), keep, { recursive: true }); }
  rmSync(path.join(dir, 'node_modules/@bizcity/contracts'), { recursive: true, force: true });
  sh(build, dir, true); const base = tscErrors(sh('npx tsc -p apps/api --noEmit', dir, true));
  // lõi đang sửa
  for (const p of ['platform', 'contracts']) { rmSync(path.join(dir, 'packages', p, 'src'), { recursive: true, force: true }); cpSync(path.join(CORE, 'packages', p, 'src'), path.join(dir, 'packages', p, 'src'), { recursive: true }); }
  link(path.join(dir, 'packages/contracts'), path.join(dir, 'node_modules/@bizcity/contracts')); // lõi import @bizcity/contracts, app import @ketoan/contracts — cùng một gói
  const pkgBuild = sh(build, dir, true); const pkgErr = tscErrors(pkgBuild);
  const now = tscErrors(sh('npx tsc -p apps/api --noEmit', dir, true));
  return { names, base, now, pkgErr };
}

function cake() {
  const repo = path.resolve(arg('cake', path.join(CORE, '..', 'open-cake')));
  const dir = prepare('open-cake', repo, arg('cake-ref', 'HEAD'), 'pnpm install --frozen-lockfile');
  const names = nameCheck(dir, ['apps/api/src', 'packages']);
  const tc = 'pnpm run -s typecheck';
  const api = path.join(dir, 'apps/api/node_modules/@bizcity');
  // mốc: đúng bản lõi app đang cài (liên kết pnpm gốc); đo xong trả lại liên kết gốc để lần sau mốc vẫn đúng
  const orig = Object.fromEntries(['platform', 'contracts'].map((p) => [p, realpathSync(path.join(api, p))]));
  const base = tscErrors(sh(tc, dir, true));
  for (const p of ['platform', 'contracts']) link(path.join(CORE, 'packages', p), path.join(api, p));
  let now;
  try { now = tscErrors(sh(tc, dir, true)); } finally { for (const p of ['platform', 'contracts']) link(orig[p], path.join(api, p)); }
  const runtime = process.argv.includes('--chay-that') ? cakeRuntime(dir) : null;
  return { names, base, now, pkgErr: new Set(), runtime };
}

// [2026-11-28 05:39 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-5 — làn CHẠY THẬT (--chay-that): đóng lõi đang sửa thành tgz (tools/dong-goi.mjs), cài vào bản tạm
//   của open-cake bằng file: + overrides, chạy đủ test của app trên Postgres (CAKE_TEST_DATABASE_URL). Không nối junction vào thư mục lõi: junction kéo zod / fastify
//   của open-core ⇒ hai bản, instanceof ZodError sai (PHASE-001 nhật ký S001-2). Xong trả package.json / lockfile gốc của bản tạm.
function cakeRuntime(dir) {
  const url = process.env.CAKE_TEST_DATABASE_URL;
  if (!url) return { skipped: 'thiếu CAKE_TEST_DATABASE_URL' };
  const ver = JSON.parse(readFileSync(path.join(CORE, 'package.json'), 'utf8')).version;
  const out = path.join(WORK, 'tgz'); rmSync(out, { recursive: true, force: true });
  sh(`node tools/dong-goi.mjs ${ver} "${out}"`, CORE);
  const files = ['apps/api/package.json', 'package.json', 'pnpm-lock.yaml'];
  const saved = Object.fromEntries(files.map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]));
  const tgz = (p) => `file:${path.join(out, `bizcity-${p}-${ver}.tgz`).split(path.sep).join('/')}`;
  try {
    const api = JSON.parse(saved['apps/api/package.json']); api.dependencies['@bizcity/contracts'] = tgz('contracts'); api.dependencies['@bizcity/platform'] = tgz('platform');
    writeFileSync(path.join(dir, 'apps/api/package.json'), JSON.stringify(api, null, 2) + '\n');
    const root = JSON.parse(saved['package.json']); root.pnpm = { ...(root.pnpm ?? {}), overrides: { ...(root.pnpm?.overrides ?? {}), '@bizcity/contracts': tgz('contracts') } };
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(root, null, 2) + '\n');
    sh('pnpm install --no-frozen-lockfile', dir);
    process.env.TEST_DATABASE_URL = url; // test của app đọc TEST_DATABASE_URL; thiếu ⇒ test CSDL bị bỏ qua âm thầm
    const r = sh(`pnpm exec vitest run`, dir, true).replace(/\x1b\[[0-9;]*m/g, '');
    const m = /Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?/.exec(r);
    return { failed: Number(m?.[1] ?? (m ? 0 : NaN)), passed: Number(m?.[2] ?? 0), skipped: Number(m?.[3] ?? 0), tail: m ? r.split('\n').filter((l) => /FAIL|Tests /.test(l)).slice(0, 12) : r.trim().split('\n').slice(-8) }; // [2026-11-28 07:52 PM Johnny Chu - Chu Hoàng Anh] S003-14 — vitest dừng trước dòng tổng ⇒ in đuôi để thấy lý do
  } finally {
    for (const f of files) writeFileSync(path.join(dir, f), saved[f]);
    sh('pnpm install --frozen-lockfile', dir, true);
  }
}

mkdirSync(WORK, { recursive: true });
log(`open-core @ ${sh('git rev-parse --short HEAD', CORE).trim()} — dựng gói lõi…`);
sh('pnpm run -s build', CORE);
let fail = 0;
for (const [name, fn] of [['open-ketoan', ketoan], ['open-cake', cake]]) {
  if (ONLY && !name.includes(ONLY)) continue;
  log(`\n── ${name}`);
  try {
    const r = fn();
    const fresh = [...r.now].filter((e) => !r.base.has(e));
    const fixed = [...r.base].filter((e) => !r.now.has(e));
    log(`  khớp tên: ${r.n ?? r.names.n} import · thiếu ${r.names.miss.length}`); for (const m of r.names.miss.slice(0, 30)) log(`    ✗ ${m}`);
    if (r.pkgErr.size) { log(`  ✗ gói lõi không dựng được trong app (${r.pkgErr.size} lỗi)`); for (const e of [...r.pkgErr].slice(0, 10)) log(`    ${e}`); }
    log(`  khớp kiểu: mốc ${r.base.size} lỗi · trên lõi đang sửa ${r.now.size} · MỚI ${fresh.length} · hết ${fixed.length}`);
    for (const e of fresh.slice(0, 40)) log(`    ✗ ${e}`);
    if (r.runtime?.skipped) log(`  chạy thật: bỏ qua (${r.runtime.skipped})`);
    else if (r.runtime) { log(`  chạy thật (tgz): ${r.runtime.passed} test qua · ${r.runtime.failed} hỏng · ${r.runtime.skipped} bỏ qua`); if (r.runtime.failed !== 0) { fail++; for (const l of r.runtime.tail) log(`    ${l.trim()}`); } }
    const res = { app: name, at: new Date().toISOString(), core: sh('git rev-parse HEAD', CORE).trim(), names: r.names.n, namesMissing: r.names.miss.length, base: r.base.size, now: r.now.size, fresh, fixed };
    writeFileSync(path.join(WORK, `${name}.json`), JSON.stringify(res, null, 2));
    if (r.names.miss.length || r.pkgErr.size) fail++;
    if (fresh.length) fail += process.argv.includes('--strict') ? 1 : 0;
  } catch (e) { fail++; log(`  ✗ không chạy được: ${String(e.message).split('\n').slice(0, 6).join(' | ')}`); }
}
log(`\nKẾT LUẬN: ${fail ? 'KHÔNG ĐẠT' : 'ĐẠT'} (bản ghi: ${WORK})${process.argv.includes('--strict') ? '' : ' — lỗi kiểu mới chỉ báo, chặn khi --strict'}`);
process.exitCode = fail ? 1 : 0;
