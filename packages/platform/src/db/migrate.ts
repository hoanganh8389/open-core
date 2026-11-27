// @bizcity-layer P+A data
// [2026-11-08 11:33 AM Johnny Chu - Chu Hoàng Anh] PHASE-029 — sửa trùng số migration 0080 (W2a và gói K3 cùng merge): RENAMED thêm 0081_nguoi_tao_su_viec_bat_buoc, 0082_khoa_ky_o_csdl (R-DB-3)
// [2026-10-29 10:24 PM Johnny Chu - Chu Hoàng Anh] INIT — khởi tạo Bizcity Core Framework: sổ cái chỉ thêm, cửa nạp sự việc, CANON, hợp đồng, bộ kiểm chuẩn.
// [2026-10-30 12:37 AM Johnny Chu - Chu Hoàng Anh] PHASE-001 — migration đúng chuẩn, vai trò CSDL thường cho API, bộ test xanh.
// [2026-10-30 09:58 AM Johnny Chu - Chu Hoàng Anh] PHASE-002 — nhãn lớp @bizcity-layer, đồ thị phụ thuộc mốc, bản nháp API module-sdk.
// [2026-10-30 09:23 PM Johnny Chu - Chu Hoàng Anh] PHASE-007 — cô lập đơn vị bằng RLS.
// [2026-11-01 04:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-010 — dời từ apps/api/src/db/migrate.ts sang packages/platform (@bizcity/platform, D010-7 chặng 2); import tương đối viết lại theo chỗ mới
// [2026-11-22 11:16 AM Johnny Chu - Chu Hoàng Anh] PHASE-039 — B3 (D039-11/12, R-SITE-9): chuỗi kết nối + thư mục theo tham số; phiên bản lược đồ = tên migration cuối.
// [2026-11-24 06:03 PM Johnny Chu - Chu Hoàng Anh] P2b-1 — trình chạy CHUNG mọi app: nhiều nguồn (sources: nền 00xx + app 01xx…, trùng tên ⇒ dừng, D-PLAT-5);
//   phần riêng của open-ketoan (gộp file gốc, đổi tên, xuất nhật ký cũ) ra cổng `hooks` (R-PLAT-2) — xem migrate-ketoan-legacy.ts.
/**
 * Chạy migration: áp lần lượt các file NNNN_ten.sql chưa chạy, gộp từ một hoặc nhiều thư mục nguồn, theo thứ tự tên.
 *
 * - Mỗi file chạy trong một giao dịch; lỗi thì dừng, không ghi nhận.
 * - Đã chạy thì ghi vào bảng schema_migrations (tên tệp), lần sau bỏ qua.
 * - Hai nguồn có cùng tên tệp ⇒ dừng trước khi chạm DB (mỗi app một dải số).
 * - Không sửa file đã chạy ở môi trường thật; muốn đổi thì thêm file mới.
 */
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';
import { MIGRATIONS_DIR } from './paths.js';

const FILE_RE = /^\d{4}_.+\.sql$/;

/** Một thư mục migration có tên (vd `platform`, `cake`). */
export interface MigrationSource { name: string; dir: string }

/** Phần client tối thiểu trình chạy cần — hook nhận cùng kiểu. */
export interface MigrationClient { query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>> }

/** Cổng cho phần riêng của từng app (R-PLAT-2). Mặc định không có gì. */
export interface MigrationHooks {
  /** Trước khi áp: ghi nhận file đã có bằng đường khác (gộp gốc, đổi tên…), thêm vào `done`. */
  beforeApply?(c: MigrationClient, done: Set<string>, log: (m: string) => void): Promise<void>;
  /** Sau khi áp xong (vẫn giữ khoá). */
  afterApply?(c: MigrationClient, log: (m: string) => void): Promise<void>;
  /** Cho pendingMigrations: file này coi như đã áp dù chưa có trong schema_migrations. */
  isApplied?(file: string, done: Set<string>): boolean;
}

export interface MigrationSet {
  /** Một thư mục (cách cũ); trống = db/migrations. Bỏ qua khi có `sources`. */
  dir?: string;
  /** Nhiều thư mục — gộp theo tên tệp. */
  sources?: MigrationSource[];
}

export interface RunMigrationsOptions extends MigrationSet {
  /** Database cần nâng; trống = DATABASE_URL. */
  connectionString?: string;
  hooks?: MigrationHooks;
}

export type PlannedMigration = { file: string; source: string; full: string };

const sourcesOf = (o: MigrationSet): MigrationSource[] => (o.sources?.length ? o.sources : [{ name: 'app', dir: o.dir ?? MIGRATIONS_DIR }]);

/** Danh sách tệp của mọi nguồn, theo tên. Trùng tên giữa hai nguồn ⇒ lỗi (D-PLAT-5: mỗi app một dải số). */
export function planMigrations(o: MigrationSet = {}): PlannedMigration[] {
  const seen = new Map<string, string>();
  const out: PlannedMigration[] = [];
  for (const s of sourcesOf(o)) {
    for (const file of readdirSync(s.dir).filter((f) => FILE_RE.test(f))) {
      const other = seen.get(file);
      if (other !== undefined) throw new Error(`Migration ${file} có ở cả nguồn "${other}" và "${s.name}" — mỗi app một dải số (D-PLAT-5).`);
      seen.set(file, s.name);
      out.push({ file, source: s.name, full: path.join(s.dir, file) });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export async function runMigrations(log: (msg: string) => void = console.log, opts: RunMigrationsOptions = {}): Promise<string[]> {
  // Kết nối RIÊNG bằng vai trò của DATABASE_URL (chủ sở hữu bảng), không mượn pool của API: kết nối trong pool có thể đã chuyển
  // sang vai trò ứng dụng (DB_SET_ROLE) hoặc gắn đơn vị (RLS) — migration cần quyền DDL và thấy đủ mọi đơn vị.
  const plan = planMigrations(opts);
  const client = new pg.Client({ connectionString: opts.connectionString ?? env.DATABASE_URL });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    // Khoá để hai tiến trình khởi động cùng lúc không chạy migration hai lần.
    await client.query('SELECT pg_advisory_lock(727001)');
    try {
      const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
      await opts.hooks?.beforeApply?.(client, done, log);
      for (const m of plan) {
        if (done.has(m.file)) continue;
        const sql = await readFile(m.full, 'utf8');
        log(`→ Áp migration ${m.file}${m.source === 'app' ? '' : ` (${m.source})`}`);
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m.file]);
          await client.query('COMMIT');
          applied.push(m.file);
        } catch (err) {
          await client.query('ROLLBACK');
          // [2026-11-22 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-038 — B1b (G12): giữ lỗi gốc của Postgres (mã PG, bảng, ràng buộc, stack) trong cause
          throw new Error(`Migration ${m.file} lỗi: ${(err as Error).message}`, { cause: err });
        }
      }
      await opts.hooks?.afterApply?.(client, log);
    } finally {
      await client.query('SELECT pg_advisory_unlock(727001)');
    }
    return applied;
  } finally {
    await client.end();
  }
}

/** Phiên bản lược đồ bản ứng dụng này cần: tên tệp migration cuối cùng của mọi nguồn (cổng lược đồ, R-SITE-9). */
export function requiredSchemaVersion(set: string | MigrationSet = {}): string {
  const plan = planMigrations(typeof set === 'string' ? { dir: set } : set);
  return plan[plan.length - 1]?.file ?? '';
}

/** Phiên bản lược đồ của một database: tên migration lớn nhất đã áp (không tính migration module `key/…`). Chưa có bảng schema_migrations → null. */
export async function appliedSchemaVersion(c: { query: (q: string) => Promise<{ rows: Array<{ v: string | null }> }> }): Promise<string | null> {
  if (!(await c.query("SELECT to_regclass('public.schema_migrations')::text AS v")).rows[0]?.v) return null;
  const r = await c.query("SELECT max(name) AS v FROM schema_migrations WHERE name ~ '^[0-9]{4}_'");
  return r.rows[0]?.v ?? null;
}

/** Các file migration CHƯA áp (API dùng khi khởi động: thiếu thì không chạy, báo chạy job db-migrate). */
export async function pendingMigrations(q: MigrationClient, opts: MigrationSet & { hooks?: MigrationHooks } = {}): Promise<string[]> {
  const files = planMigrations(opts).map((m) => m.file);
  const has = await q.query<{ ok: boolean }>("SELECT to_regclass('schema_migrations') IS NOT NULL AS ok");
  if (!has.rows[0]?.ok) return files;
  const done = new Set((await q.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  return files.filter((f) => !done.has(f) && !opts.hooks?.isApplied?.(f, done));
}

// Chạy trực tiếp bằng dòng lệnh: một thư mục (DB_DIR/migrations), không hook.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then((list) => console.log(list.length ? `Đã áp ${list.length} migration.` : 'Cơ sở dữ liệu đã mới nhất.'))
    .catch((err) => { console.error(err.message); process.exit(1); });
}
