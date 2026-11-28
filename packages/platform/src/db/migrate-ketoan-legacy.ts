// @bizcity-layer P+A data
// [2026-11-24 06:03 PM Johnny Chu - Chu Hoàng Anh] P2b-1 — tách phần RIÊNG của open-ketoan khỏi trình chạy migration chung (R-PLAT-1, R-PLAT-2):
//   gộp file gốc 23/10/2026 (BASELINE/LAST_OLD), file đổi tên (RENAMED, R-DB-3), xuất nhật ký cũ _run_log_export (0161). Nội dung GIỮ NGUYÊN từ
//   open-ketoan 6ad77b6; app khác KHÔNG dùng. open-ketoan gắn bằng `runMigrations(log, { hooks: ketoanLegacyHooks })` khi chuyển sang gói (P6),
//   rồi tệp này về lại open-ketoan.
import { appendRunLog } from '../core/run-log.js';
import type { MigrationClient, MigrationHooks } from './migrate.js';

/**
 * Các file GỐC: cấu trúc nền (23/10/2026) gộp từ 67 migration lịch sử. Cơ sở dữ liệu đang chạy đã áp đủ migration cũ (có LAST_OLD)
 * thì KHÔNG chạy các file gốc, chỉ ghi nhận. Đang dở giữa chừng (có migration cũ nhưng chưa tới LAST_OLD) thì dừng.
 */
const BASELINE = [
  '0001_goc_nen_tang.sql', '0002_goc_danh_muc.sql', '0003_goc_cau_hinh_dinh_khoan.sql', '0004_goc_ky_ke_toan.sql', '0005_goc_chung_tu.sql',
  '0006_goc_so_cai.sql', '0007_goc_kho_ban_hang.sql', '0008_goc_thue.sql', '0009_goc_tai_san.sql',
];
const LAST_OLD = '0067_danh_muc_hang_chuan.sql';

/** File đã ĐỔI TÊN (sửa trùng số, R-DB-3): tên mới → tên cũ. Chỉ thêm, không xoá (bản cài cũ cần khi nâng cấp). */
const RENAMED: Readonly<Record<string, string>> = {
  '0031_thue_kkkn.sql': '0028_thue_kkkn.sql',
  '0081_nguoi_tao_su_viec_bat_buoc.sql': '0080_nguoi_tao_su_viec_bat_buoc.sql',
  '0082_khoa_ky_o_csdl.sql': '0081_khoa_ky_o_csdl.sql',
  '0151_don_vi_gia_von_theo_co_cau.sql': '0149_don_vi_gia_von_theo_co_cau.sql',
  '0152_lan_tinh_gia_von.sql': '0150_lan_tinh_gia_von.sql',
  '0153_pham_vi_gia_von_tuy_chon.sql': '0151_pham_vi_gia_von_tuy_chon.sql',
  '0154_gia_von_chi_tiet_dau_ky.sql': '0152_gia_von_chi_tiet_dau_ky.sql',
  '0155_cong_thuc_gia_von_tuy_chon.sql': '0153_cong_thuc_gia_von_tuy_chon.sql',
  '0156_chenh_lech_tra_ncc.sql': '0154_chenh_lech_tra_ncc.sql',
  '0157_gia_von_theo_loai_kho.sql': '0155_gia_von_theo_loai_kho.sql',
  '0158_so_chung_tu_chung.sql': '0156_so_chung_tu_chung.sql',
  '0159_gom_bang_vao_loi.sql': '0157_gom_bang_vao_loi.sql',
  '0160_phien_ban_chinh_sach_mua_chung.sql': '0158_phien_ban_chinh_sach_mua_chung.sql',
  '0161_nguong_duyet_tt_vao_cau_hinh.sql': '0159_nguong_duyet_tt_vao_cau_hinh.sql',
  '0162_dau_xoa_va_sao_luu_vao_thung_rac.sql': '0160_dau_xoa_va_sao_luu_vao_thung_rac.sql',
  '0163_bo_bang_van_hanh.sql': '0161_bo_bang_van_hanh.sql',
  '0164_so_chung_tu_duyet_lien_ket.sql': '0162_so_chung_tu_duyet_lien_ket.sql',
  '0165_hop_dong_mua_xuyen_suot.sql': '0163_hop_dong_mua_xuyen_suot.sql',
};

// [2026-11-28 05:08 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-3 — migration LÕI (open-core packages/platform/db/migrations) mà dãy của open-ketoan đã có sẵn nội dung
//   (PHASE-001 R-4): ghi nhận, không chạy — kể cả CSDL mới (dãy của open-ketoan tự tạo đủ bảng). Migration lõi mới hơn 0004 chạy như thường.
export const CORE_COVERED_BY_KETOAN: Readonly<Record<string, string>> = {
  '0001_platform_nen_tang.sql': '0001_goc_* … 0067 (26 bảng nền)',
  '0002_platform_vai_theo_app.sql': 'ràng buộc vai của open-ketoan (giữ vai kế toán, ketoanAuthzPreset)',
  '0003_platform_external_sub.sql': '0183_nguoi_dung_external_sub.sql',
  '0004_platform_secrets.sql': '0184_tenant_secrets.sql',
  // [2026-11-28 07:52 PM Johnny Chu - Chu Hoàng Anh] S003-14 — quyết định PHASE-001 R-4: KHÔNG chạy trên CSDL open-ketoan lúc này. business_documents của
  // open-ketoan sinh ở 0156 (sau 0005 theo thứ tự tên) và do trigger đồng bộ; open-ketoan thêm bản tương đương (0187_truc_chung_tu.sql — open-ketoan đã tới 0186; PHASE-004 W1-4) khi lên trục chứng từ
  // qua R-FLOW, rồi đổi giá trị dưới đây thành tên tệp đó. Tới lúc ấy mã document-spine của lõi không dùng được trên CSDL open-ketoan.
  '0005_platform_truc_chung_tu.sql': 'chờ open-ketoan 0187_truc_chung_tu.sql (sau 0156) — PHASE-004 S004-W1-4, R-FLOW',
};

const record = (c: MigrationClient, name: string) => c.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);

export const ketoanLegacyHooks: MigrationHooks = {
  async beforeApply(c, done, log) {
    if (done.size > 0 && !BASELINE.every((f) => done.has(f))) {
      if (!done.has(LAST_OLD)) throw new Error(`Cơ sở dữ liệu đang ở bản cũ chưa đủ migration (thiếu ${LAST_OLD}): cập nhật bằng bản phần mềm trước ngày 23/10/2026 rồi mới lên bản này.`);
      for (const f of BASELINE) { await record(c, f); done.add(f); }
      log(`→ Cơ sở dữ liệu đã đủ cấu trúc (tới ${LAST_OLD}): ghi nhận ${BASELINE.length} file gốc, không chạy lại`);
    }
    for (const [now, was] of Object.entries(RENAMED)) {
      if (done.has(was) && !done.has(now)) { await record(c, now); done.add(now); log(`→ File đã đổi tên, đã áp từ trước: ${was} → ${now} (ghi nhận, không chạy lại)`); }
    }
  },
  async afterApply(c, log) {
    // [2026-11-18 Nguyễn Văn Thủy] 0161: dòng nhật ký cũ (tự chẩn đoán, Kiểm chuẩn, số đếm thư viện) ra JSONL rồi bỏ bảng tạm (đóng góp)
    const exp = await c.query<{ t: string | null }>(`SELECT to_regclass('_run_log_export')::text AS t`);
    if (!exp.rows[0]?.t) return;
    const rows = (await c.query<{ stream: string; tenant_id: string; at: Date; data: unknown }>('SELECT stream, tenant_id::text, at, data FROM _run_log_export ORDER BY at')).rows;
    for (const r of rows) await appendRunLog(r.stream, r.tenant_id, r.data, new Date(r.at));
    await c.query('DROP TABLE _run_log_export');
    if (rows.length) log(`→ Ghi ${rows.length} dòng nhật ký cũ ra JSONL (DATA_DIR/nhat-ky)`);
  },
  coveredBy: (file) => CORE_COVERED_BY_KETOAN[file] ?? null,
  isApplied(file, done) {
    if (done.has(LAST_OLD) && BASELINE.includes(file)) return true;
    return RENAMED[file] !== undefined && done.has(RENAMED[file]!);
  },
};
