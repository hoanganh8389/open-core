// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 — sinh tệp khai báo người dùng · vai · quyền của một app (bizcity_authz_manifest@1)
//   TỪ CHÍNH các sổ đăng ký đang chạy (registerModulePermissions, registerRoles, registerApiScopes), để bộ kiểm chung
//   (bizcity-platform tools/users-check.mjs) đọc được mà không phải chạy app. App gọi sau khi đăng ký xong, ghi ra bizcity.authz.json.
//   Chuẩn: docs/standard/BIZCITY-USERS-ROLES-v1.md §3.
import { PERMISSIONS, listModulePermissions } from './auth.js';
import { OWNER_ROLE, listApiScopes, listRoles, scopePermissionKeys } from './roles.js';

/** Khoá user meta một app dùng (≈ wp_usermeta). Bảng: user_meta(tenant_id, user_id, key, value jsonb). */
export interface UserMetaKeyDef {
  key: string;
  label: string;
  type: 'string' | 'text' | 'int' | 'bool' | 'date' | 'enum' | 'string[]' | 'json';
  pii?: boolean;
}

/** Khoá cài đặt một app dùng (setting_values của nền). */
export interface SettingKeyDef {
  key: string;
  label: string;
  scopes: string[]; // [2026-11-28 09:52 PM Johnny Chu - Chu Hoàng Anh] S004-W2-4 — bậc do app đăng ký (registerSettingScopes), không còn liệt kê cứng accounting_unit
  permission: string;
}

export interface AuthzManifest {
  schema: 'bizcity_authz_manifest@1';
  app: string;
  core_permissions: string[];
  permissions: { key: string; label: string; risk: 'low' | 'high'; module: string }[];
  roles: { key: string; label: string; admin: boolean; permissions: string[] }[];
  api_scopes: Record<string, string[]>;
  user_meta: UserMetaKeyDef[];
  settings: SettingKeyDef[];
}

/**
 * Ảnh chụp sổ đăng ký hiện tại. `app` = id trong bizcity.app.json. Vai `owner` của nền không xuất (mọi app đều có, không sửa được).
 * Thứ tự ổn định (sắp theo khoá) để tệp sinh ra so sánh được trong git.
 */
export function authzManifest(app: string, extra: { userMeta?: readonly UserMetaKeyDef[]; settings?: readonly SettingKeyDef[] } = {}): AuthzManifest {
  const byKey = <T extends { key: string }>(a: T, b: T) => a.key.localeCompare(b.key);
  return {
    schema: 'bizcity_authz_manifest@1',
    app,
    core_permissions: [...PERMISSIONS].sort(),
    permissions: listModulePermissions().map((p) => ({ key: p.key, label: p.label, risk: p.risk === 'high' ? 'high' as const : 'low' as const, module: p.module })).sort(byKey),
    roles: listRoles().filter((r) => r.key !== OWNER_ROLE).map((r) => ({ key: r.key, label: r.label, admin: Boolean(r.admin), permissions: [...new Set(r.permissions)].sort() })).sort(byKey),
    api_scopes: Object.fromEntries(listApiScopes().map((s) => [s, [...scopePermissionKeys(s)].sort()])),
    user_meta: [...(extra.userMeta ?? [])].sort(byKey),
    settings: [...(extra.settings ?? [])].sort(byKey),
  };
}
