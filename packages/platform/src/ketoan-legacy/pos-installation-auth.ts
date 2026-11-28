// @bizcity-layer P core/auth
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 — dời từ packages/platform/src/core/auth.ts (resolveInstallation, ADR-0037 / OKT-SET-1) vào khu cách ly (R-CORE-8):
//   khoá cài đặt open-pos đọc bảng pos_installations / pos_installation_blogs của open-ketoan. open-ketoan đăng ký bằng installKetoanLegacy().
import './db-types.js'; // kiểu bảng open-ketoan (cách ly)
import type { FastifyRequest } from 'fastify';
import { ERROR_CODES } from '@bizcity/contracts';
import { db } from '../db/client.js';
import { AppError, Errors } from '../core/errors.js';
import { hashApiKey } from '../core/security/password.js';
import { INSTALLATION_KEY_PREFIX, registerApiKeyResolver, scopePermissions, type AuthContext, type Permission } from '../core/auth.js';

const BLOG_RE = /^[1-9][0-9]{0,8}$/;

/** Khoá cài đặt → AuthContext. Blog chờ / thu hồi / lạ → 403 có `details.reason` (bridge xếp hàng, không mất đơn — R-OKT-CONN-11). */
export async function resolveInstallation(req: FastifyRequest, apiKey: string): Promise<AuthContext | null> {
  const inst = await db.selectFrom('pos_installations')
    .select(['id', 'code', 'name', 'tenant_id', 'scopes'])
    .where('key_hash', '=', hashApiKey(apiKey)).where('status', '=', 'active')
    .executeTakeFirst();
  if (!inst) return null;
  const claimed = req.headers['x-okt-install'];
  if (typeof claimed === 'string' && claimed !== '' && claimed !== inst.code) return null;
  void db.updateTable('pos_installations').set({ last_seen_at: new Date() }).where('id', '=', inst.id).execute();
  const rawBlog = req.headers['x-okt-blog'];
  if (rawBlog === undefined || rawBlog === '') {
    return { tenantId: inst.tenant_id, actor: `install:${inst.code}`, actorName: inst.name, kind: 'apikey', role: null, permissions: new Set<Permission>(),
      installation: { id: String(inst.id), code: inst.code, blogId: null } };
  }
  if (typeof rawBlog !== 'string' || !BLOG_RE.test(rawBlog)) throw Errors.validation('X-OKT-Blog phải là số blog WordPress (số nguyên dương)');
  const blogId = Number(rawBlog);
  const blog = await db.selectFrom('pos_installation_blogs').select(['status', 'tenant_id'])
    .where('installation_id', '=', inst.id).where('blog_id', '=', blogId).executeTakeFirst();
  if (!blog) throw new AppError(ERROR_CODES.FORBIDDEN, `Blog ${blogId} chưa đăng ký với khoá cài đặt này — gọi POST /api/v1/pos-installation/blogs trước`, 403, { reason: 'BLOG_UNKNOWN', blogId });
  if (blog.status !== 'active' || blog.tenant_id === null) {
    throw new AppError(ERROR_CODES.FORBIDDEN, `Blog ${blogId} chưa được nối vào sổ nào — kế toán nhập mã nối ở Hệ thống → Kết nối open-pos`, 403, { reason: 'BLOG_NOT_LINKED', blogId, status: blog.status });
  }
  return {
    tenantId: blog.tenant_id, actor: `install:${inst.code}:blog:${blogId}`, actorName: `${inst.name} · blog ${blogId}`, kind: 'apikey', role: null,
    permissions: scopePermissions(inst.scopes), installation: { id: String(inst.id), code: inst.code, blogId },
  };
}

let installed = false;
/** open-ketoan gọi một lần lúc khởi động (sau khi đổi nguồn sang lõi 0.7): đăng ký mọi móc của phần chuyển tiếp. */
export function installKetoanLegacy(): void {
  if (installed) return;
  installed = true;
  registerApiKeyResolver({ prefix: INSTALLATION_KEY_PREFIX, resolve: resolveInstallation });
}
