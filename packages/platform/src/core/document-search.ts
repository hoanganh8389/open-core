// @bizcity-layer P documents
// [2026-11-28 08:45 PM Johnny Chu - Chu Hoàng Anh] S003-20 — tìm chứng từ chuẩn hoá (NC-006 §3, NC-007 §3, R-DOCX-6): một danh sách trên trục chứng từ (business_documents)
// cho mọi app, theo bizcity_list@1 — q · f.<cột>.<phép> · sort · cursor / limit · count · sums. App nào ghi chứng từ qua document-spine (quản lý hoặc phản chiếu)
// thì chứng từ của app đó có mặt ở đây — palette ⌘K, danh sách chéo module, MCP chỉ đọc đều dùng một nguồn.
import { z } from 'zod';
import { sql, type RawBuilder } from 'kysely';
import type { Db } from '../db/client.js';
import { Errors } from './errors.js';
import { defineAction } from './actions.js';
import { formatListQuery, parseListQuery, type ListFilter, type ListOp, type ListQuery } from './list-query.js';

type ColType = 'text' | 'enum' | 'date' | 'datetime' | 'money' | 'number' | 'status' | 'bool';
interface Col { field: string; type: ColType; label: string; sql: string; ops: ListOp[]; sort?: boolean; sum?: boolean }
const TEXT: ListOp[] = ['eq', 'ne', 'in', 'nin', 'prefix', 'like'];
const ORD: ListOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'];

/** Cột của danh sách `core.document.list` (ListDef.columns). */
export const DOCUMENT_COLUMNS: readonly Col[] = [
  { field: 'doc_ref', type: 'text', label: 'Mã chứng từ', sql: 'doc_ref', ops: ['eq', 'in', 'prefix'] },
  { field: 'doc_type', type: 'enum', label: 'Loại', sql: 'doc_type', ops: ['eq', 'ne', 'in', 'nin', 'prefix'], sort: true },
  { field: 'module', type: 'enum', label: 'Module', sql: 'module', ops: ['eq', 'in'] },
  { field: 'doc_no', type: 'text', label: 'Số', sql: 'doc_no', ops: TEXT, sort: true },
  { field: 'doc_date', type: 'date', label: 'Ngày', sql: 'doc_date', ops: [...ORD, 'null'], sort: true },
  { field: 'title', type: 'text', label: 'Tiêu đề', sql: 'title', ops: ['prefix', 'like'] },
  { field: 'partner_ref', type: 'text', label: 'Đối tượng', sql: 'partner_ref', ops: ['eq', 'in', 'prefix'] },
  { field: 'org_unit_code', type: 'text', label: 'Đơn vị', sql: 'org_unit_code', ops: ['eq', 'in', 'prefix'] },
  { field: 'status', type: 'status', label: 'Nhóm trạng thái', sql: 'status', ops: ['eq', 'ne', 'in', 'nin'] },
  { field: 'status_raw', type: 'status', label: 'Trạng thái', sql: 'status_raw', ops: ['eq', 'ne', 'in', 'nin'] },
  { field: 'currency', type: 'enum', label: 'Tiền tệ', sql: 'currency', ops: ['eq', 'in'] },
  { field: 'total', type: 'money', label: 'Tổng (tiền hạch toán)', sql: 'total', ops: ORD, sort: true, sum: true },
  { field: 'created_by', type: 'text', label: 'Người lập', sql: 'created_by', ops: ['eq', 'in'] },
  { field: 'created_at', type: 'datetime', label: 'Lập lúc', sql: 'created_at', ops: ORD, sort: true },
  { field: 'updated_at', type: 'datetime', label: 'Sửa lúc', sql: 'updated_at', ops: ORD, sort: true },
  { field: 'archived_at', type: 'datetime', label: 'Lưu trữ lúc', sql: 'archived_at', ops: ['null'] },
];
const COL = new Map(DOCUMENT_COLUMNS.map((c) => [c.field, c]));

export interface DocumentRow {
  docRef: string; type: string; module: string; docNo: string; date: string | null; title: string; partnerRef: string; orgUnitCode: string;
  status: string; statusRaw: string; currency: string; total: number; totalFc: number | null; createdBy: string; createdAt: string; updatedAt: string; archived: boolean;
}
export interface DocumentPage { data: DocumentRow[]; meta: { nextCursor: string | null; total?: number; sums?: { total: number; totalFc?: number }; query: ListQuery } }
/** Phạm vi do vai quyết định (R-STD-LIST-2): giao với bộ lọc của người dùng, không bỏ được. */
export interface DocumentListScope { orgUnits?: readonly string[] | null; modules?: readonly string[] | null }

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const colRef = (c: Col): RawBuilder<unknown> => sql.raw(`"${c.sql}"`);

function val(c: Col, v: unknown): string | number | boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v);
  if (c.type === 'money' || c.type === 'number') { if (!/^-?\d+(\.\d+)?$/.test(s)) throw Errors.validation(`${c.label}: "${s}" không phải số`, { field: c.field }); return s; }
  if (c.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Errors.validation(`${c.label}: ngày dạng YYYY-MM-DD`, { field: c.field });
  if (c.type === 'datetime' && Number.isNaN(Date.parse(s))) throw Errors.validation(`${c.label}: thời điểm không hợp lệ`, { field: c.field });
  return s;
}

function cond(f: ListFilter): RawBuilder<boolean> {
  const c = COL.get(f.field);
  if (!c) throw Errors.validation(`Cột "${f.field}" không có trong danh sách chứng từ`, { field: f.field });
  if (!c.ops.includes(f.op)) throw Errors.validation(`Cột ${c.field} không lọc theo phép ${f.op} (được: ${c.ops.join(', ')})`, { field: f.field });
  const col = colRef(c);
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
  try { const o = JSON.parse(Buffer.from(cur, 'base64url').toString()); if (o && o.s === sig && Array.isArray(o.v)) return o.v; if (o && Array.isArray(o.v)) throw Errors.validation('Con trỏ thuộc cách sắp xếp khác — tải lại từ trang đầu', { field: 'cursor' }); } catch (e) { if ((e as { code?: string }).code === 'VALIDATION_ERROR') throw e; /* con trỏ hỏng — báo bên dưới */ }
  throw Errors.validation('Con trỏ (cursor) không hợp lệ — tải lại từ trang đầu', { field: 'cursor' });
}

export const documentSearch = {
  /**
   * Danh sách chứng từ theo `bizcity_list@1`. Mặc định: không gồm chứng từ đã lưu trữ (lọc `archived_at.null=false` để xem lưu trữ), mới nhất trước.
   * Phân trang bằng con trỏ keyset theo (khoá sắp xếp…, id) — ổn định khi có dòng mới.
   */
  async list(tx: Db, tenantId: string, query: ListQuery, scope: DocumentListScope = {}): Promise<DocumentPage> {
    const limit = query.limit ?? 50;
    const wheres: RawBuilder<boolean>[] = [sql<boolean>`tenant_id = ${tenantId}`];
    if (scope.orgUnits) wheres.push(scope.orgUnits.length ? sql<boolean>`org_unit_code IN (${sql.join([...scope.orgUnits])})` : sql<boolean>`false`);
    if (scope.modules) wheres.push(scope.modules.length ? sql<boolean>`module IN (${sql.join([...scope.modules])})` : sql<boolean>`false`);
    const filters = query.filters ?? [];
    if (!filters.some((f) => f.field === 'archived_at')) wheres.push(sql<boolean>`archived_at IS NULL`);
    for (const f of filters) wheres.push(cond(f));
    if (query.q?.trim()) {
      const like = '%' + likeEscape(query.q.trim()) + '%';
      wheres.push(sql<boolean>`(doc_no ILIKE ${like} OR title ILIKE ${like} OR partner_ref ILIKE ${like} OR doc_ref ILIKE ${like})`);
    }
    const base = sql.join(wheres, sql` AND `);

    const sort = (query.sort?.length ? query.sort : [{ field: 'doc_date', dir: 'desc' as const }]).map((s) => {
      const c = COL.get(s.field);
      if (!c?.sort) throw Errors.validation(`Không sắp xếp theo cột "${s.field}"`, { field: 'sort' });
      return { c, dir: s.dir };
    });
    // Khoá phụ cố định (id) để thứ tự toàn phần; hướng theo khoá đầu.
    const keys = [...sort.map((s) => ({ name: s.c.sql, dir: s.dir, c: s.c })), { name: 'id', dir: sort[0]!.dir, c: undefined }];
    const sig = keys.map((k) => `${k.name}:${k.dir}`).join(',');
    let keyset: RawBuilder<boolean> | null = null;
    if (query.cursor) {
      const vals = dec(query.cursor, sig);
      if (vals.length !== keys.length) throw Errors.validation('Con trỏ không khớp cách sắp xếp hiện tại — tải lại từ trang đầu', { field: 'cursor' });
      // Keyset theo (k1, k2, …, id), NULL xếp cuối (NULLS LAST): sau giá trị v không rỗng là "lớn hơn / nhỏ hơn v" HOẶC rỗng; sau giá trị rỗng chỉ còn các dòng rỗng có khoá kế tiếp sau.
      const term = (i: number): RawBuilder<boolean> => {
        const k = keys[i]!; const col = sql.raw(`"${k.name}"`); const v = vals[i];
        const after = v === null ? sql<boolean>`false`
          : k.dir === 'asc' ? sql<boolean>`(${col} > ${v as never} OR ${col} IS NULL)` : sql<boolean>`(${col} < ${v as never} OR ${col} IS NULL)`;
        if (i === keys.length - 1) return after;
        const same = v === null ? sql<boolean>`${col} IS NULL` : sql<boolean>`${col} = ${v as never}`;
        return sql<boolean>`(${after} OR (${same} AND ${term(i + 1)}))`;
      };
      keyset = term(0);
    }
    const order = sql.join(keys.map((k) => sql`${sql.raw(`"${k.name}"`)} ${sql.raw(k.dir === 'asc' ? 'ASC NULLS LAST' : 'DESC NULLS LAST')}`));
    const where = keyset ? sql`${base} AND ${keyset}` : base;
    const rows = (await sql<Record<string, unknown>>`
      SELECT id::text AS id, doc_ref, doc_type, module, doc_no, doc_date::text AS doc_date, title, partner_ref, org_unit_code, status, status_raw, currency,
             total::float8 AS total, total_fc::float8 AS total_fc, created_by, created_at, updated_at, archived_at
      FROM business_documents WHERE ${where} ORDER BY ${order} LIMIT ${limit + 1}`.execute(tx)).rows;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last
      ? enc({ s: sig, v: keys.map((k) => { const v = last[k.name === 'id' ? 'id' : k.name]; return v instanceof Date ? v.toISOString() : v ?? null; }) })
      : null;
    const meta: DocumentPage['meta'] = { nextCursor, query: parseListQuery(formatListQuery({ ...query, cursor: undefined })) };
    if (query.count === 'exact') meta.total = Number((await sql<{ n: string }>`SELECT count(*) AS n FROM business_documents WHERE ${base}`.execute(tx)).rows[0]!.n);
    if (query.sums) {
      const oneCur = filters.some((f) => f.field === 'currency' && f.op === 'eq');
      const r = (await sql<{ total: number | null; total_fc: number | null }>`SELECT sum(total)::float8 AS total, sum(total_fc)::float8 AS total_fc FROM business_documents WHERE ${base}`.execute(tx)).rows[0]!;
      meta.sums = { total: r.total ?? 0, ...(oneCur ? { totalFc: r.total_fc ?? 0 } : {}) };
    }
    return {
      data: page.map((r) => ({
        docRef: String(r.doc_ref), type: String(r.doc_type), module: String(r.module), docNo: String(r.doc_no), date: r.doc_date ? String(r.doc_date) : null, title: String(r.title),
        partnerRef: String(r.partner_ref), orgUnitCode: String(r.org_unit_code), status: String(r.status), statusRaw: String(r.status_raw), currency: String(r.currency),
        total: Number(r.total), totalFc: r.total_fc == null ? null : Number(r.total_fc), createdBy: String(r.created_by), createdAt: new Date(r.created_at as string).toISOString(),
        updatedAt: new Date(r.updated_at as string).toISOString(), archived: r.archived_at != null,
      })),
      meta,
    };
  },
};

/** Action `core.document.list` — app đưa vào `mountActions(app, [documentListAction])` (GET /api/v1/documents). Phạm vi theo đơn vị lấy từ `ctx.branchScope` của vai. */
export const documentListAction = defineAction({
  id: 'core.document.list', title: 'Tìm chứng từ (mọi loại, mọi module)', permission: 'documents:read', effect: 'read', idempotency: 'natural',
  description: 'Danh sách chứng từ trên trục chứng từ chung theo bizcity_list@1: q, f.<cột>.<phép>, sort, cursor, limit, count, sums.',
  input: z.object({}).passthrough(),
  output: z.object({ data: z.array(z.record(z.unknown())), meta: z.record(z.unknown()) }),
  expose: { http: { method: 'GET', path: '/api/v1/documents', query: z.object({}).passthrough() }, mcp: true, ai: 'read' },
  async handler(ctx, input) {
    const query = parseListQuery(input as Record<string, string>);
    const page = await documentSearch.list(ctx.data.tx, ctx.tenant.id, query, { orgUnits: ctx.branchScope ?? null });
    return page as unknown as { data: Record<string, unknown>[]; meta: Record<string, unknown> };
  },
});
