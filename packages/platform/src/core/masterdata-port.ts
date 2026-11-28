// @bizcity-layer P core/ports
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-29 12:55 AM Johnny Chu - Chu Hoàng Anh] S004-W2-9 (ADR-0001 D5, B-15) — cổng MASTERDATA: lõi hỏi CHỦ danh mục (open-ketoan) về cây đơn vị / kho
//   thay cho SQL đọc thẳng `branches` / `warehouses`. Cùng tiến trình (ngoài tiến trình: API + changefeed của chủ). Khác `entity_links` (lane T):
//   cổng này TRA danh mục của chủ; entity_links ÁNH XẠ ID xuyên instance (LANES §3).
//   Chỉ khai hàm đã có người gọi (R-PLAT-3): `orgScopes` cho phạm vi vai. `resolveItem` / `resolveEntity` (ADR-0001 D5) thêm khi có chỗ gọi.
import type { Db } from '../db/client.js';
import { definePort, findPort } from './ports.js';

/** Định danh (bigint dạng chuỗi) cần tra, theo loại phạm vi của lần gán vai. */
export interface OrgScopeIds { branch: readonly string[]; warehouse: readonly string[]; orgUnit: readonly string[] }

/** Kết quả tra; định danh không có ở chủ thì KHÔNG có khoá (lõi coi là không cấp phạm vi đó). */
export interface OrgScopeInfo {
  branch: Record<string, { code: string }>;
  warehouse: Record<string, { branchId: string; branchCode: string }>;
  /** `path` nối bằng `\` (ORG_PATH_SEP của bộ máy quyền); `branchIds` / `branchCodes`: chính nút + mọi chi nhánh trong cây con. */
  orgUnit: Record<string, { code: string; path: string; branchIds: string[]; branchCodes: string[] }>;
}

export interface MasterdataPort {
  orgScopes(ids: OrgScopeIds): Promise<OrgScopeInfo>;
}

export const MASTERDATA = definePort<MasterdataPort>('masterdata');

/** Cổng cho mã lõi chạy ngoài action (bộ máy quyền): chỉ đọc. Chưa có nhà cấp ⇒ undefined — nơi gọi phải ĐÓNG (không cấp phạm vi). */
export function masterdataFor(conn: Db, tenantId: string, actionId: string): MasterdataPort | undefined {
  return findPort<MasterdataPort>(MASTERDATA.name, { tx: conn, auth: undefined, tenantId, actionId, effect: 'read', dryRun: false });
}

export const EMPTY_ORG_SCOPES: OrgScopeInfo = { branch: {}, warehouse: {}, orgUnit: {} };
