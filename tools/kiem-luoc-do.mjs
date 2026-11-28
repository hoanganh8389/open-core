#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 05:33 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 S002-1 — khớp LƯỢC ĐỒ bảng lõi giữa CSDL chỉ có migration lõi và CSDL của app
//   (mặc định open-ketoan, dãy riêng 0001…0186 + ketoanLegacyHooks). Mọi CSDL dùng chung open-core phải có cùng hình bảng lõi (PHASE-002 §0).
//   Khác biệt CÓ CHỦ Ý ghi trong DA_BIET (kèm lý do); khác biệt khác ⇒ KHÔNG ĐẠT. Cần Postgres: TEST_DATABASE_URL (CSDL quản trị, tạo / xoá CSDL *_test).
// Dùng: pnpm run -s build && TEST_DATABASE_URL=postgres://… node tools/kiem-luoc-do.mjs --app-migrations <okt>/db/migrations
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ADMIN = process.env.TEST_DATABASE_URL;
const APP = arg('app-migrations');
if (!ADMIN || !APP) { console.error('Cần TEST_DATABASE_URL và --app-migrations <thư mục db/migrations của app>'); process.exit(2); }
process.env.DATABASE_URL ??= ADMIN;
const dist = (p) => pathToFileURL(path.join(CORE, 'packages/platform/dist', p)).href;
const pg = (await import(pathToFileURL(path.join(CORE, 'packages/platform/node_modules/pg/lib/index.js')).href)).default;
const { runMigrations } = await import(dist('db/migrate.js'));
const { ketoanLegacyHooks } = await import(dist('db/migrate-ketoan-legacy.js'));
const { PLATFORM_MIGRATIONS_DIR } = await import(dist('db/paths.js'));

/** Khác biệt có chủ ý (lõi bỏ phần riêng của kế toán — R-PLAT-1). Khoá = dòng so sánh; giá trị = lý do. */
const DA_BIET = {
  'okt ràng buộc document_signatures document_signatures_event_id_fkey': 'khoá ngoại tới accounting_events (bảng kế toán) — bỏ ở 0001',
  'okt ràng buộc tenant_roles tenant_roles_base_role_check': 'open-ketoan giữ danh sách vai kế toán (lõi 0002 coveredBy)',
  'okt ràng buộc tenant_roles tenant_roles_code_check': 'như trên',
  'okt ràng buộc user_role_assignments user_role_assignments_role_check': 'như trên',
  'okt ràng buộc users users_role_check': 'như trên',
  'lõi ràng buộc tenant_roles tenant_roles_base_role_check': 'lõi 0002: vai do app đăng ký (đúng dạng khoá vai)',
  'lõi ràng buộc tenant_roles tenant_roles_code_check': 'như trên',
  'lõi ràng buộc user_role_assignments user_role_assignments_role_check': 'như trên',
  'lõi ràng buộc users users_role_check': 'như trên',
  'okt trigger business_documents business_documents_unit_ids': 'đơn vị kế toán của chứng từ — trigger kế toán, bỏ ở 0001',
  'okt trigger tenants tenants_seed_unit_names': 'gieo tên ĐVT — kế toán',
  'okt trigger tenants tenants_seed_warehouse_types': 'gieo loại kho — kế toán',
};

const mk = async (n) => { const a = new pg.Client({ connectionString: ADMIN }); await a.connect(); await a.query(`DROP DATABASE IF EXISTS ${n}`); await a.query(`CREATE DATABASE ${n}`); await a.end(); return ADMIN.replace(/\/[^/?]+(\?|$)/, `/${n}$1`); };
const drop = async (names) => { const a = new pg.Client({ connectionString: ADMIN }); await a.connect(); for (const n of names) await a.query(`DROP DATABASE IF EXISTS ${n}`); await a.end(); };
async function shape(url, tables) {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    const cols = (await c.query(`SELECT table_name t, column_name c, data_type d, is_nullable n FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1)`, [tables])).rows.map((r) => `cột ${r.t}.${r.c} ${r.d} ${r.n === 'YES' ? 'null' : 'not null'}`);
    const cons = (await c.query(`SELECT conrelid::regclass::text t, conname, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid::regclass::text = ANY($1)`, [tables])).rows.map((r) => `ràng buộc ${r.t} ${r.conname}|${r.def}`);
    const trg = (await c.query(`SELECT DISTINCT event_object_table t, trigger_name n FROM information_schema.triggers WHERE event_object_table = ANY($1)`, [tables])).rows.map((r) => `trigger ${r.t} ${r.n}`);
    const rls = (await c.query(`SELECT relname t, relrowsecurity a, relforcerowsecurity f FROM pg_class WHERE relname = ANY($1) AND relkind = 'r'`, [tables])).rows.map((r) => `rls ${r.t} ${r.a}/${r.f}`);
    return new Set([...cols, ...cons, ...trg, ...rls]);
  } finally { await c.end(); }
}

const names = ['oc_luoc_do_loi_test', 'oc_luoc_do_app_test'];
try {
  const core = await mk(names[0]);
  await runMigrations(() => {}, { connectionString: core, sources: [{ name: 'platform', dir: PLATFORM_MIGRATIONS_DIR }] });
  const c = new pg.Client({ connectionString: core }); await c.connect();
  const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'schema_migrations' ORDER BY 1")).rows.map((r) => r.tablename);
  await c.end();
  const app = await mk(names[1]);
  await runMigrations(() => {}, { connectionString: app, sources: [{ name: 'platform', dir: PLATFORM_MIGRATIONS_DIR }, { name: 'app', dir: path.resolve(APP) }], hooks: ketoanLegacyHooks });
  const A = await shape(core, tables), B = await shape(app, tables);
  // ràng buộc: so theo tên + định nghĩa; khoá DA_BIET theo tên (không kèm định nghĩa)
  const label = (side, x) => `${side} ${x.split('|')[0]}`;
  const out = [...[...B].filter((x) => !A.has(x)).map((x) => ['okt', x]), ...[...A].filter((x) => !B.has(x)).map((x) => ['lõi', x])];
  const known = out.filter(([s, x]) => DA_BIET[label(s, x)]);
  const bad = out.filter(([s, x]) => !DA_BIET[label(s, x)]);
  console.log(`bảng lõi: ${tables.length} · mục so: ${A.size} · khác có chủ ý: ${known.length} · khác LẠ: ${bad.length}`);
  for (const [s, x] of known) console.log(`  ~ ${label(s, x)} — ${DA_BIET[label(s, x)]}`);
  for (const [s, x] of bad) console.log(`  ✗ chỉ ${s}: ${x.replace('|', ': ').slice(0, 220)}`);
  const unused = Object.keys(DA_BIET).filter((k) => !out.some(([s, x]) => label(s, x) === k));
  for (const k of unused) console.log(`  ! DA_BIET thừa (đã hết khác): ${k}`);
  console.log(`KẾT LUẬN: ${bad.length ? 'KHÔNG ĐẠT' : 'ĐẠT'}`);
  process.exitCode = bad.length ? 1 : 0;
} finally { await drop(names); }
