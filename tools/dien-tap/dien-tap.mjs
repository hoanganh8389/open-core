#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-29 12:40 AM Johnny Chu - Chu Hoàng Anh] S004-W1-5a (PHASE-004 · 20 §4) — trình diễn tập phần CSDL: nâng cấp, CHẠY LẠI migration, QUAY LUI (khôi phục bản sao lưu), nâng cấp lại.
//   Không đụng CSDL nguồn: chép sang dt_<nhãn>_a (CREATE DATABASE … TEMPLATE) rồi làm mọi việc trên bản chép. Mỗi bước đo bằng do-bat-bien.mjs và so:
//     B1 nâng cấp      truoc ↔ sau          luật thường (lệch ngoài danh sách trắng = 0)
//     B2 chạy lại      sau ↔ sau2           --chat: giống hệt (migration lặp lại không đổi gì, kể cả lược đồ)
//     B3 quay lui      truoc ↔ quay_lui     --chat: khôi phục bản sao lưu ⇒ giống hệt trước nâng cấp
//     B4 nâng cấp lại  sau ↔ sau3           luật thường + vân lược đồ S-1 bằng nhau (nâng cấp tái lập được)
//   Sao lưu: 'template' (CREATE DATABASE … TEMPLATE, cùng máy chủ) hoặc 'pg_dump' (pg_dump -Fc / pg_restore — đúng đường khôi phục khi chạy thật; cần --pg-bin hoặc PATH).
// Dùng: node tools/dien-tap/dien-tap.mjs --server <url tới CSDL quản trị, vd …/postgres> --nguon <tên CSDL bản sao> --lenh-migrate "<lệnh>"
//        [--nhan x] [--ho-so open-ketoan|core] [--sao-luu template|pg_dump] [--pg-bin <thư mục>] [--out <thư mục biên bản>] [--giu]
//   Lệnh migrate chạy với DATABASE_URL trỏ tới bản chép (vd: "npm run -w apps/api db:migrate" của bản B).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doBatBien, soSanh, thieuBatBuoc } from './do-bat-bien.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../packages/platform/package.json'));
const pg = require('pg');
const NAME_RE = /^[a-z][a-z0-9_]{0,40}$/;

const urlOf = (server, db) => { const u = new URL(server); u.pathname = `/${db}`; return u.toString(); };
async function admin(server, fn) { const c = new pg.Client({ connectionString: server }); await c.connect(); try { return await fn(c); } finally { await c.end(); } }
const drop = (c, db) => c.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
const clone = async (c, from, to) => { await drop(c, to); await c.query(`CREATE DATABASE ${to} TEMPLATE ${from}`); };

async function measure(url, label, opts) {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try { return await doBatBien(c, { nhan: label, ...(opts.truoc ? { truoc_nang_cap: true } : {}) }, { hoSo: opts.hoSo, dong: opts.dong }); } finally { await c.end(); }
}
function migrate(cmd, url, log) {
  const t0 = Date.now();
  try {
    const out = execSync(cmd, { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
    log.push(out.trim().split('\n').slice(-5).join('\n'));
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) { return { ok: false, ms: Date.now() - t0, loi: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-8).join('\n') }; }
}

/** Chạy diễn tập. Trả biên bản { dat, buoc[], … }. */
export async function dienTap(o) {
  const nhan = o.nhan ?? 'x';
  if (!NAME_RE.test(o.nguon) || !NAME_RE.test(nhan)) throw new Error('--nguon / --nhan: chữ thường, số, gạch dưới');
  const A = `dt_${nhan}_a`, SNAP = `dt_${nhan}_sao_luu`;
  const urlA = urlOf(o.server, A);
  const ghi = (ten, kq) => { if (o.out) { mkdirSync(o.out, { recursive: true }); writeFileSync(path.join(o.out, `${ten}.json`), JSON.stringify(kq, null, 2) + '\n'); } return kq; };
  const dongDir = (ten) => (o.out && o.dong ? path.join(o.out, 'dong', ten) : undefined);
  const buoc = []; const log = [];
  const them = (ma, ten, r, extra = {}) => { buoc.push({ ma, ten, dat: r.dat, lech: r.lech, ghi_chu: r.ghi_chu, ...extra }); return r.dat; };
  const opt = { hoSo: o.hoSo };
  const dump = path.join(o.out ?? '.', `${SNAP}.dump`);
  const bin = (x) => (o.pgBin ? `"${path.join(o.pgBin, x)}"` : x);
  try {
    await admin(o.server, (c) => clone(c, o.nguon, A)); // B0 chép bản sao (không đụng nguồn)
    const truoc = ghi('truoc', await measure(urlA, 'trước nâng cấp', { ...opt, truoc: true, dong: dongDir('truoc') }));
    const thieu = thieuBatBuoc(truoc);
    if (thieu.length) { them('B0', 'đo trước nâng cấp', { dat: false, lech: thieu.map(([ma, v]) => ({ ma, ten: v.ten, ly_do: v.ly_do ?? v.tt })), ghi_chu: [] }); return ketThuc(); }
    // sao lưu (đường quay lui)
    if (o.saoLuu === 'pg_dump') execSync(`${bin('pg_dump')} -Fc -d "${urlA}" -f "${dump}"`, { stdio: 'pipe' });
    else await admin(o.server, (c) => clone(c, A, SNAP));

    const m1 = migrate(o.lenhMigrate, urlA, log);
    if (!m1.ok) { them('B1', 'nâng cấp', { dat: false, lech: [{ ma: 'migrate', ly_do: m1.loi }], ghi_chu: [] }, { ms: m1.ms }); return ketThuc(); }
    const sau = ghi('sau', await measure(urlA, 'sau nâng cấp', { ...opt, dong: dongDir('sau') }));
    them('B1', 'nâng cấp: trước ↔ sau', soSanh(truoc, sau, { dongTruoc: dongDir('truoc'), dongSau: dongDir('sau') }), { ms: m1.ms });

    const m2 = migrate(o.lenhMigrate, urlA, log);
    if (!m2.ok) them('B2', 'chạy lại migration', { dat: false, lech: [{ ma: 'migrate', ly_do: m2.loi }], ghi_chu: [] }, { ms: m2.ms });
    else them('B2', 'chạy lại migration: sau ↔ sau2 (giống hệt)', soSanh(sau, ghi('sau2', await measure(urlA, 'sau chạy lại', opt)), { chat: true }), { ms: m2.ms });

    // quay lui: bỏ bản đã nâng cấp, khôi phục bản sao lưu
    await admin(o.server, async (c) => {
      if (o.saoLuu === 'pg_dump') { await drop(c, A); await c.query(`CREATE DATABASE ${A}`); }
      else await clone(c, SNAP, A);
    });
    if (o.saoLuu === 'pg_dump') execSync(`${bin('pg_restore')} --no-owner -d "${urlA}" "${dump}"`, { stdio: 'pipe' });
    const quayLui = ghi('quay_lui', await measure(urlA, 'sau quay lui', { ...opt, truoc: true }));
    them('B3', 'quay lui: trước ↔ sau khôi phục (giống hệt)', soSanh(truoc, quayLui, { chat: true }));

    const m3 = migrate(o.lenhMigrate, urlA, log);
    if (!m3.ok) them('B4', 'nâng cấp lại sau quay lui', { dat: false, lech: [{ ma: 'migrate', ly_do: m3.loi }], ghi_chu: [] }, { ms: m3.ms });
    else {
      const sau3 = ghi('sau3', await measure(urlA, 'nâng cấp lại', opt));
      const r = soSanh(sau, sau3);
      if (sau.ket_qua['S-1']?.h !== sau3.ket_qua['S-1']?.h) r.lech.push({ ma: 'S-1', ly_do: 'nâng cấp lại ra lược đồ khác lần đầu — migration không tái lập' });
      r.dat = r.lech.length === 0;
      them('B4', 'nâng cấp lại sau quay lui: sau ↔ sau3 (+ lược đồ bằng nhau)', r, { ms: m3.ms });
    }
    return ketThuc();
  } finally {
    if (!o.giu) await admin(o.server, async (c) => { await drop(c, A); await drop(c, SNAP); });
  }
  function ketThuc() {
    const bb = { contract: 'bizcity_dien_tap_bien_ban@1', nguon: o.nguon, ho_so: o.hoSo ?? 'open-ketoan', sao_luu: o.saoLuu ?? 'template', lenh_migrate: o.lenhMigrate, luc: new Date().toISOString(), dat: buoc.length > 0 && buoc.every((b) => b.dat) && buoc.length === 4, buoc, nhat_ky_migrate: log };
    return ghi('bien-ban', bb);
  }
}

async function main() {
  const a = process.argv.slice(2);
  const v = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const o = { server: v('--server'), nguon: v('--nguon'), lenhMigrate: v('--lenh-migrate'), nhan: v('--nhan'), hoSo: v('--ho-so'), saoLuu: v('--sao-luu') ?? 'template', pgBin: v('--pg-bin'), out: v('--out'), giu: a.includes('--giu'), dong: a.includes('--dong') };
  if (!o.server || !o.nguon || !o.lenhMigrate) { console.error('Dùng: --server <url quản trị> --nguon <CSDL bản sao> --lenh-migrate "<lệnh>" [--nhan x] [--ho-so …] [--sao-luu template|pg_dump] [--pg-bin dir] [--out dir] [--dong] [--giu]'); process.exit(2); }
  const bb = await dienTap(o);
  for (const b of bb.buoc) {
    console.log(`${b.dat ? '✓' : '✗'} ${b.ma} ${b.ten}${b.ms !== undefined ? ` (${b.ms} ms)` : ''}`);
    for (const l of b.lech ?? []) console.log(`    ✗ ${l.ma} ${l.ten ?? ''}: ${l.ly_do}`);
    for (const g of b.ghi_chu ?? []) console.log(`    · ${g}`);
  }
  console.log(bb.dat ? 'ĐẠT: nâng cấp · chạy lại · quay lui · nâng cấp lại' : 'KHÔNG ĐẠT — dừng, không đổi nguồn (PHASE-004 · 20 §5)');
  process.exit(bb.dat ? 0 : 1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
