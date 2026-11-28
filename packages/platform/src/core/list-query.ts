// @bizcity-layer P list
// [2026-11-28 08:45 PM Johnny Chu - Chu Hoàng Anh] S003-20 — tham số URL bizcity_list@1 ⇄ ListQuery JSON (bản hiện thực của lõi; bản tham chiếu: bizcity-platform tools/lib/list-query.mjs,
// cùng vector schema/list/vectors/list.vectors.json). Thứ tự khoá chuẩn ⇒ cùng truy vấn ⇒ cùng JSON (bộ lọc đã lưu, băm bằng chứng xuất).
import { Errors } from './errors.js';

export type ListOp = 'eq' | 'ne' | 'in' | 'nin' | 'prefix' | 'like' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'null';
export interface ListFilter { field: string; op: ListOp; value: string | boolean | (string | boolean)[] }
export interface ListSort { field: string; dir: 'asc' | 'desc' }
export interface ListQuery { q?: string; filters?: ListFilter[]; sort?: ListSort[]; cursor?: string; limit?: number; count?: 'none' | 'exact'; sums?: boolean }

const BS = String.fromCharCode(92); // dấu gạch ngược — viết bằng mã để khỏi lỗi thoát chuỗi
const OPS = new Set<string>(['eq', 'ne', 'in', 'nin', 'prefix', 'like', 'gt', 'gte', 'lt', 'lte', 'between', 'null']);
const LIST_OPS = new Set(['in', 'nin']);
const bad = (field: string, message: string) => Errors.validation(message, { field });

function splitList(v: string): string[] {
  const out: string[] = []; let cur = '';
  for (let i = 0; i < v.length; i++) {
    if (v[i] === BS && v[i + 1] === ',') { cur += ','; i++; }
    else if (v[i] === ',') { out.push(cur); cur = ''; }
    else cur += v[i];
  }
  out.push(cur);
  return out;
}

/** Tham số URL (đã tách khoá → chuỗi) ⇒ ListQuery. Cú pháp sai ⇒ VALIDATION_ERROR nêu đúng tham số. Chưa kiểm cột — việc của danh sách cụ thể. */
export function parseListQuery(input: URLSearchParams | Record<string, string | string[] | undefined> | string): ListQuery {
  const entries: [string, string][] = typeof input === 'string' ? [...new URLSearchParams(input)]
    : input instanceof URLSearchParams ? [...input]
      : Object.entries(input).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x): [string, string] => [k, x])));
  const q: ListQuery = {};
  const filters: ListFilter[] = [];
  for (const [k, v] of entries) {
    if (k === 'q') q.q = v;
    else if (k === 'cursor') q.cursor = v;
    else if (k === 'limit') { if (!/^[0-9]{1,3}$/.test(v) || Number(v) < 1 || Number(v) > 200) throw bad('limit', 'limit là số 1–200'); q.limit = Number(v); }
    else if (k === 'count') { if (v !== 'none' && v !== 'exact') throw bad('count', 'count là none hoặc exact'); q.count = v; }
    else if (k === 'sums') q.sums = v === '1' || v === 'true';
    else if (k === 'sort') q.sort = v.split(',').filter(Boolean).map((s) => (s.startsWith('-') ? { field: s.slice(1), dir: 'desc' as const } : { field: s, dir: 'asc' as const }));
    else if (k.startsWith('f.')) {
      const m = /^f\.([a-z][a-z0-9_]{0,62})\.([a-z]+)$/.exec(k);
      if (!m || !OPS.has(m[2]!)) throw bad(k, 'bộ lọc dạng f.<cột>.<phép> (phép: eq ne in nin prefix like gt gte lt lte between null)');
      const [, field, op] = m as unknown as [string, string, ListOp];
      let value: ListFilter['value'];
      if (LIST_OPS.has(op)) value = splitList(v);
      else if (op === 'between') { const parts = v.split('..'); if (parts.length !== 2) throw bad(k, 'between dạng a..b'); value = parts; }
      else if (op === 'null') value = v === 'true';
      else value = v;
      filters.push({ field, op, value });
    } else throw bad(k, `tham số lạ: ${k}`);
  }
  if (filters.length) q.filters = filters;
  if (q.sort && q.sort.length > 3) throw bad('sort', 'sắp xếp tối đa 3 khoá');
  if (filters.length > 20) throw bad('filters', 'tối đa 20 bộ lọc');
  const canon: ListQuery = {};
  for (const k of ['q', 'filters', 'sort', 'cursor', 'limit', 'count', 'sums'] as const) if (q[k] !== undefined) (canon as Record<string, unknown>)[k] = q[k];
  return canon;
}

/** ListQuery ⇒ chuỗi tham số URL ổn định (thứ tự khoá cố định). */
export function formatListQuery(q: ListQuery): string {
  const p: string[] = [];
  const enc = (s: string) => encodeURIComponent(s).replace(/%2C/g, ',');
  if (q.q) p.push(`q=${enc(q.q)}`);
  for (const f of q.filters ?? []) {
    const v = Array.isArray(f.value)
      ? (f.op === 'between' ? f.value.join('..') : f.value.map((x) => String(x).split(',').join(BS + ',')).join(','))
      : String(f.value);
    p.push(`f.${f.field}.${f.op}=${enc(v)}`);
  }
  if (q.sort?.length) p.push(`sort=${q.sort.map((s) => (s.dir === 'desc' ? '-' : '') + s.field).join(',')}`);
  if (q.cursor) p.push(`cursor=${q.cursor}`);
  if (q.limit) p.push(`limit=${q.limit}`);
  if (q.count) p.push(`count=${q.count}`);
  if (q.sums) p.push('sums=1');
  return p.join('&');
}
