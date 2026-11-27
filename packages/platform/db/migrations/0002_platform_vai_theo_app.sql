-- [2026-11-24 06:20 PM Johnny Chu - Chu Hoàng Anh] P2b-3 — vai do APP khai (registerRoles), không còn danh sách vai kế toán viết cứng trong ràng buộc CSDL.
-- =============================================================================
-- 0002_platform_vai_theo_app — nới 4 ràng buộc từ "một trong các vai kế toán" thành "đúng dạng khoá vai" (^[a-z][a-z0-9_]{1,39}$, khớp ROLE_KEY_RE).
--   Vai có trong sổ hay không: kiểm ở tầng ứng dụng (isKnownRole) — vai sống trong code như sổ quyền (ADR-0027 D1).
--   GIỮ: vai nền của vai đơn vị không bao giờ là owner (D-AUTH-14); mã vai đơn vị không trùng `owner`.
--   open-ketoan khi chuyển sang gói: dữ liệu cũ đều đúng dạng mới (mọi vai cũ là chữ thường + _), không cần chuyển.
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role ~ '^[a-z][a-z0-9_]{1,39}$');
COMMENT ON CONSTRAINT users_role_check ON users IS 'Khoá vai đúng dạng; vai có trong sổ đăng ký (registerRoles) kiểm ở ứng dụng.';

ALTER TABLE user_role_assignments DROP CONSTRAINT user_role_assignments_role_check;
ALTER TABLE user_role_assignments ADD CONSTRAINT user_role_assignments_role_check CHECK (role IS NULL OR role ~ '^[a-z][a-z0-9_]{1,39}$');

ALTER TABLE tenant_roles DROP CONSTRAINT tenant_roles_base_role_check;
ALTER TABLE tenant_roles ADD CONSTRAINT tenant_roles_base_role_check CHECK (base_role IS NULL OR (base_role ~ '^[a-z][a-z0-9_]{1,39}$' AND base_role <> 'owner'));
COMMENT ON CONSTRAINT tenant_roles_base_role_check ON tenant_roles IS 'Vai nền của vai đơn vị: đúng dạng khoá vai, không bao giờ là owner (D-AUTH-14). Vai có trong sổ kiểm ở ứng dụng.';

ALTER TABLE tenant_roles DROP CONSTRAINT tenant_roles_code_check;
ALTER TABLE tenant_roles ADD CONSTRAINT tenant_roles_code_check CHECK (code ~ '^[a-z][a-z0-9_-]{1,39}$' AND code <> 'owner');
