// [2026-11-29 01:09 AM Johnny Chu - Chu Hoàng Anh] S005-F0-2 — module mẫu "golden": danh mục Nhóm khách viết bằng API lõi HIỆN CÓ (0.6) — đây là
// lượng mã một dev app phải viết hôm nay cho TP-01, 03, 04, 05, 06, 20, 21, 22, 23 (Scoreboard DX). Không dùng gì ngoài @bizcity/platform.
import { z } from 'zod';
import { sql } from 'kysely';
import { defineAction } from '../../dist/core/actions.js';
import { defineListAction } from '../../dist/core/list.js';
import { Errors } from '../../dist/core/errors.js';

// TP-01 schema kiểm dữ liệu — viết tay, lặp lại các ràng buộc của bảng
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, 'Mã 2–20 ký tự: chữ hoa, số, gạch');
const fields = {
  name: z.string().trim().min(1).max(120),
  discount: z.coerce.number().min(0).max(100).default(0),
  note: z.string().max(500).default(''),
};
export const NhomKhachInput = z.object({ code, ...fields });
const NhomKhachPatch = z.object({ id: z.string(), ...fields }).partial({ name: true, discount: true, note: true });
const NhomKhachOut = z.object({ id: z.string(), code: z.string(), name: z.string(), discount: z.number(), note: z.string(), archived: z.boolean() });

const COLS = ['id', 'code', 'name', 'discount', 'note', 'archived_at'];
const toOut = (r) => ({ id: String(r.id), code: r.code, name: r.name, discount: Number(r.discount), note: r.note, archived: r.archived_at != null });

async function findById(tx, tenantId, id) {
  const r = await tx.selectFrom('golden_nhom_khach').select(COLS).where('tenant_id', '=', tenantId).where('id', '=', id).executeTakeFirst();
  if (!r) throw Errors.notFound(`nhóm khách ${id}`);
  return r;
}

// TP-22 chống trùng mã + câu báo có cách sửa — viết tay
async function assertCodeFree(tx, tenantId, c, exceptId) {
  let q = tx.selectFrom('golden_nhom_khach').select('id').where('tenant_id', '=', tenantId).where('code', '=', c);
  if (exceptId) q = q.where('id', '<>', exceptId);
  if (await q.executeTakeFirst()) throw Errors.conflict(`Mã nhóm ${c} đã có — đặt mã khác`, { field: 'code' });
}

// TP-20 + TP-21: ghi qua defineAction (idempotency, quyền, audit có sẵn), sự kiện phát tay
export const createNhomKhach = defineAction({
  id: 'golden.nhom-khach.create', title: 'Thêm nhóm khách', permission: 'documents:write', effect: 'write', idempotency: 'required',
  sideEffects: ['documents'], dryRun: true, input: NhomKhachInput, output: NhomKhachOut, expose: { http: { method: 'POST', path: '/api/v1/golden/nhom-khach' }, mcp: true },
  async handler(ctx, i) {
    await assertCodeFree(ctx.data.tx, ctx.tenant.id, i.code);
    const r = await ctx.data.tx.insertInto('golden_nhom_khach').values({ tenant_id: ctx.tenant.id, ...i, created_by: ctx.actor.id }).returning(COLS).executeTakeFirstOrThrow();
    await ctx.events.emit('golden.nhom-khach.changed', { id: String(r.id), op: 'create' }, { subject: `golden.nhom-khach:${r.id}` });
    return toOut(r);
  },
});

export const updateNhomKhach = defineAction({
  id: 'golden.nhom-khach.update', title: 'Sửa nhóm khách', permission: 'documents:write', effect: 'write', idempotency: 'required',
  sideEffects: ['documents'], input: NhomKhachPatch, output: NhomKhachOut, expose: { http: { method: 'PATCH', path: '/api/v1/golden/nhom-khach/:id' }, mcp: true },
  async handler(ctx, { id, ...patch }) {
    const cur = await findById(ctx.data.tx, ctx.tenant.id, id);
    if (cur.archived_at) throw Errors.conflict('Nhóm đã lưu trữ: khôi phục trước khi sửa');
    const r = await ctx.data.tx.updateTable('golden_nhom_khach').set({ ...patch, updated_at: sql`now()` })
      .where('tenant_id', '=', ctx.tenant.id).where('id', '=', id).returning(COLS).executeTakeFirstOrThrow();
    await ctx.events.emit('golden.nhom-khach.changed', { id, op: 'update' }, { subject: `golden.nhom-khach:${id}` });
    return toOut(r);
  },
});

// TP-23 lưu trữ / khôi phục — viết tay
export const archiveNhomKhach = defineAction({
  id: 'golden.nhom-khach.archive', title: 'Lưu trữ / khôi phục nhóm khách', permission: 'documents:write', effect: 'write', idempotency: 'natural',
  sideEffects: ['documents'], input: z.object({ id: z.string(), restore: z.boolean().default(false) }), output: NhomKhachOut,
  expose: { http: { method: 'POST', path: '/api/v1/golden/nhom-khach/:id/archive' }, mcp: true },
  async handler(ctx, { id, restore }) {
    await findById(ctx.data.tx, ctx.tenant.id, id);
    const r = await ctx.data.tx.updateTable('golden_nhom_khach').set({ archived_at: restore ? null : sql`now()`, updated_at: sql`now()` })
      .where('tenant_id', '=', ctx.tenant.id).where('id', '=', id).returning(COLS).executeTakeFirstOrThrow();
    await ctx.events.emit('golden.nhom-khach.changed', { id, op: restore ? 'restore' : 'archive' }, { subject: `golden.nhom-khach:${id}` });
    return toOut(r);
  },
});

// TP-04 đọc theo ID — viết tay
export const getNhomKhach = defineAction({
  id: 'golden.nhom-khach.get', title: 'Xem nhóm khách', permission: 'documents:read', effect: 'read', idempotency: 'natural',
  input: z.object({ id: z.string() }), output: NhomKhachOut, expose: { http: { method: 'GET', path: '/api/v1/golden/nhom-khach/:id' }, mcp: true },
  async handler(ctx, { id }) { return toOut(await findById(ctx.data.tx, ctx.tenant.id, id)); },
});

// TP-03 + TP-05 danh sách + xuất — có helper lõi, nhưng cột / phép lọc khai lại tay (D1)
export const nhomKhachList = defineListAction({
  id: 'golden.nhom-khach.list', label: 'Nhóm khách', permission: 'documents:read', exportPermission: 'documents:read', from: 'golden_nhom_khach',
  columns: [
    { field: 'code', type: 'text', label: 'Mã nhóm', sql: 'code', ops: ['eq', 'in', 'prefix'], sort: true, search: true },
    { field: 'name', type: 'text', label: 'Tên nhóm', sql: 'name', ops: ['prefix', 'like'], sort: true, search: true },
    { field: 'discount', type: 'number', label: 'Chiết khấu %', sql: 'discount', ops: ['eq', 'gte', 'lte'], sort: true },
    { field: 'archived_at', type: 'date', label: 'Lưu trữ lúc', sql: 'archived_at', ops: ['null'] },
  ],
  defaultSort: [{ field: 'code', dir: 'asc' }],
  defaultWhere: [{ unlessField: 'archived_at', sql: 'archived_at IS NULL' }],
  http: { path: '/api/v1/golden/nhom-khach' },
});

// TP-06 nhập có ghép cột + chạy thử + lỗi từng dòng — lõi CHƯA có: viết tay toàn bộ (D0)
const ALIASES = { code: ['mã', 'mã nhóm', 'code'], name: ['tên', 'tên nhóm', 'name'], discount: ['chiết khấu', 'ck', 'discount'], note: ['ghi chú', 'note'] };
function mapHeader(header) {
  const map = {};
  header.forEach((h, i) => {
    const k = Object.entries(ALIASES).find(([, a]) => a.includes(String(h).trim().toLowerCase()))?.[0];
    if (k) map[k] = i;
  });
  if (map.code === undefined || map.name === undefined) throw Errors.validation('Tệp thiếu cột Mã nhóm hoặc Tên nhóm');
  return map;
}

export const importNhomKhach = defineAction({
  id: 'golden.nhom-khach.import', title: 'Nhập nhóm khách', permission: 'documents:write', effect: 'write', idempotency: 'required',
  sideEffects: ['documents'], input: z.object({ rows: z.array(z.array(z.string())).min(2).max(5001), dryRun: z.boolean().default(true) }),
  output: z.object({ ok: z.number(), errors: z.array(z.object({ row: z.number(), field: z.string(), message: z.string() })), written: z.boolean() }),
  expose: { http: { method: 'POST', path: '/api/v1/golden/nhom-khach/import' } },
  async handler(ctx, { rows, dryRun }) {
    const map = mapHeader(rows[0]);
    const errors = [];
    const good = [];
    const seen = new Set();
    for (let n = 1; n < rows.length; n++) {
      const raw = Object.fromEntries(Object.entries(map).map(([k, i]) => [k, rows[n][i] ?? '']));
      const p = NhomKhachInput.safeParse(raw);
      if (!p.success) { for (const e of p.error.issues) errors.push({ row: n + 1, field: String(e.path[0] ?? ''), message: e.message }); continue; }
      if (seen.has(p.data.code)) { errors.push({ row: n + 1, field: 'code', message: `Mã ${p.data.code} lặp trong tệp` }); continue; }
      seen.add(p.data.code);
      try { await assertCodeFree(ctx.data.tx, ctx.tenant.id, p.data.code); good.push(p.data); } catch (e) { errors.push({ row: n + 1, field: 'code', message: e.message }); }
    }
    if (dryRun || errors.length) return { ok: good.length, errors, written: false };
    for (const g of good) await ctx.data.tx.insertInto('golden_nhom_khach').values({ tenant_id: ctx.tenant.id, ...g, created_by: ctx.actor.id }).execute();
    await ctx.events.emit('golden.nhom-khach.imported', { count: good.length }, { subject: 'golden.nhom-khach:*' });
    return { ok: good.length, errors, written: true };
  },
});

export const nhomKhachActions = [createNhomKhach, updateNhomKhach, archiveNhomKhach, getNhomKhach, nhomKhachList.list, nhomKhachList.export, importNhomKhach];
