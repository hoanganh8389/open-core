#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-29 12:39 AM Johnny Chu - Chu Hoàng Anh] S004-W1-3c (PHASE-004 · 20 §4 bước 7, H-4) — dò HÀNH VI qua API: kết quả báo cáo + ma trận phân quyền, bản A ↔ bản B.
//   Bộ đo bất biến đọc CSDL; cái nó không thấy là hành vi của MÃ (bản A tính báo cáo / quyết quyền thế nào so với bản B). Công cụ này gọi API của từng bản
//   theo một tệp kịch bản, ghi trạng thái + băm thân JSON (đã chuẩn hoá: khoá xếp thứ tự, bỏ khoá thay đổi theo lần gọi), rồi so.
//   CHỈ ĐỌC: báo cáo là GET; ô quyền là GET hoặc POST kèm ?dryRun=1 (action của lõi chạy thử rồi huỷ; action không khai dryRun thì từ chối, không chạy thật).
// Dùng: node tools/dien-tap/do-api.mjs --kich-ban kb.json --goc http://127.0.0.1:3000 --out a.json      (biến ${TEN} trong kịch bản lấy từ môi trường)
//       node tools/dien-tap/do-api.mjs --so a.json b.json                                              lệch ⇒ exit 1
// Kịch bản (bizcity_dien_tap_kich_ban@1):
//   { "nguoi": { "ktt": { "headers": { "authorization": "Bearer ${KTT_TOKEN}" } }, … },
//     "bo_khoa": ["requestId", "generatedAt"],                                   khoá bỏ khi băm (ở mọi tầng)
//     "bao_cao": [ { "ma": "BC-1", "ten": "cân đối phát sinh 2026", "nguoi": "ktt", "get": "/api/v1/…" } ],
//     "quyen":   { "nguoi": ["ktt", "thu_quy", "nhan_vien"], "duong": [ { "ma": "Q-1", "get": "/api/v1/…" }, { "ma": "Q-2", "post": "/api/v1/…", "body": {} } ] } }
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACT = 'bizcity_dien_tap_api@1';
const BO_KHOA_MAC_DINH = ['requestId', 'traceId', 'traceparent', 'generatedAt', 'now', 'luc'];

const expand = (v) => (typeof v === 'string' ? v.replace(/\$\{([A-Z0-9_]+)\}/g, (_, k) => { if (process.env[k] === undefined) throw new Error(`kịch bản cần biến môi trường ${k}`); return process.env[k]; })
  : Array.isArray(v) ? v.map(expand) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expand(x)])) : v);
/** JSON chuẩn hoá: khoá xếp thứ tự, bỏ khoá thay đổi theo lần gọi. */
export function chuan(v, bo) {
  if (Array.isArray(v)) return v.map((x) => chuan(x, bo));
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).filter((k) => !bo.has(k)).sort().map((k) => [k, chuan(v[k], bo)]));
  return v;
}
const md5 = (s) => createHash('md5').update(s).digest('hex');

async function goi(goc, nguoi, r) {
  const method = r.post !== undefined ? 'POST' : 'GET';
  if (r.post === undefined && r.get === undefined) throw new Error(`${r.ma}: chỉ GET hoặc POST (chạy thử)`);
  const u = new URL(r.post ?? r.get, goc);
  if (method === 'POST') u.searchParams.set('dryRun', '1'); // không bao giờ ghi thật
  const res = await fetch(u, { method, headers: { 'content-type': 'application/json', ...(nguoi?.headers ?? {}) }, ...(method === 'POST' ? { body: JSON.stringify(r.body ?? {}) } : {}) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: res.status, json, text };
}

/** Chạy kịch bản trên một bản (gốc URL). */
export async function doApi(kichBan, goc) {
  const kb = expand(kichBan);
  const bo = new Set([...BO_KHOA_MAC_DINH, ...(kb.bo_khoa ?? [])]);
  const out = { contract: CONTRACT, goc, luc: new Date().toISOString(), bao_cao: {}, quyen: {} };
  for (const r of kb.bao_cao ?? []) {
    const x = await goi(goc, kb.nguoi?.[r.nguoi], r);
    out.bao_cao[r.ma] = { ten: r.ten ?? r.get, status: x.status, h: md5(x.json !== undefined ? JSON.stringify(chuan(x.json, bo)) : x.text), ...(x.json?.error?.code ?? x.json?.code ? { code: x.json?.error?.code ?? x.json?.code } : {}) };
  }
  for (const r of kb.quyen?.duong ?? []) {
    for (const ng of kb.quyen.nguoi ?? []) {
      const x = await goi(goc, kb.nguoi?.[ng], r);
      out.quyen[`${r.ma}@${ng}`] = { status: x.status, ...(x.json?.error?.code ?? x.json?.code ? { code: x.json?.error?.code ?? x.json?.code } : {}) };
    }
  }
  return out;
}

/** So hai lần dò: báo cáo (trạng thái + băm thân) và từng ô quyền (trạng thái + mã lỗi) phải bằng nhau. */
export function soApi(a, b) {
  const lech = [];
  for (const k of new Set([...Object.keys(a.bao_cao), ...Object.keys(b.bao_cao)])) {
    const x = a.bao_cao[k], y = b.bao_cao[k];
    if (!x || !y) { lech.push({ ma: k, ly_do: 'báo cáo chỉ có ở một bản' }); continue; }
    if (x.status !== y.status || x.h !== y.h) lech.push({ ma: k, ten: x.ten, ly_do: `trước ${x.status} ${x.h.slice(0, 8)} · sau ${y.status} ${y.h.slice(0, 8)}` });
  }
  for (const k of new Set([...Object.keys(a.quyen), ...Object.keys(b.quyen)])) {
    const x = a.quyen[k], y = b.quyen[k];
    if (!x || !y) { lech.push({ ma: k, ly_do: 'ô quyền chỉ có ở một bản' }); continue; }
    if (x.status !== y.status || x.code !== y.code) lech.push({ ma: k, ly_do: `quyền đổi: trước ${x.status}${x.code ? ` ${x.code}` : ''} · sau ${y.status}${y.code ? ` ${y.code}` : ''}` });
  }
  return { dat: lech.length === 0, lech };
}

async function main() {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--so')) {
    const [fa, fb] = args.slice(args.indexOf('--so') + 1);
    const r = soApi(JSON.parse(readFileSync(fa, 'utf8')), JSON.parse(readFileSync(fb, 'utf8')));
    for (const l of r.lech) console.log(`  ✗ ${l.ma} ${l.ten ?? ''}: ${l.ly_do}`);
    console.log(r.dat ? 'ĐẠT: báo cáo và quyền giống nhau giữa hai bản' : `KHÔNG ĐẠT: ${r.lech.length} chỗ lệch`);
    process.exit(r.dat ? 0 : 1);
  }
  const kb = val('--kich-ban'), goc = val('--goc');
  if (!kb || !goc) { console.error('Dùng: --kich-ban kb.json --goc <url bản đang chạy> [--out a.json] | --so a.json b.json'); process.exit(2); }
  const kq = await doApi(JSON.parse(readFileSync(kb, 'utf8')), goc);
  const out = val('--out');
  if (out) { writeFileSync(out, JSON.stringify(kq, null, 2) + '\n'); console.log(`Đã ghi ${out}: ${Object.keys(kq.bao_cao).length} báo cáo · ${Object.keys(kq.quyen).length} ô quyền.`); }
  else console.log(JSON.stringify(kq, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
