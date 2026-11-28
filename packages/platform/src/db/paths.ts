// @bizcity-layer P data
// [2026-10-29 10:24 PM Johnny Chu - Chu Hoàng Anh] INIT — khởi tạo Bizcity Core Framework: sổ cái chỉ thêm, cửa nạp sự việc, CANON, hợp đồng, bộ kiểm chuẩn.
// [2026-10-30 09:58 AM Johnny Chu - Chu Hoàng Anh] PHASE-002 — nhãn lớp @bizcity-layer, đồ thị phụ thuộc mốc, bản nháp API module-sdk.
// [2026-10-30 10:52 PM Johnny Chu - Chu Hoàng Anh] PHASE-012 — thư mục gói định khoản db/packs (PACKS_DIR).
// [2026-11-01 04:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-010 — dời từ apps/api/src/db/paths.ts sang packages/platform (@bizcity/platform, D010-7 chặng 2); import tương đối viết lại theo chỗ mới
/**
 * Thư mục CƠ SỞ DỮ LIỆU của dự án: <gốc repo>/db (người phụ trách DB quản lý — xem db/README.md).
 *   db/migrations/NNNN_ten.sql   khai báo bảng (chạy bằng job db-migrate / npm run db:migrate)
 *   db/seeds/                    dữ liệu gốc (tài khoản, danh mục chuẩn…)
 *   db/packs/                    gói định khoản (bizcity_posting_template@1); gói nền vn-tt99-nen cài khi khởi tạo đơn vị
 * Chạy từ src (tsx) hay dist (node, trong Docker là /app/apps/api/dist/db) thì <gốc>/db đều cách 4 cấp.
 * Đổi chỗ: biến DB_DIR (hoặc riêng SEEDS_DIR).
 * [2026-11-14 01:47 PM Johnny Chu - Chu Hoàng Anh] PHASE-036 — S036-11: biến rỗng coi như chưa đặt (compose đặt SEEDS_DIR="" khi .env không có) — ?? sẽ ra đường dẫn tương đối
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRoot } from '../core/app-root.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// [2026-11-28 04:54 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-2 — gốc app qua appRoot() (đúng cả khi gói nằm trong node_modules)
export const DB_DIR = process.env.DB_DIR || path.join(appRoot(), 'db');
export const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');
export const SEEDS_DIR = process.env.SEEDS_DIR || path.join(DB_DIR, 'seeds');
// [2026-11-14 01:47 PM Johnny Chu - Chu Hoàng Anh] PHASE-036 — S036-11: true = máy chủ đặt SEEDS_DIR (bộ danh mục của công ty), false = db/seeds đóng kèm (TI08 báo bộ đang đọc)
export const SEEDS_CUSTOM = Boolean(process.env.SEEDS_DIR);
// [2026-11-14 05:53 PM Johnny Chu - Chu Hoàng Anh] PHASE-036 — S036-4: thư mục gói mẫu theo ngành (bizcity_preset@1) — máy chủ chạy gói (core.setup.*); Docker: /app/presets
export const PRESETS_DIR = process.env.PRESETS_DIR || path.resolve(DB_DIR, '..', 'presets');
export const PACKS_DIR = process.env.PACKS_DIR || path.join(DB_DIR, 'packs');
// [2026-11-24 06:15 PM Johnny Chu - Chu Hoàng Anh] P2b-2 — migration NỀN đóng kèm gói (dải 00xx, D-PLAT-5): app khai làm nguồn đầu tiên — runMigrations({ sources: [{ name: 'platform', dir: PLATFORM_MIGRATIONS_DIR }, { name: '<app>', dir: … }] }).
export const PLATFORM_MIGRATIONS_DIR = path.resolve(here, '../../db/migrations');
