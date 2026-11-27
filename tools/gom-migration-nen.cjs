// [2026-11-24 06:15 PM Johnny Chu - Chu Hoàng Anh] P2b-2 — ghép migration nền 0001_platform_nen_tang.sql từ lược đồ open-ketoan (không phụ thuộc gói ngoài, R-PLAT-5).
// Cách tạo lại: (1) áp đủ migration open-ketoan vào Postgres trống: runMigrations({ dir: <okt>/db/migrations, hooks: ketoanLegacyHooks });
//   (2) pg_dump --schema-only --no-owner --no-privileges -t public.<26 bảng nền> > dump.sql (danh sách ở packages/platform/test/nen-tang.test.mjs);
//   (3) psql -At -c "select pg_get_functiondef(oid)||';' from pg_proc where proname in (<16 hàm>)" > funcs.sql;
//   (4) node tools/gom-migration-nen.cjs dump.sql funcs.sql packages/platform/db/migrations/0001_platform_nen_tang.sql
//   Bỏ phần kế toán: 3 trigger (gieo tên ĐVT, gieo loại kho, đơn vị của chứng từ) + khoá ngoại document_signatures.event_id → accounting_events.
const fs = require('fs');
const [dumpP, funcsP, outP] = process.argv.slice(2);
const dump = fs.readFileSync(dumpP, 'utf8').replace(/\r\n/g, '\n');
const funcs = fs.readFileSync(funcsP, 'utf8').replace(/\r\n/g, '\n');
// tách theo khối "--\n-- Name: ..." của pg_dump
const blocks = dump.split(/\n(?=--\n-- Name: )/);
const drop = [/business_documents_unit_ids; Type: TRIGGER/, /tenants_seed_unit_names; Type: TRIGGER/, /tenants_seed_warehouse_types; Type: TRIGGER/, /document_signatures_event_id_fkey; Type: FK CONSTRAINT/];
const bad = (l) => l.startsWith('\\restrict ') || l.startsWith('\\unrestrict ') || l.startsWith('SET ') || l.startsWith('SELECT pg_catalog.set_config');
const kept = [];
let dropped = 0;
for (const b of blocks) {
  if (!b.startsWith('--\n-- Name: ')) continue; // phần đầu: SET, search_path, \restrict…
  if (drop.some((r) => r.test(b))) { dropped++; continue; }
  kept.push(b.split('\n').filter((l) => !bad(l)).join('\n').trimEnd());
}
const head = [
  '-- [2026-11-24 06:15 PM Johnny Chu - Chu Hoàng Anh] P2b-2 — migration NỀN của @bizcity/platform (dải 00xx, D-PLAT-5), gom từ open-ketoan 6ad77b6 (178 migration áp đủ → pg_dump 26 bảng nền + 16 hàm).',
  '-- =============================================================================',
  '-- 0001_platform_nen_tang — bảng nền mọi app dùng chung: đơn vị · người dùng · vai / luật vai / gán vai · khoá API · app cài đặt · module ·',
  '--   nhật ký kiểm (chuỗi băm) · yêu cầu action (idempotency) · outbox sự kiện + giao · cài đặt · chính sách · thư viện · thông báo · MCP xác nhận ·',
  '--   chứng từ dùng chung (business_documents, phiên bản, đính kèm, ký, liên kết, số chứng từ). RLS FORCE như open-ketoan.',
  '--   BỎ so với open-ketoan (phần kế toán, R-PLAT-1): trigger tenants_seed_unit_names, tenants_seed_warehouse_types, business_documents_unit_ids;',
  '--   khoá ngoại document_signatures.event_id → accounting_events (cột giữ, NULL được; ký theo doc_ref).',
  '--   Tên tệp có tiền tố platform_ để không trùng tên migration riêng của app; open-ketoan khi chuyển sang gói (P6) ghi nhận tệp này bằng hook',
  '--   (bảng đã có), không chạy lại.',
  '-- =============================================================================',
  '',
].join('\n');
// Hàm đặt SAU bảng (audit_log_hash nhận kiểu dòng audit_logs), TRƯỚC trigger / policy dùng chúng.
const firstTrig = kept.findIndex((b) => /; Type: TRIGGER;/.test(b));
const tables = kept.slice(0, firstTrig), rest = kept.slice(firstTrig);
const out = head + '\n-- ── Bảng, chỉ mục, ràng buộc (pg_dump) ───────────────────────────────────────\n' + tables.join('\n\n')
  + '\n\n-- ── Hàm dùng chung (sau bảng: có hàm nhận kiểu dòng) ─────────────────────────\n' + funcs.trim()
  + '\n\n-- ── Trigger, khoá ngoại, RLS (pg_dump) ───────────────────────────────────────\n' + rest.join('\n\n') + '\n';
fs.writeFileSync(outP, out);
console.log('khối giữ', kept.length, 'bỏ', dropped, 'dòng', out.split('\n').length);
