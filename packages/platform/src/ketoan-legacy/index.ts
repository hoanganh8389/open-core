// @bizcity-layer P ketoan-legacy
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 — KHU CÁCH LY (R-CORE-8, PHASE-004 · 30): mã + kiểu bảng chỉ open-ketoan dùng, dời ra khỏi lõi nhưng còn phát hành ở 0.7 để kế toán đổi nguồn một lần (Q-P4-5).
//   Mã lõi ngoài thư mục này KHÔNG import vào đây (kiem-ranh-gioi R-CACH-LY) — trừ tệp trỏ ở đường cũ. 0.8: open-ketoan mang cả thư mục về Kernel kế toán, lõi xoá (S004-W2-7).
import './db-types.js';
export type { KetoanLegacyTables } from './db-types.js';
export { installKetoanLegacy, resolveInstallation } from './pos-installation-auth.js';
// [2026-11-29 12:45 AM Johnny Chu - Chu Hoàng Anh] S004-W1-7a (E-7) — danh sách vai TĨNH của kế toán như core/authz/legacy cũ (lõi nay đọc sổ vai lúc chạy: systemRoleKeys()).
//   Lõi không giữ danh sách vai cứng (R-VAI) — lõi dùng systemRoleKeys() đọc sổ vai; codemod đổi nguồn trỏ import cũ về đây. 0.8: về open-ketoan.
import { ROLES, type Role } from '@bizcity/contracts';
export const SYSTEM_ROLES = Object.values(ROLES) as Role[];
