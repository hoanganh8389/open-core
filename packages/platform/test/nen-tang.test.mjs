// [2026-11-28 12:18 AM Johnny Chu - Chu Hoàng Anh] C3 — thêm 0003 (users.external_sub), 0004 (tenant_secret_keys, tenant_secrets) gom từ open-ketoan
// [2026-11-24 06:15 PM Johnny Chu - Chu Hoàng Anh] P2b-2 — kiểm migration nền 0001_platform_nen_tang trên Postgres thật: đủ 26 bảng nền, không bảng kế toán,
//   nhật ký kiểm có chuỗi băm và chỉ thêm, RLS FORCE. Chạy: TEST_DATABASE_URL=… npm test. Không có TEST_DATABASE_URL ⇒ bỏ qua.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= url ?? 'postgres://x@localhost/x';
const { runMigrations } = await import('../dist/db/migrate.js');
const { PLATFORM_MIGRATIONS_DIR } = await import('../dist/db/paths.js');

const NEN = ['action_requests', 'api_keys', 'app_installations', 'audit_logs', 'business_documents', 'document_activities', 'document_attachments', 'document_links', 'document_sequences',
  'document_signatures', 'document_versions', 'event_deliveries', 'event_outbox', 'library_change_requests', 'library_settings', 'mcp_confirm_tokens', 'module_registry',
  'notification_reads', 'notifications', 'policy_registry', 'setting_values', 'tenant_modules', 'tenant_role_rules', 'tenant_roles', 'tenant_secret_keys', 'tenant_secrets', 'tenants', 'user_role_assignments', 'users'];

test('migration nền: đủ bảng nền, không bảng kế toán, nhật ký chỉ thêm có chuỗi băm, RLS FORCE', { skip: !url && 'không có TEST_DATABASE_URL' }, async () => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    assert.deepEqual(await runMigrations(() => {}, { connectionString: url, sources: [{ name: 'platform', dir: PLATFORM_MIGRATIONS_DIR }] }), ['0001_platform_nen_tang.sql', '0002_platform_vai_theo_app.sql', '0003_platform_external_sub.sql', '0004_platform_secrets.sql', '0005_platform_truc_chung_tu.sql']);
    const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY 1")).rows.map((r) => r.tablename);
    assert.deepEqual(tables, NEN);
    const { rows: [t] } = await c.query("INSERT INTO tenants (code, name) VALUES ('hoa-mai', 'Shop Hoa Mai') RETURNING id");
    await c.query("INSERT INTO audit_logs (tenant_id, actor, action, object_type, object_id) VALUES ($1, 'wp:1', 'a', 'x', '1'), ($1, 'wp:1', 'b', 'x', '2')", [t.id]);
    const { rows: [h] } = await c.query('SELECT count(*) FILTER (WHERE hash IS NOT NULL)::int AS h, count(*) FILTER (WHERE prev_hash IS NOT NULL)::int AS p FROM audit_logs');
    assert.deepEqual(h, { h: 2, p: 1 });
    await assert.rejects(c.query("UPDATE audit_logs SET action = 'sua'"), /chỉ được thêm/);
    const { rows: [f] } = await c.query("SELECT count(*)::int AS n FROM pg_class WHERE relforcerowsecurity AND relnamespace = 'public'::regnamespace");
    assert.ok(f.n >= 20, `RLS FORCE trên ${f.n} bảng`);
  } finally { await c.end(); }
});
