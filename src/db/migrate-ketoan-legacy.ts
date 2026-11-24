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
  isApplied(file, done) {
    if (done.has(LAST_OLD) && BASELINE.includes(file)) return true;
    return RENAMED[file] !== undefined && done.has(RENAMED[file]!);
  },
};
