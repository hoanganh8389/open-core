// @bizcity-layer P list
// [2026-11-28 09:05 PM Johnny Chu - Chu Hoàng Anh] S003-4 — defineListAction (bizcity_list@1): khai một danh sách (nguồn + cột + quyền) ⇒ lõi sinh action danh sách (q · f.<cột>.<phép> · sort ·
// con trỏ keyset · count · sums · phạm vi vai · che cột theo quyền) và action xuất (csv · json · ndjson; quyền xuất riêng; ghi bằng chứng; ≤ 10 000 dòng, lớn hơn chờ việc nền S003-11).
// Cột chỉ là ĐỊNH DANH SQL do mã app khai (không bao giờ lấy từ người dùng); mọi giá trị đi qua tham số.
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { sql, type RawBuilder } from 'kysely';
import type { Db } from '../db/client.js';
import type { Permission } from './auth.js';
import { Errors } from './errors.js';
import { defineAction, type ActionContext, type AnyActionDef } from './actions.js';
import { formatListQuery, parseListQuery, type ListFilter, type ListOp, type ListQuery } from './list-query.js';

export type ColType = 'text' | 'number' | 'money' | 'qty' | 'date' | 'datetime' | 'enum' | 'status' | 'bool' | 'item' | 'partner' | 'contact' | 'branch' | 'user';
export interface ListColumn {
  field: string; type: ColType; label: string;
  /** Biểu thức SQL của cột (định danh hoặc biểu thức cố định do mã khai). */
  sql: string;
  ops?: ListOp[];
  sort?: boolean; search?: boolean; sum?: boolean;
  /** Tổng chỉ tính khi bộ lọc có `eq` ở cột này (vd tổng nguyên tệ chỉ khi lọc một tiền tệ). */
  sumOnlyWith?: string;
  /** Quyền xem cột (R-STD-LIST-11): thiếu quyền ⇒ che giá trị, không bỏ cột. */
  permission?: Permission;
}
export interface ListDef {
  /** `<module>.<thực thể>.list` */
  id: string;
  label: string;
  permission: Permission;
  /** Khác quyền xem; không khai = không xuất. */
  exportPermission?: Permission;
  /** Bảng / khung nhìn nguồn (định danh do mã khai). */
  from: string;
  idSql?: string;
  tenantSql?: string;
  columns: ListColumn[];
  defaultSort: { field: string; dir: 'asc' | 'desc' }[];
  /** Điều kiện ngầm trừ khi bộ lọc đã nhắc tới cột `unlessField` (vd ẩn lưu trữ mặc định). */
  defaultWhere?: { unlessField: string; sql: string }[];
  /** Tên phạm vi của vai → cột SQL: `{ orgUnits: 'org_unit_code' }`. Phạm vi `null` / không có = không giới hạn; `[]` = không thấy gì. */
  scope?: Record<string, string>;
  exportFormats?: ('csv' | 'json' | 'ndjson')[];
  http?: { path: string };
}
export type ListScope = Record<string, readonly string[] | null | undefined>;
export interface Viewer { can(p: Permission): boolean }
export type ListRow = Record<string, unknown>;
export interface ListPageResult { data: ListRow[]; meta: { nextCursor: string | null; total?: number; sums?: Record<string, number>; query: ListQuery; masked?: string[] } }

export const EXPORT_MAX_ROWS = 10_000;
const ORD: ListOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'];
const TEXTOPS: ListOp[] = ['eq', 'ne', 'in', 'nin', 'prefix', 'like'];
const defaultOps = (t: ColType): ListOp[] => (['number', 'money', 'qty', 'date', 'datetime'].includes(t) ? [...ORD, 'null'] : t === 'bool' ? ['eq'] : t === 'enum' || t === 'status' ? ['eq', 'ne', 'in', 'nin'] : TEXTOPS);
const opsOf = (c: ListColumn) => c.ops ?? defaultOps(c.type);
const IDENT = /^[a-z_][a-z0-9_.]*$/i;

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const sel = (c: ListColumn): string => (['money', 'number', 'qty'].includes(c.type) ? `(${c.sql})::float8` : c.type === 'date' ? `(${c.sql})::text` : c.sql);

export function validateListDef(def: ListDef): void {
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*\.list$/.test(def.id)) throw new Error(`Mã danh sách dạng <module>.<thực thể>.list: ${def.id}`);
  if (!IDENT.test(def.from) || !IDENT.test(def.idSql ?? 'id') || !IDENT.test(def.tenantSql ?? 'tenant_id')) throw new Error(`${def.id}: from / idSql / tenantSql phải là định danh SQL`);
  const seen = new Set<string>();
  for (const c of def.columns) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(c.field) || seen.has(c.field)) throw new Error(`${def.id}: cột "${c.field}" sai hoặc trùng`);
    seen.add(c.field);
  }
  if (!def.defaultSort.length || def.defaultSort.length > 3) throw new Error(`${def.id}: defaultSort 1–3 khoá`);
  for (const s of def.defaultSort) if (!def.columns.find((c) => c.field === s.field)?.sort) throw new Error(`${def.id}: defaultSort "${s.field}" phải là cột sort`);
  for (const col of Object.values(def.scope ?? {})) if (!IDENT.test(col)) throw new Error(`${def.id}: scope trỏ tới "${col}" không phải định danh`);
}

/** ListDef dạng JSON chuẩn (`GET /api/v1/lists/<id>`) — web-shell dựng bảng + thanh lọc từ đây; agent biết lọc được gì. */
export function listDefJson(def: ListDef) {
  return {
    contract: 'bizcity_list@1', id: def.id, label: def.label, permission: def.permission, ...(def.exportPermission ? { exportPermission: def.exportPermission } : {}),
    columns: def.columns.map((c) => ({ field: c.field, type: c.type, label: c.label, filter: opsOf(c), ...(c.sort ? { sort: true } : {}), ...(c.search ? { search: true } : {}), ...(c.sum ? { sum: true } : {}), ...(c.permission ? { permission: c.permission } : {}) })),
    defaultSort: def.defaultSort, ...(def.exportPermission ? { exportFormats: def.exportFormats ?? ['csv', 'json', 'ndjson'] } : {}),
  };
}

function val(c: ListColumn, v: unknown): string | number | boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v);
  if (['money', 'number', 'qty'].includes(c.type) && !/^-?\d+(\.\d+)?$/.test(s)) throw Errors.validation(`${c.label}: "${s}" không phải số`, { field: c.field });
  if (c.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Errors.validation(`${c.label}: ngày dạng YYYY-MM-DD`, { field: c.field });
  if (c.type === 'datetime' && Number.isNaN(Date.parse(s))) throw Errors.validation(`${c.label}: thời điểm không hợp lệ`, { field: c.field });
  return s;
}

function cond(def: ListDef, f: ListFilter): RawBuilder<boolean> {
  const c = def.columns.find((x) => x.field === f.field);
  if (!c) throw Errors.validation(`Cột "${f.field}" không có trong danh sách ${def.label}`, { field: f.field });
  const ops = opsOf(c);
  if (!ops.includes(f.op)) throw Errors.validation(`Cột ${c.field} không lọc theo phép ${f.op} (được: ${ops.join(', ')})`, { field: f.field });
  const col = sql.raw(`(${c.sql})`);
  const v = f.value;
  switch (f.op) {
    case 'eq': return sql<boolean>`${col} = ${val(c, v)}`;
    case 'ne': return sql<boolean>`${col} IS DISTINCT FROM ${val(c, v)}`;
    case 'gt': return sql<boolean>`${col} > ${val(c, v)}`;
    case 'gte': return sql<boolean>`${col} >= ${val(c, v)}`;
    case 'lt': return sql<boolean>`${col} < ${val(c, v)}`;
    case 'lte': return sql<boolean>`${col} <= ${val(c, v)}`;
    case 'between': { const [a, b] = v as string[]; return sql<boolean>`${col} BETWEEN ${val(c, a)} AND ${val(c, b)}`; }
    case 'in': case 'nin': {
      const list = (v as unknown[]).map((x) => val(c, x));
      if (!list.length || list.length > 100) throw Errors.validation('in / nin cần 1–100 giá trị', { field: f.field });
      const inn = sql<boolean>`${col} IN (${sql.join(list)})`;
      return f.op === 'in' ? inn : sql<boolean>`NOT (${inn})`;
    }
    case 'prefix': return sql<boolean>`${col} ILIKE ${likeEscape(String(v)) + '%'}`;
    case 'like': return sql<boolean>`${col} ILIKE ${'%' + likeEscape(String(v)) + '%'}`;
    case 'null': return v === true || v === 'true' ? sql<boolean>`${col} IS NULL` : sql<boolean>`${col} IS NOT NULL`;
  }
}

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Con trỏ = chữ ký cách sắp xếp + giá trị các khoá: đổi cách sắp xếp mà giữ con trỏ cũ ⇒ báo rõ, không để CSDL báo lỗi kiểu.
function dec(cur: string, sig: string): unknown[] {
  try {
    const o = JSON.parse(Buffer.from(cur, 'base64url').toString());
    if (o && o.s === sig && Array.isArray(o.v)) return o.v;
    if (o && Array.isArray(o.v)) throw Errors.validation('Con trỏ thuộc cách sắp xếp khác — tải lại từ trang đầu', { field: 'cursor' });
  } catch (e) { if ((e as { code?: string }).code === 'VALIDATION_ERROR') throw e; /* con trỏ hỏng — báo bên dưới */ }
  throw Errors.validation('Con trỏ (cursor) không hợp lệ — tải lại từ trang đầu', { field: 'cursor' });
}

/** Che giá trị cột thiếu quyền xem (R-STD-LIST-11): chữ giữ 2 đầu + 3 cuối (`09…567`), số bỏ trống. */
export function maskValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return null;
  const s = String(v);
  return s.length <= 6 ? '***' : `${s.slice(0, 2)}…${s.slice(-3)}`;
}

export const listEngine = {
  async run(tx: Db, tenantId: string, def: ListDef, query: ListQuery, scope: ListScope = {}, viewer?: Viewer, opts: { maxLimit?: number } = {}): Promise<ListPageResult> {
    const limit = Math.min(query.limit ?? 50, opts.maxLimit ?? 200);
    const tenantCol = sql.raw(def.tenantSql ?? 'tenant_id');
    const wheres: RawBuilder<boolean>[] = [sql<boolean>`${tenantCol} = ${tenantId}`];
    for (const [name, col] of Object.entries(def.scope ?? {})) {
      const allowed = scope[name];
      if (allowed) wheres.push(allowed.length ? sql<boolean>`${sql.raw(col)} IN (${sql.join([...allowed])})` : sql<boolean>`false`);
    }
    const filters = query.filters ?? [];
    for (const d of def.defaultWhere ?? []) if (!filters.some((f) => f.field === d.unlessField)) wheres.push(sql<boolean>`${sql.raw(d.sql)}`);
    for (const f of filters) wheres.push(cond(def, f));
    const searchCols = def.columns.filter((c) => c.search);
    if (query.q?.trim() && searchCols.length) {
      const like = '%' + likeEscape(query.q.trim()) + '%';
      wheres.push(sql<boolean>`(${sql.join(searchCols.map((c) => sql<boolean>`(${sql.raw(c.sql)}) ILIKE ${like}`), sql` OR `)})`);
    }
    const base = sql.join(wheres, sql` AND `);

    const sorts = (query.sort?.length ? query.sort : def.defaultSort).map((s) => {
      const c = def.columns.find((x) => x.field === s.field);
      if (!c?.sort) throw Errors.validation(`Không sắp xếp theo cột "${s.field}"`, { field: 'sort' });
      return { c, dir: s.dir };
    });
    const idSql = def.idSql ?? 'id';
    // Khoá phụ cố định (id) để thứ tự toàn phần; hướng theo khoá đầu.
    const keys = [...sorts.map((s) => ({ field: s.c.field, expr: s.c.sql, dir: s.dir })), { field: '__id', expr: idSql, dir: sorts[0]!.dir }];
    const sig = keys.map((k) => `${k.field}:${k.dir}`).join(',');
    let keyset: RawBuilder<boolean> | null = null;
    if (query.cursor) {
      const vals = dec(query.cursor, sig);
      if (vals.length !== keys.length) throw Errors.validation('Con trỏ không khớp cách sắp xếp hiện tại — tải lại từ trang đầu', { field: 'cursor' });
      // Keyset theo (k1, k2, …, id), NULL xếp cuối (NULLS LAST): sau giá trị v không rỗng là "lớn hơn / nhỏ hơn v" HOẶC rỗng; sau giá trị rỗng chỉ còn các dòng rỗng có khoá kế tiếp sau.
      const term = (i: number): RawBuilder<boolean> => {
        const k = keys[i]!; const col = sql.raw(`(${k.expr})`); const v = vals[i];
        const after = v === null ? sql<boolean>`false`
          : k.dir === 'asc' ? sql<boolean>`(${col} > ${v as never} OR ${col} IS NULL)` : sql<boolean>`(${col} < ${v as never} OR ${col} IS NULL)`;
        if (i === keys.length - 1) return after;
        const same = v === null ? sql<boolean>`${col} IS NULL` : sql<boolean>`${col} = ${v as never}`;
        return sql<boolean>`(${after} OR (${same} AND ${term(i + 1)}))`;
      };
      keyset = term(0);
    }
    const order = sql.join(keys.map((k) => sql`${sql.raw(`(${k.expr})`)} ${sql.raw(k.dir === 'asc' ? 'ASC NULLS LAST' : 'DESC NULLS LAST')}`));
    const where = keyset ? sql`${base} AND ${keyset}` : base;
    const select = sql.join([sql.raw(`(${idSql})::text AS "__id"`), ...def.columns.map((c) => sql.raw(`${sel(c)} AS "${c.field}"`))]);
    const rows = (await sql<Record<string, unknown>>`SELECT ${select} FROM ${sql.raw(def.from)} WHERE ${where} ORDER BY ${order} LIMIT ${limit + 1}`.execute(tx)).rows;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    // Giá trị khoá lấy lại ĐÚNG như CSDL so sánh: cột đã ép kiểu để hiển thị (float8 / text) vẫn so sánh được với tham số.
    const nextCursor = rows.length > limit && last
      ? enc({ s: sig, v: keys.map((k) => { const v = last[k.field]; return v instanceof Date ? v.toISOString() : v ?? null; }) })
      : null;
    const meta: ListPageResult['meta'] = { nextCursor, query: parseListQuery(formatListQuery({ ...query, cursor: undefined })) };
    if (query.count === 'exact') meta.total = Number((await sql<{ n: string }>`SELECT count(*) AS n FROM ${sql.raw(def.from)} WHERE ${base}`.execute(tx)).rows[0]!.n);
    if (query.sums) {
      const sumCols = def.columns.filter((c) => c.sum && (!c.sumOnlyWith || filters.some((f) => f.field === c.sumOnlyWith && f.op === 'eq')));
      if (sumCols.length) {
        const r = (await sql<Record<string, number | null>>`SELECT ${sql.join(sumCols.map((c) => sql.raw(`sum(${c.sql})::float8 AS "${c.field}"`)))} FROM ${sql.raw(def.from)} WHERE ${base}`.execute(tx)).rows[0]!;
        meta.sums = Object.fromEntries(sumCols.map((c) => [c.field, r[c.field] ?? 0]));
      }
    }
    const masked = viewer ? def.columns.filter((c) => c.permission && !viewer.can(c.permission)).map((c) => c.field) : [];
    if (masked.length) meta.masked = masked;
    const data = page.map((r) => {
      const out: ListRow = {};
      for (const c of def.columns) {
        const v = r[c.field];
        out[c.field] = masked.includes(c.field) ? maskValue(v) : v instanceof Date ? v.toISOString() : v;
      }
      return out;
    });
    return { data, meta };
  },

  /** Xuất theo đúng bộ lọc (R-STD-LIST-7): tới 10 000 dòng; lớn hơn ⇒ chờ việc nền (R-STD-LIST-8). */
  async export(tx: Db, tenantId: string, def: ListDef, query: ListQuery, scope: ListScope, viewer: Viewer | undefined, format: 'csv' | 'json' | 'ndjson', who: { tenant: string; actor: string }) {
    const rows: ListRow[] = []; let masked: string[] | undefined; let cursor: string | undefined;
    const q: ListQuery = { ...query, cursor: undefined, limit: 200, sums: false, count: 'none' };
    for (;;) {
      const p = await listEngine.run(tx, tenantId, def, { ...q, ...(cursor ? { cursor } : {}) }, scope, viewer);
      rows.push(...p.data); masked = p.meta.masked;
      if (rows.length > EXPORT_MAX_ROWS) throw Errors.notReady(`Danh sách có hơn ${EXPORT_MAX_ROWS} dòng — thu hẹp bộ lọc; xuất nền cho tệp lớn chưa có (S003-11)`, { reason: 'EXPORT_TOO_LARGE', max: EXPORT_MAX_ROWS });
      if (!p.meta.nextCursor) break;
      cursor = p.meta.nextCursor;
    }
    const cols = def.columns.map((c) => ({ field: c.field, type: c.type, label: c.label }));
    const generatedAt = new Date().toISOString();
    const stem = `${def.id.replace(/\.list$/, '')}-${generatedAt.slice(0, 10)}`;
    const cleanQuery = parseListQuery(formatListQuery({ ...query, cursor: undefined, limit: undefined, sums: undefined }));
    let content: string; let contentType: string;
    if (format === 'json') {
      content = JSON.stringify({ contract: 'bizcity_list_export@1', list: def.id, tenant: who.tenant, generatedAt, generatedBy: who.actor, query: cleanQuery, columns: cols, total: rows.length, ...(masked?.length ? { masked } : {}), rows });
      contentType = 'application/json';
    } else if (format === 'ndjson') {
      content = [JSON.stringify({ contract: 'bizcity_list_export@1', list: def.id, tenant: who.tenant, generatedAt, generatedBy: who.actor, query: cleanQuery, columns: cols }), ...rows.map((r) => JSON.stringify(r))].join('\n') + '\n';
      contentType = 'application/x-ndjson';
    } else {
      const cell = (v: unknown) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      content = '﻿' + [cols.map((c) => cell(c.label)).join(','), ...rows.map((r) => cols.map((c) => cell(r[c.field])).join(','))].join('\r\n') + '\r\n';
      contentType = 'text/csv; charset=utf-8';
    }
    return { format, filename: `${stem}.${format}`, contentType, content, rowCount: rows.length, ...(masked?.length ? { masked } : {}), filterHash: createHash('sha256').update(JSON.stringify(cleanQuery)).digest('hex').slice(0, 16) };
  },
};

const scopeOf = (def: ListDef, ctx: ActionContext): ListScope => {
  // Phạm vi chi nhánh của vai (NT-HT-003 GĐ4) áp cho phạm vi "orgUnits" nếu danh sách khai.
  const s: ListScope = {};
  if (def.scope?.orgUnits) s.orgUnits = ctx.branchScope ?? null;
  return s;
};
const viewerOf = (ctx: ActionContext): Viewer => ({ can: (p) => ctx.can(p) });

/**
 * Khai danh sách ⇒ hai action: `<id>` (danh sách, đọc) và `<module>.<thực thể>.export` (xuất, ghi bằng chứng, quyền xuất riêng). App đưa cả hai vào `mountActions`.
 * Danh sách đọc được qua MCP (chỉ đọc); xuất không mở cho AI (ai: 'deny').
 */
export function defineListAction(def: ListDef): { list: AnyActionDef; export?: AnyActionDef; def: ListDef } {
  validateListDef(def);
  const [mod, entity] = def.id.split('.') as [string, string];
  const path = def.http?.path ?? `/api/v1/${entity.replace(/_/g, '-')}`;
  const list = defineAction({
    id: def.id, title: def.label, permission: def.permission, effect: 'read', idempotency: 'natural',
    description: `Danh sách ${def.label} theo bizcity_list@1.`,
    input: z.object({}).passthrough(), output: z.object({ data: z.array(z.record(z.unknown())), meta: z.record(z.unknown()) }),
    expose: { http: { method: 'GET', path, query: z.object({}).passthrough() }, mcp: true, ai: 'read' },
    async handler(ctx, input) {
      const page = await listEngine.run(ctx.data.tx, ctx.tenant.id, def, parseListQuery(input as Record<string, string>), scopeOf(def, ctx), viewerOf(ctx));
      return page as unknown as { data: ListRow[]; meta: Record<string, unknown> };
    },
  });
  if (!def.exportPermission) return { list, def };
  const formats = def.exportFormats ?? ['csv', 'json', 'ndjson'];
  const exp = defineAction({
    id: `${mod}.${entity}.export`, title: `Xuất ${def.label}`, permission: def.exportPermission, effect: 'write', idempotency: 'natural', sideEffects: ['analysis'],
    description: `Xuất ${def.label} theo đúng bộ lọc (${formats.join(' · ')}), tối đa ${EXPORT_MAX_ROWS} dòng.`,
    input: z.object({ format: z.enum(['csv', 'json', 'ndjson']) }).passthrough(),
    output: z.object({ format: z.string(), filename: z.string(), contentType: z.string(), content: z.string(), rowCount: z.number(), masked: z.array(z.string()).optional(), filterHash: z.string() }),
    expose: { http: { method: 'GET', path: `${path}/export`, query: z.object({ format: z.enum(['csv', 'json', 'ndjson']) }).passthrough() }, mcp: false, ai: 'deny' },
    evidence: { objectType: 'list', objectId: () => def.id },
    async handler(ctx, input) {
      const { format, ...rest } = input as { format: 'csv' | 'json' | 'ndjson' } & Record<string, string>;
      if (!formats.includes(format)) throw Errors.validation(`Danh sách ${def.label} không xuất ${format} (được: ${formats.join(', ')})`, { field: 'format' });
      const t = await ctx.data.tx.selectFrom('tenants').select('code').where('id', '=', ctx.tenant.id).executeTakeFirstOrThrow();
      const r = await listEngine.export(ctx.data.tx, ctx.tenant.id, def, parseListQuery(rest), scopeOf(def, ctx), viewerOf(ctx), format, { tenant: t.code, actor: ctx.actor.id });
      ctx.evidence.note('list', def.id); ctx.evidence.note('format', format); ctx.evidence.note('rows', r.rowCount); ctx.evidence.note('filterHash', r.filterHash);
      return r;
    },
  });
  return { list, export: exp, def };
}
