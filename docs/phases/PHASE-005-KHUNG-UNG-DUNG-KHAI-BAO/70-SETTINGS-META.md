# PHASE-005 · 70 — Settings / Meta Framework (WordPress × Odoo)

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-10: Settings / Meta kết hợp tư duy WordPress (options / meta) và Odoo (config parameters / company-dependent fields). -->

## 1. Bảng đối chiếu của chủ ↔ open-core

| WordPress | Odoo | open-core nên có | Đã có | Thiếu |
|---|---|---|---|---|
| Options | Config Parameters | **Settings Registry** | `defineSetting` / `registerModuleSettings`, `setting_values`, có phiên bản theo `valid_from`, căn cứ pháp lý (`basis`), phân tích ảnh hưởng (`settingImpact`), lịch sử (`settingHistory`) | `defineSetting` một tên; màn Cài đặt sinh từ registry |
| User Meta | User Fields | **User Meta** | `user_meta` ở open-cake 0103 (S003-2 chờ lõi hoá) | lõi hoá + `ctx.userMeta` + registry khoá |
| Post Meta | Model Fields | **Entity Meta** | `entity_meta` ở open-cake 0103 | lõi hoá, gắn Entity Registry (`storage: 'meta'`, [20](20-ENTITY-REGISTRY.md)) |
| Network Settings | Company Settings | **Workspace Settings** | bậc `install` / `site` | bậc `workspace` (một workspace nhiều instance — chờ `bizcity_workspace@1`, NC-008 Q-NC8-10) |
| Site Options | Company-dependent Fields | **Instance / Org Settings** | bậc `tenant`, `branch` + bậc app (`registerSettingScopes`, 0006) | bậc `org` (nút cây tổ chức, NC-007 `org_unit_code`) + **trường phụ thuộc tổ chức** |

## 2. Một mô hình: khoá · phạm vi · giá trị có hiệu lực

Mọi giá trị "cấu hình" hoặc "meta" có ba phần:
- **khoá đã đăng ký** (registry);
- **phạm vi**;
- **giá trị có thời điểm hiệu lực**.

Settings và Meta khác nhau ở **chủ thể** (của hệ thống / của một bản ghi), không khác cơ chế.

| | Chủ thể | Bảng | Thang phạm vi |
|---|---|---|---|
| Setting | module | `setting_values` | `install → workspace → site → tenant → org → branch → user` (+ bậc app) |
| User Meta | người dùng | `user_meta` | `tenant` (tuỳ chọn cá nhân theo tenant) |
| Entity Meta | bản ghi (`EntityRef`) | `entity_meta` | mặc định `tenant`; **phụ thuộc tổ chức** ⇒ thêm `org` / `branch` |

Giải giá trị theo thứ tự **hẹp thắng**, giống `getSetting` hiện tại: `user → branch → org → (bậc app) → tenant → site → workspace → install → mặc định`.

## 3. Trường phụ thuộc tổ chức (Odoo company-dependent)

Ví dụ: *giá vốn mặc định*, *tài khoản kho*, *kho xuất mặc định* của một mặt hàng **khác nhau theo chi nhánh / pháp nhân** nhưng vẫn là một `item_id`.

```ts
registerField('masterdata.item', 'ketoan.inventory_account',
  field.ref('ketoan.account', { label: 'Tài khoản kho', storage: 'meta', scoped: ['org', 'branch'] }));
```

- Lưu `entity_meta` với hai cột thêm `scope_type`, `scope_id`. Migration lõi giữ số ở CLAIMS khi làm.
- Đọc: `entityMeta.get(ref, key, { branchId })` giải theo thang ở §2.
- Màn chi tiết hiện giá trị đang áp **và nguồn**: "lấy từ Chi nhánh Q1" / "mặc định tenant", giống cách `SettingRead.source` đang làm.
- Lịch sử theo `valid_from`, không sửa lùi. Giống luật cài đặt hiện có.

## 4. Khai báo

```ts
defineSetting('cake.order.auto_confirm', {
  label: 'Tự xác nhận đơn Fanpage', type: field.bool(), default: false,
  scopes: ['tenant', 'branch'], permission: 'settings:write',
  uses: [{ kind: 'action', ref: 'cake.order.create' }],          // để settingImpact biết đổi thì ảnh hưởng gì
});
defineUserMeta('cake.inbox.columns', field.json(), { label: 'Cột hộp thư đang hiện' });
```

**Lõi sinh ra:**
- màn **Cài đặt hệ thống** nhóm theo module (f9);
- ô theo kiểu;
- nhãn nguồn giá trị;
- nút "xem ảnh hưởng";
- lịch sử;
- quyền.

Developer không viết màn cài đặt.

## 5. Luật

- Khoá phải đăng ký, có tiền tố module (R-DATA-1 của open-cake). Khoá lạ ⇒ từ chối ghi.
- **Không đặt ở meta / setting** (SC-ENT-5): tiền, số lượng, thuế suất, trạng thái chứng từ, quyền, bí mật. Bí mật dùng `platform.secrets`.
- Cài đặt có `basis` (căn cứ pháp lý) thì đổi phải nêu lý do. Đã có, giữ.
- Đổi cài đặt = action `core.setting.set`: có audit, sự kiện `setting.changed`, xoá đệm.
