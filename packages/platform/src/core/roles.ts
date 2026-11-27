// @bizcity-layer P permissions
// [2026-11-24 06:20 PM Johnny Chu - Chu Hoàng Anh] P2b-3 — cổng đăng ký VAI và PHẠM VI KHOÁ API (R-PLAT-2): nền chỉ có sẵn `owner` (quản trị cao, mọi quyền);
//   mỗi app khai vai của mình lúc khởi động — open-ketoan dùng ketoanAuthzPreset() (authz-ketoan-legacy.ts), open-cake khai vai CRM. Gỡ điểm chặn P2b số 3.
/**
 * Sổ vai nằm trong CODE (như sổ quyền, ADR-0027 D1); `users.role`, `tenant_roles.base_role` lưu khoá vai.
 *
 *   registerRoles('cake', [{ key: 'sale', label: 'Nhân viên bán hàng', permissions: ['cake:inbox-xem', 'cake:message-gui'] }]);
 *   registerApiScopes('cake', { 'cake:inbox': ['cake:inbox-xem'] });
 *
 * - Khoá vai `^[a-z][a-z0-9_]{1,39}$`, không trùng giữa các app; `owner` thuộc nền, không khai lại.
 * - `admin: true` ⇒ vai quản trị cao (ADMIN_ROLES): mọi quyền, không bị luật Cấm (D-AUTH-03).
 * - Quyền module khai `roles: [...]` vẫn được cộng cho vai đó như trước (registerModulePermissions).
 */
export type Role = string;

export interface RoleDef {
  key: Role;
  label: string;
  /** Vai quản trị cao: nhận mọi quyền Core + module. */
  admin?: boolean;
  /** Quyền Core / module vai này có (không gồm quyền module tự khai `roles`). */
  permissions: readonly string[];
}

export const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,39}$/;
export const OWNER_ROLE: Role = 'owner';

const roles = new Map<Role, RoleDef & { app: string }>([[OWNER_ROLE, { key: OWNER_ROLE, label: 'Chủ sở hữu', admin: true, permissions: [], app: 'platform' }]]);
const adminRoles = new Set<Role>([OWNER_ROLE]);

/** Vai quản trị cao — đọc sống từ sổ (vai `admin: true` khai sau cũng có mặt). */
export const ADMIN_ROLES: ReadonlySet<Role> = adminRoles;

export function registerRoles(app: string, defs: readonly RoleDef[]): void {
  for (const d of defs) {
    if (!ROLE_KEY_RE.test(d.key)) throw new Error(`Vai "${d.key}" phải dạng ${ROLE_KEY_RE}`);
    const cur = roles.get(d.key);
    if (cur && cur.app !== app) throw new Error(`Vai "${d.key}" đã thuộc ${cur.app}`);
    roles.set(d.key, { ...d, app });
    if (d.admin) adminRoles.add(d.key); else adminRoles.delete(d.key);
  }
}

export const roleDef = (key: string): (RoleDef & { app: string }) | undefined => roles.get(key);
export const isKnownRole = (key: string): boolean => roles.has(key);
export const listRoles = (): (RoleDef & { app: string })[] => [...roles.values()];

// ── Phạm vi khoá API → quyền ────────────────────────────────────────────────
/** phạm vi → (app → quyền app đó khai). Giữ nguồn để biết ai cộng gì. */
const scopes = new Map<string, Map<string, readonly string[]>>();

/** Khai phạm vi khoá API; hai app khai cùng phạm vi thì quyền được HỢP lại. */
export function registerApiScopes(app: string, map: Readonly<Record<string, readonly string[]>>): void {
  for (const [scope, perms] of Object.entries(map)) {
    const byApp = scopes.get(scope) ?? new Map<string, readonly string[]>();
    byApp.set(app, [...new Set([...(byApp.get(app) ?? []), ...perms])]);
    scopes.set(scope, byApp);
  }
}

export const scopePermissionKeys = (scope: string): readonly string[] => [...new Set([...(scopes.get(scope)?.values() ?? [])].flat())];
export const listApiScopes = (): string[] => [...scopes.keys()].sort();

/** Chỉ cho test: đưa sổ về trạng thái nền (giữ owner và phạm vi của nền). */
export function resetRolesForTest(): void {
  for (const k of [...roles.keys()]) if (k !== OWNER_ROLE) roles.delete(k);
  for (const k of [...adminRoles]) if (k !== OWNER_ROLE) adminRoles.delete(k);
  for (const [scope, byApp] of scopes) {
    for (const app of [...byApp.keys()]) if (app !== 'platform') byApp.delete(app);
    if (!byApp.size) scopes.delete(scope);
  }
}
