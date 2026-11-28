// [2026-11-28 07:41 PM Johnny Chu - Chu Hoàng Anh] S001-T — khung test chạy thật cho lõi: mỗi tệp test một CSDL mới trên máy chủ TEST_DATABASE_URL,
// áp migration lõi (packages/platform/db/migrations), rồi mới nạp mã dist (mã đọc DATABASE_URL lúc nạp). Không có TEST_DATABASE_URL ⇒ test CSDL bỏ qua.
// Dựng máy chủ thử: docker run -d --name oc-test-pg -e POSTGRES_USER=octest -e POSTGRES_PASSWORD=octest -p 127.0.0.1:55499:5432 postgres:16-alpine
//                  TEST_DATABASE_URL=postgres://octest:octest@127.0.0.1:55499/postgres pnpm test
import pg from 'pg';

export const base = process.env.TEST_DATABASE_URL;
export const skip = !base && 'không có TEST_DATABASE_URL';

/** Tạo CSDL mới `name` (xoá nếu còn từ lần trước), áp migration lõi, đặt DATABASE_URL. Trả URL; không có máy chủ thử ⇒ undefined. */
export async function csdlMoi(name) {
  process.env.NODE_ENV = 'test';
  process.env.OTEL_SDK_DISABLED = 'true';
  if (!base) { process.env.DATABASE_URL ??= 'postgres://x@localhost/x'; return undefined; }
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
    // Vai ứng dụng (không phải chủ bảng) để RLS có hiệu lực. Lõi không cấp quyền cho vai của app (R-PLAT-1) — app tự cấp; ở đây làm thay app.
    await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oc_app') THEN CREATE ROLE oc_app NOLOGIN; END IF; END $$`);
  } finally { await admin.end(); }
  const u = new URL(base); u.pathname = `/${name}`;
  const url = u.toString();
  process.env.DATABASE_URL = url;
  const { runMigrations } = await import('../dist/db/migrate.js');
  const { PLATFORM_MIGRATIONS_DIR } = await import('../dist/db/paths.js');
  await runMigrations(() => {}, { connectionString: url, sources: [{ name: 'core', dir: PLATFORM_MIGRATIONS_DIR }] });
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try { await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oc_app; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO oc_app'); } finally { await c.end(); }
  return url;
}

/** Thêm một đơn vị, trả id dạng chuỗi. */
export async function themDonVi(url, code) {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    const r = await c.query('INSERT INTO tenants (id, code, name) VALUES ((SELECT coalesce(max(id), 0) + 1 FROM tenants), $1, $1) RETURNING id', [code]);
    return String(r.rows[0].id);
  } finally { await c.end(); }
}

/** Ngữ cảnh người gọi tối thiểu cho runAction. */
export const nguoi = (tenantId, id, ...perms) => ({ tenantId, actor: `user:${id}`, actorName: `Người ${id}`, kind: 'user', role: null, permissions: new Set(perms) });

/** Mã lỗi của một lời gọi (OK nếu không lỗi). */
export async function ma(p) { try { await p; return 'OK'; } catch (e) { return e?.code ?? (e?.issues ? 'ZOD' : e?.message); } }
