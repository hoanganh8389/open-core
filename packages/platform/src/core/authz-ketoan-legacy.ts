// @bizcity-layer P permissions
// [2026-11-24 06:20 PM Johnny Chu - Chu Hoàng Anh] P2b-3 — bộ cấu hình vai / quyền / phạm vi khoá RIÊNG của open-ketoan, giữ NGUYÊN bảng ROLE_PERMISSIONS,
//   SCOPE_PERMISSIONS và siêu dữ liệu 6 quyền kế toán như open-ketoan 6ad77b6. App khác KHÔNG gọi. open-ketoan gọi ketoanAuthzPreset() lúc khởi động
//   khi chuyển sang gói (P6), rồi tệp này về lại open-ketoan.
import { ROLE_LABELS } from '@bizcity/contracts';
import { registerModulePermissions } from './auth.js';
import { registerApiScopes, registerRoles } from './roles.js';

let done = false;

export function ketoanAuthzPreset(): void {
  if (done) return;
  done = true;
  // 6 quyền trước là Core, nay là quyền module (tiền tố = khoá module). Chuỗi quyền GIỮ NGUYÊN (D-AUTH-02).
  registerModulePermissions('catalog', [
    { key: 'catalog:read', label: 'Xem danh mục', risk: 'low', resource: 'catalog', operation: 'read' },
    { key: 'catalog:write', label: 'Thêm / sửa danh mục', risk: 'low', resource: 'catalog', operation: 'update' },
  ]);
  registerModulePermissions('ledger', [{ key: 'ledger:read', label: 'Xem sổ cái', risk: 'low', resource: 'ledger', operation: 'read', aliases: ['tgs:ACC3', 'tgs:ACC88'] }]);
  registerModulePermissions('payments', [
    { key: 'payments:approve', label: 'Duyệt yêu cầu thanh toán cấp 1', risk: 'high', resource: 'payment_request', operation: 'approve', scopeKinds: ['branch'] },
    { key: 'payments:approve-final', label: 'Duyệt yêu cầu thanh toán cấp 2 (vượt ngưỡng)', risk: 'high', resource: 'payment_request', operation: 'approve', scopeKinds: ['branch'] },
  ]);
  registerModulePermissions('periods', [{ key: 'periods:lock', label: 'Khoá / mở kỳ kế toán', risk: 'high', resource: 'period', operation: 'manage' }]);

  const viewer = ['catalog:read', 'documents:read', 'ledger:read', 'reports:read', 'conformance:read'];
  registerRoles('ketoan', [
    { key: 'chief_accountant', label: ROLE_LABELS.chief_accountant, permissions: ['catalog:read', 'catalog:write', 'documents:read', 'documents:write', 'documents:edit-all', 'documents:bypass-date-lock', 'payments:approve', 'ledger:read', 'reports:read', 'periods:lock', 'settings:write', 'conformance:read', 'conformance:run', 'conformance:approve', 'review:read'] },
    { key: 'accountant', label: ROLE_LABELS.accountant, permissions: ['catalog:read', 'catalog:write', 'documents:read', 'documents:write', 'ledger:read', 'reports:read', 'conformance:read', 'conformance:run', 'review:read'] },
    { key: 'viewer', label: ROLE_LABELS.viewer, permissions: viewer },
    { key: 'developer', label: ROLE_LABELS.developer, permissions: [...viewer, 'devtools:read'] },
    { key: 'auditor', label: ROLE_LABELS.auditor, permissions: [...viewer, 'review:read'] },
    { key: 'staff', label: ROLE_LABELS.staff, permissions: ['catalog:read'] },
  ]);
  registerApiScopes('ketoan', {
    'documents:write': ['catalog:read'],
    'reports:read': ['ledger:read', 'catalog:read'],
    'catalog:write': ['catalog:write', 'catalog:read'],
  });
}
