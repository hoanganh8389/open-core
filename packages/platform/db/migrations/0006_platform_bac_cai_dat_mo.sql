-- [2026-11-28 09:52 PM Johnny Chu - Chu Hoàng Anh] S004-W2-4 (PHASE-004 Q-P4-4, R-CORE-8) — bậc cài đặt MỞ: bỏ ràng buộc liệt kê cứng accounting_unit trong thang cài đặt của lõi.
-- =============================================================================
-- 0006 Bậc cài đặt do app khai.
--   Lõi 0001 có setting_values_scope_type_check = ('tenant', 'accounting_unit', 'branch', 'user') — bậc kế toán viết cứng trong hạ tầng dùng chung.
--   Nay: ràng buộc chỉ kiểm KHUÔN tên bậc (chữ thường / số / gạch dưới); bậc nào hợp lệ do mã kiểm lúc ghi theo sổ đăng ký (registerSettingScopes).
--   Giữ nguyên setting_values_scope_chk: scope_type = 'tenant' ⇔ scope_id rỗng. Dòng cũ đều hợp lệ (tên bậc cũ khớp khuôn mới). Chạy lại vô hại.
-- =============================================================================
ALTER TABLE setting_values DROP CONSTRAINT IF EXISTS setting_values_scope_type_check;
ALTER TABLE setting_values ADD CONSTRAINT setting_values_scope_type_check CHECK (scope_type ~ '^[a-z][a-z0-9_]{1,30}$');
COMMENT ON COLUMN setting_values.scope_type IS 'Bậc cài đặt: tenant | branch | user + bậc do app khai (registerSettingScopes, vd accounting_unit của kế toán); hẹp thắng trước (0006).';
