// @bizcity-layer P entity
// [2026-11-29 01:17 AM Johnny Chu - Chu Hoàng Anh] S005-F1 — Entity Registry (PHASE-005 · 20): một khai báo defineEntity ⇒ schema kiểm dữ liệu, danh sách / xuất
// (defineListAction), đọc theo ID, metadata giao diện; lớp config / record sinh thêm thêm / sửa / lưu trữ / nhập chạy thử — đều là defineAction (idempotency,
// quyền, audit, sự kiện <key>.changed). Lớp master / replica / document / ledger KHÔNG sinh ghi (Q-P5-4, SC-ENT-1).
/**
 * Entity Registry — bản đầu (S005-F1-1, F1-4, một phần F2-1…F2-3).
 *   field.*       kiểu trường: mang sẵn cách kiểm (zod), kiểu cột danh sách, cách nhập (chuỗi ⇒ giá trị), nhãn.
 *   defineEntity  khai thực thể trên BẢNG CỦA APP (storage: { table }). Bảng phải có cột id (identity), tenant_id, created_by, updated_at,
 *                 và archived_at khi lifecycle = 'archive'. Lõi không tạo bảng (ADR-0001 D2): migration là của app.
 *   Chưa có ở bản này: extendEntity / registerField / registerRelation / registerValidator (F1-2), storage 'meta' / 'extension' (F1-3),
 *                      field.ref + bộ chọn (F1-2), che 'sensitive' ở API chi tiết.
 */
import { z } from 'zod';
import { sql, type Kysely } from 'kysely';
import { defineAction, type AnyActionDef } from '../core/actions.js';
import type { Permission } from '../core/auth.js';
import { Errors } from '../core/errors.js';
import { defineListAction, type ColType, type ListColumn, type ListDef } from '../core/list.js';

export type FieldKind = 'text' | 'code' | 'number' | 'money' | 'bool' | 'enum' | 'date';
export interface FieldDef {
  kind: FieldKind;
  label: string;
  optional?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  /** code: chuẩn hoá chữ hoa. */
  upper?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
  values?: readonly string[];
  /** Duy nhất trong tenant (chống trùng, TP-22): báo CONFLICT có trường + cách sửa; nhập báo theo dòng. */
  unique?: boolean;
  search?: boolean;
  sort?: boolean;
  /** false ⇒ không có cột trong danh sách / xuất. */
  list?: boolean;
  /** Tên cột khác được nhận khi nhập (so không phân biệt hoa thường), thêm vào nhãn. */
  aliases?: readonly string[];
}
type Opts = Omit<FieldDef, 'kind' | 'label' | 'values'>;
export const field = {
  text: (label: string, o: Opts = {}): FieldDef => ({ kind: 'text', label, ...o }),
  code: (label: string, o: Opts = {}): FieldDef => ({ kind: 'code', label, sort: true, search: true, ...o }),
  number: (label: string, o: Opts = {}): FieldDef => ({ kind: 'number', label, ...o }),
  money: (label: string, o: Opts = {}): FieldDef => ({ kind: 'money', label, ...o }),
  bool: (label: string, o: Opts = {}): FieldDef => ({ kind: 'bool', label, ...o }),
  enum: (label: string, values: readonly string[], o: Opts = {}): FieldDef => ({ kind: 'enum', label, values, ...o }),
  date: (label: string, o: Opts = {}): FieldDef => ({ kind: 'date', label, ...o }),
};

/** Sáu lớp thực thể (PHASE-005 · 20 §4). Ghi sinh tự động chỉ cho config / record (Q-P5-4). */
export const ENTITY_CLASSES = ['config', 'record', 'master', 'replica', 'document', 'ledger'] as const;
export type EntityClass = (typeof ENTITY_CLASSES)[number];
const WRITABLE: readonly EntityClass[] = ['config', 'record'];

export interface EntityInput {
  /** `<module>.<thực thể>` (gạch nối, như mã action). */
  key: string;
  label: string;
  class: EntityClass;
  storage: { table: string };
  fields: Record<string, FieldDef>;
  permissions: { read: Permission; write?: Permission };
  lifecycle?: 'archive';
  /** Đường REST gốc; mặc định /api/v1/<module>/<thực thể>. */
  path?: string;
  defaultSort?: string;
}

export interface EntityDef extends EntityInput {
  schemas: { create: z.AnyZodObject; patch: z.AnyZodObject; output: z.AnyZodObject };
  listDef: ListDef;
  actions: Record<'list' | 'export' | 'get', AnyActionDef> & Partial<Record<'create' | 'update' | 'archive' | 'import', AnyActionDef>>;
}

const KEY_RE = /^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/;
const COL_RE = /^[a-z][a-z0-9_]{0,62}$/;
const registry = new Map<string, EntityDef>();

function zodOf(f: FieldDef, coerce: boolean): z.ZodTypeAny {
  let s: z.ZodTypeAny;
  switch (f.kind) {
    case 'text':
    case 'code': {
      let t = z.string().trim();
      if (f.min !== undefined) t = t.min(f.min); else if (!f.optional && f.default === undefined) t = t.min(1);
      if (f.max !== undefined) t = t.max(f.max);
      if (f.pattern) t = t.regex(f.pattern, f.patternMessage);
      s = f.upper ? z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), t) : t;
      break;
    }
    case 'number':
    case 'money': {
      let n = z.coerce.number(); // REST qua query string và tệp nhập gửi chuỗi số
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      s = n;
      break;
    }
    case 'bool': s = coerce ? z.preprocess((v) => (typeof v === 'string' ? ['1', 'true', 'có', 'x'].includes(v.trim().toLowerCase()) : v), z.boolean()) : z.boolean(); break;
    case 'enum': s = z.enum(f.values as [string, ...string[]]); break;
    case 'date': s = z.string().date(); break;
  }
  if (f.default !== undefined) return s.default(f.default);
  return f.optional ? s.optional() : s;
}
const colType = (f: FieldDef): ColType => (f.kind === 'code' ? 'text' : f.kind);
const any = (tx: unknown) => tx as Kysely<any>; // bảng của app: tên khai lúc chạy, kiểu không biết trước

/** Khai một thực thể. Lỗi khai báo ném ngay lúc nạp (Conformance Gate SC-ENT-1 cho phần sinh ghi). */
export function defineEntity(input: EntityInput): EntityDef {
  const bad: string[] = [];
  if (!KEY_RE.test(input.key)) bad.push(`key "${input.key}" phải dạng <module>.<thực-thể>`);
  if (!ENTITY_CLASSES.includes(input.class)) bad.push(`class "${input.class}" lạ`);
  if (!COL_RE.test(input.storage.table)) bad.push(`bảng "${input.storage.table}" không phải định danh SQL`);
  const names = Object.keys(input.fields);
  if (!names.length) bad.push('cần ít nhất một trường');
  for (const n of names) {
    if (!COL_RE.test(n) || ['id', 'tenant_id', 'archived_at', 'created_by', 'created_at', 'updated_at'].includes(n)) bad.push(`trường "${n}" không hợp lệ hoặc trùng cột hệ thống`);
    const f = input.fields[n]!;
    if (f.kind === 'enum' && !f.values?.length) bad.push(`trường ${n}: enum cần values`);
  }
  if (WRITABLE.includes(input.class) && !input.permissions.write) bad.push(`lớp ${input.class} cần permissions.write`);
  // SC-ENT-1: lớp master / replica / document / ledger không có ghi sinh tự động — khai quyền ghi ở đây là nhầm chỗ.
  if (!WRITABLE.includes(input.class) && input.permissions.write) {
    bad.push(`SC-ENT-1: lớp ${input.class} không sinh ghi tự động — bỏ permissions.write, viết action của chủ (master) / dùng documentSpine (document) / cổng sổ (ledger)`);
  }
  if (registry.has(input.key)) bad.push(`thực thể ${input.key} đã khai`);
  if (bad.length) throw new Error(`defineEntity ${input.key}: ${bad.join('; ')}`);

  const [mod, ent] = input.key.split('.') as [string, string];
  const path = input.path ?? `/api/v1/${mod}/${ent}`;
  const table = input.storage.table;
  const archive = input.lifecycle === 'archive';
  const F = input.fields;
  const shape = (coerce: boolean) => Object.fromEntries(names.map((n) => [n, zodOf(F[n]!, coerce)]));
  const create = z.object(shape(false));
  const createFromText = z.object(shape(true));
  const patch = create.partial().extend({ id: z.string() });
  const outShape: Record<string, z.ZodTypeAny> = { id: z.string() };
  for (const n of names) outShape[n] = z.unknown();
  if (archive) outShape.archived = z.boolean();
  const output = z.object(outShape);
  const COLS = ['id', ...names, ...(archive ? ['archived_at'] : [])];
  const toOut = (r: Record<string, unknown>) => {
    const o: Record<string, unknown> = { id: String(r.id) };
    for (const n of names) o[n] = ['number', 'money'].includes(F[n]!.kind) && r[n] != null ? Number(r[n]) : r[n];
    if (archive) o.archived = r.archived_at != null;
    return o;
  };

  // ── danh sách + xuất (TP-03, TP-05): cột lấy từ trường, phép lọc mặc định theo kiểu ──
  const columns: ListColumn[] = names.filter((n) => F[n]!.list !== false).map((n) => ({
    field: n, type: colType(F[n]!), label: F[n]!.label, sql: n,
    ...(F[n]!.search ? { search: true } : {}), ...(F[n]!.sort !== false ? { sort: true } : {}),
  }));
  if (archive) columns.push({ field: 'archived_at', type: 'datetime', label: 'Lưu trữ lúc', sql: 'archived_at', ops: ['null'] });
  const sortField = input.defaultSort ?? names.find((n) => F[n]!.kind === 'code') ?? names[0]!;
  const listed = defineListAction({
    id: `${input.key}.list`, label: input.label, permission: input.permissions.read, exportPermission: input.permissions.read, from: table, columns,
    defaultSort: [{ field: sortField, dir: 'asc' }], ...(archive ? { defaultWhere: [{ unlessField: 'archived_at', sql: 'archived_at IS NULL' }] } : {}), http: { path },
  });

  async function findById(tx: unknown, tenantId: string, id: string) {
    const r = await any(tx).selectFrom(table).select(COLS).where('tenant_id', '=', tenantId).where('id', '=', id).executeTakeFirst();
    if (!r) throw Errors.notFound(`${input.label.toLowerCase()} ${id}`);
    return r as Record<string, unknown>;
  }
  // TP-22: trường unique — trùng ⇒ CONFLICT nêu trường + cách sửa
  async function assertUnique(tx: unknown, tenantId: string, values: Record<string, unknown>, exceptId?: string) {
    for (const n of names.filter((k) => F[k]!.unique && values[k] !== undefined)) {
      let q = any(tx).selectFrom(table).select('id').where('tenant_id', '=', tenantId).where(n, '=', values[n]);
      if (exceptId) q = q.where('id', '<>', exceptId);
      if (await q.executeTakeFirst()) throw Errors.conflict(`${F[n]!.label} ${String(values[n])} đã có — chọn giá trị khác`, { field: n });
    }
  }

  const get = defineAction({
    id: `${input.key}.get`, title: `Xem ${input.label.toLowerCase()}`, permission: input.permissions.read, effect: 'read', idempotency: 'natural',
    input: z.object({ id: z.string() }), output, expose: { http: { method: 'GET', path: `${path}/:id` }, mcp: true, ai: 'read' },
    async handler(ctx, { id }) { return toOut(await findById(ctx.data.tx, ctx.tenant.id, id)); },
  });
  const actions: EntityDef['actions'] = { list: listed.list, export: listed.export!, get };

  if (WRITABLE.includes(input.class)) {
    const write = input.permissions.write!;
    const changed = (ctx: { events: { emit: (t: string, d: Record<string, unknown>, o: { subject: string }) => Promise<unknown> } }, id: string, op: string) =>
      ctx.events.emit(`${input.key}.changed`, { id, op }, { subject: `${input.key}:${id}` });
    const insert = async (tx: unknown, tenantId: string, actor: string, v: Record<string, unknown>) =>
      (await any(tx).insertInto(table).values({ tenant_id: tenantId, ...v, created_by: actor }).returning(COLS).executeTakeFirstOrThrow()) as Record<string, unknown>;

    actions.create = defineAction({
      id: `${input.key}.create`, title: `Thêm ${input.label.toLowerCase()}`, permission: write, effect: 'write', idempotency: 'required', sideEffects: ['documents'], dryRun: true,
      input: create, output, expose: { http: { method: 'POST', path }, mcp: true },
      async handler(ctx, v) {
        await assertUnique(ctx.data.tx, ctx.tenant.id, v);
        const r = await insert(ctx.data.tx, ctx.tenant.id, ctx.actor.id, v);
        await changed(ctx, String(r.id), 'create');
        return toOut(r);
      },
    });
    actions.update = defineAction({
      id: `${input.key}.update`, title: `Sửa ${input.label.toLowerCase()}`, permission: write, effect: 'write', idempotency: 'required', sideEffects: ['documents'], dryRun: true,
      input: patch, output, expose: { http: { method: 'PATCH', path: `${path}/:id` }, mcp: true },
      async handler(ctx, input) {
        const { id: rawId, ...v } = input as Record<string, unknown>;
        const id = String(rawId);
        const cur = await findById(ctx.data.tx, ctx.tenant.id, id);
        if (archive && cur.archived_at) throw Errors.conflict(`${input.label} đã lưu trữ: khôi phục trước khi sửa`);
        await assertUnique(ctx.data.tx, ctx.tenant.id, v, id);
        const r = await any(ctx.data.tx).updateTable(table).set({ ...v, updated_at: sql`now()` }).where('tenant_id', '=', ctx.tenant.id).where('id', '=', id)
          .returning(COLS).executeTakeFirstOrThrow();
        await changed(ctx, id, 'update');
        return toOut(r as Record<string, unknown>);
      },
    });
    if (archive) {
      actions.archive = defineAction({
        id: `${input.key}.archive`, title: `Lưu trữ / khôi phục ${input.label.toLowerCase()}`, permission: write, effect: 'write', idempotency: 'natural', sideEffects: ['documents'],
        input: z.object({ id: z.string(), restore: z.boolean().default(false) }), output, expose: { http: { method: 'POST', path: `${path}/:id/archive` }, mcp: true },
        async handler(ctx, { id, restore }) {
          await findById(ctx.data.tx, ctx.tenant.id, id);
          const r = await any(ctx.data.tx).updateTable(table).set({ archived_at: restore ? null : sql`now()`, updated_at: sql`now()` })
            .where('tenant_id', '=', ctx.tenant.id).where('id', '=', id).returning(COLS).executeTakeFirstOrThrow();
          await changed(ctx, id, restore ? 'restore' : 'archive');
          return toOut(r as Record<string, unknown>);
        },
      });
    }
    // TP-06: nhập = cùng kiểm của "thêm" cho từng dòng; chạy thử mặc định; lỗi theo dòng + trường; có lỗi ⇒ không ghi dòng nào
    const ImportErr = z.object({ row: z.number(), field: z.string(), message: z.string() });
    actions.import = defineAction({
      id: `${input.key}.import`, title: `Nhập ${input.label.toLowerCase()}`, permission: write, effect: 'write', idempotency: 'required', sideEffects: ['documents'],
      input: z.object({ rows: z.array(z.array(z.string())).min(2).max(5001), dryRun: z.boolean().default(true) }),
      output: z.object({ ok: z.number(), errors: z.array(ImportErr), written: z.boolean() }), expose: { http: { method: 'POST', path: `${path}/import` } },
      async handler(ctx, { rows, dryRun }) {
        const header = rows[0]!.map((h) => h.trim().toLowerCase());
        const col: Record<string, number> = {};
        for (const n of names) {
          const i = header.findIndex((h) => [F[n]!.label, n, ...(F[n]!.aliases ?? [])].some((a) => a.toLowerCase() === h));
          if (i >= 0) col[n] = i;
        }
        const missing = names.filter((n) => col[n] === undefined && !F[n]!.optional && F[n]!.default === undefined);
        if (missing.length) throw Errors.validation(`Tệp thiếu cột: ${missing.map((n) => F[n]!.label).join(', ')}`);
        const errors: z.infer<typeof ImportErr>[] = [];
        const good: Record<string, unknown>[] = [];
        const seen: Record<string, Set<unknown>> = {};
        for (let r = 1; r < rows.length; r++) {
          const raw = Object.fromEntries(Object.entries(col).map(([n, i]) => [n, rows[r]![i] ?? '']));
          const p = createFromText.safeParse(raw);
          if (!p.success) { for (const e of p.error.issues) errors.push({ row: r + 1, field: String(e.path[0] ?? ''), message: e.message }); continue; }
          const dup = names.find((n) => F[n]!.unique && (seen[n] ??= new Set()).has(p.data[n]));
          if (dup) { errors.push({ row: r + 1, field: dup, message: `${F[dup]!.label} ${String(p.data[dup])} lặp trong tệp` }); continue; }
          for (const n of names) if (F[n]!.unique) seen[n]!.add(p.data[n]);
          try { await assertUnique(ctx.data.tx, ctx.tenant.id, p.data); good.push(p.data); } catch (e) {
            errors.push({ row: r + 1, field: String((e as { details?: { field?: string } }).details?.field ?? ''), message: (e as Error).message });
          }
        }
        if (dryRun || errors.length) return { ok: good.length, errors, written: false };
        for (const v of good) await insert(ctx.data.tx, ctx.tenant.id, ctx.actor.id, v);
        await ctx.events.emit(`${input.key}.imported`, { count: good.length }, { subject: `${input.key}:*` });
        return { ok: good.length, errors, written: true };
      },
    });
  }

  const def: EntityDef = { ...input, schemas: { create, patch, output }, listDef: listed.def, actions };
  registry.set(input.key, def);
  return def;
}

/** Mọi thực thể đã khai (thứ tự khai). */
export const listEntities = (): EntityDef[] => [...registry.values()];
export const getEntity = (key: string): EntityDef | undefined => registry.get(key);
/** Chỉ cho test: xoá registry. */
export const resetEntities = (): void => { registry.clear(); };

/** Metadata một thực thể cho web-shell / MCP / agent (không có SQL, không có bảng). */
export function entityMeta(def: EntityDef) {
  return {
    key: def.key, label: def.label, class: def.class, lifecycle: def.lifecycle ?? null,
    fields: Object.entries(def.fields).map(([name, f]) => ({
      name, kind: f.kind, label: f.label, required: !f.optional && f.default === undefined, ...(f.values ? { values: f.values } : {}),
      ...(f.unique ? { unique: true } : {}), search: !!f.search, list: f.list !== false, ...(f.max !== undefined ? { max: f.max } : {}),
    })),
    actions: Object.fromEntries(Object.entries(def.actions).map(([verb, a]) => [verb, a!.id])),
    permissions: def.permissions,
  };
}

/** `core.meta.entities` — GET /api/v1/meta/entities: thực thể người gọi được đọc (lọc theo quyền read). */
export const entitiesMetaAction = defineAction({
  id: 'core.meta.entities', title: 'Danh mục thực thể', permission: 'public', effect: 'read', idempotency: 'natural',
  input: z.object({}), output: z.object({ entities: z.array(z.record(z.unknown())) }), expose: { http: { method: 'GET', path: '/api/v1/meta/entities' }, mcp: true, ai: 'read' },
  async handler(ctx) { return { entities: listEntities().filter((e) => ctx.can(e.permissions.read)).map(entityMeta) }; },
});
