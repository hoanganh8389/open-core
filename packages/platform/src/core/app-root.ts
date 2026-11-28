// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer P config
// [2026-11-28 04:54 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-2 — PlatformConfig: một chỗ quyết định GỐC CỦA APP (nơi có db/, libraries/, modules/,
//   docs/contracts/…) thay cho năm chỗ tính "lùi N cấp từ tệp này" — đúng khi gói nằm trong repo app (packages/platform), SAI khi cài từ
//   bản phát hành vào node_modules (PHASE-001 R-2). Tên export cũ (DB_DIR, MIGRATIONS_DIR…) giữ nguyên (R-CORE-2).
/**
 * Thứ tự:
 *   1. BIZCITY_APP_ROOT (biến môi trường) — app / Docker đặt tường minh.
 *   2. Gói KHÔNG nằm trong node_modules (repo app chứa packages/platform, hoặc chính repo open-core) ⇒ cách tính cũ: <gói>/../.. .
 *   3. Gói nằm trong node_modules ⇒ đi lên từ thư mục chứa node_modules ĐẦU TIÊN tới thư mục có `bizcity.app.json` (mọi repo app có tệp này,
 *      bizcity_spine@1 Q-SPINE-4); không thấy ⇒ thư mục chứa node_modules đó.
 * Các thư mục con vẫn ghi đè được riêng: DB_DIR, SEEDS_DIR, PRESETS_DIR, PACKS_DIR, CONTROL_MIGRATIONS_DIR, BIZCITY_MODULES_DIR.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Thư mục gói @bizcity/platform (src/core hoặc dist/core → lùi 2 cấp). */
export const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Hàm thuần để kiểm được: tìm gốc app từ thư mục gói. */
export function findAppRoot(pkgDir: string, envRoot: string | undefined, has: (p: string) => boolean = existsSync): string {
  if (envRoot) return path.resolve(envRoot);
  const parts = path.resolve(pkgDir).split(path.sep);
  const nm = parts.indexOf('node_modules');
  if (nm < 0) return path.resolve(pkgDir, '..', '..');
  const start = parts.slice(0, nm).join(path.sep) || path.sep;
  for (let d = start; ; d = path.dirname(d)) {
    if (has(path.join(d, 'bizcity.app.json'))) return d;
    if (path.dirname(d) === d) break;
  }
  return start;
}

let cached: string | null = null;
/** Gốc của app đang chạy (đọc một lần). */
export function appRoot(): string {
  cached ??= findAppRoot(PACKAGE_DIR, process.env.BIZCITY_APP_ROOT || undefined);
  return cached;
}
