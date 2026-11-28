// @bizcity-layer P ketoan-legacy
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 — KHU CÁCH LY (R-CORE-8, PHASE-004 · 30): mã + kiểu bảng chỉ open-ketoan dùng, dời ra khỏi lõi nhưng còn phát hành ở 0.7 để kế toán đổi nguồn một lần (Q-P4-5).
//   Mã lõi ngoài thư mục này KHÔNG import vào đây (kiem-ranh-gioi R-CACH-LY) — trừ tệp trỏ ở đường cũ. 0.8: open-ketoan mang cả thư mục về Kernel kế toán, lõi xoá (S004-W2-7).
import './db-types.js';
export type { KetoanLegacyTables } from './db-types.js';
export { resolveInstallation } from './pos-installation-auth.js';
import { sql } from 'kysely';
import { INSTALLATION_KEY_PREFIX, registerApiKeyResolver } from '../core/auth.js';
import { ketoanAuthzPreset } from '../core/authz-ketoan-legacy.js';
import { providePort } from '../core/ports.js';
import { MASTERDATA, type MasterdataPort, type OrgScopeInfo } from '../core/masterdata-port.js';
import { resolveInstallation } from './pos-installation-auth.js';

/**
 * [2026-11-29 12:55 AM Johnny Chu - Chu Hoàng Anh] S004-W2-9 (ADR-0001 D5, B-15) — nhà cấp cổng MASTERDATA của open-ketoan: ĐÚNG câu SQL lõi dùng trước đây (branches.unit_path 0174, kho → chi nhánh).
 *   0.8: về Kernel kế toán (đọc qua repository của Kernel).
 */
export const ketoanMasterdata = (tx: import('../db/client.js').Db, tenantId: string): MasterdataPort => ({
  async orgScopes(ids) {
    const out: OrgScopeInfo = { branch: {}, warehouse: {}, orgUnit: {} };
    if (ids.branch.length) for (const r of (await sql<{ id: string; code: string }>`SELECT id::text, code FROM branches WHERE tenant_id = ${tenantId} AND id = ANY(${[...ids.branch]}::bigint[])`.execute(tx)).rows) out.branch[r.id] = { code: r.code };
    if (ids.warehouse.length) for (const r of (await sql<{ id: string; branch_id: string; code: string }>`
      SELECT w.id::text, b.id::text AS branch_id, b.code FROM warehouses w JOIN branches b ON b.tenant_id = w.tenant_id AND b.id = w.branch_id
       WHERE w.tenant_id = ${tenantId} AND w.id = ANY(${[...ids.warehouse]}::bigint[])`.execute(tx)).rows) out.warehouse[r.id] = { branchId: r.branch_id, branchCode: r.code };
    if (ids.orgUnit.length) for (const r of (await sql<{ id: string; code: string; path: string; ids: string[]; codes: string[] }>`
      SELECT n.id::text, n.code, replace(n.unit_path, '/', chr(92)) AS path,
             coalesce(array_agg(b.id::text ORDER BY b.code) FILTER (WHERE b.id IS NOT NULL), '{}') AS ids, coalesce(array_agg(b.code ORDER BY b.code) FILTER (WHERE b.id IS NOT NULL), '{}') AS codes
        FROM branches n LEFT JOIN branches b ON b.tenant_id = n.tenant_id AND (b.unit_path = n.unit_path OR left(b.unit_path, length(n.unit_path) + 1) = n.unit_path || '/')
       WHERE n.tenant_id = ${tenantId} AND n.id = ANY(${[...ids.orgUnit]}::bigint[]) GROUP BY n.id, n.code, n.unit_path`.execute(tx)).rows) out.orgUnit[r.id] = { code: r.code, path: r.path, branchIds: r.ids, branchCodes: r.codes };
    return out;
  },
});

let installed = false;
/**
 * open-ketoan gọi một lần lúc khởi động, TRƯỚC buildApp (sau khi đổi nguồn sang lõi 0.7): đăng ký mọi móc của phần chuyển tiếp —
 * vai / quyền (ketoanAuthzPreset, R-1), khoá cài đặt open-pos `okti_` (B-13), cổng MASTERDATA (B-15).
 */
export function installKetoanLegacy(): void {
  if (installed) return;
  installed = true;
  ketoanAuthzPreset();
  registerApiKeyResolver({ prefix: INSTALLATION_KEY_PREFIX, resolve: resolveInstallation });
  providePort(MASTERDATA, (c) => ketoanMasterdata(c.tx, c.tenantId));
}
// [2026-11-29 12:45 AM Johnny Chu - Chu Hoàng Anh] S004-W1-7a (E-7) — danh sách vai TĨNH của kế toán như core/authz/legacy cũ (lõi nay đọc sổ vai lúc chạy: systemRoleKeys()).
//   Lõi không giữ danh sách vai cứng (R-VAI) — lõi dùng systemRoleKeys() đọc sổ vai; codemod đổi nguồn trỏ import cũ về đây. 0.8: về open-ketoan.
import { ROLES, type Role } from '@bizcity/contracts';
export const SYSTEM_ROLES = Object.values(ROLES) as Role[];
