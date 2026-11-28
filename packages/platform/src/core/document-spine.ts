// @bizcity-layer P documents
// [2026-11-28 07:52 PM Johnny Chu - Chu Hoàng Anh] S003-14 + S003-19 — trục chứng từ chung (NC-007 §3, §8), học WordPress:
//   register_post_type → defineDocumentType · wp_posts → business_documents · post_status + transition → workflow YAML + transition()
//   postmeta → business_documents.meta (khoá khai trong loại, kiểm bằng zod) · comments / nhật ký → document_activities (chỉ thêm)
//   trash → huỷ (cancelled) + lưu trữ (archived_at), không xoá (R-DEL) · tiền tệ + tỷ giá ở đầu phiếu, đóng băng khi rời nháp (R-FX).
/**
 * App mới (open-cake, open-hrm, open-kiot…) ghi đầu phiếu qua đây; open-ketoan vẫn đồng bộ business_documents bằng trigger từ bảng nguồn
 * — một loại chứng từ chỉ một cách ghi (loại khai ở đây = lõi ghi). Bảng dòng chi tiết là của app, khoá theo doc_ref.
 * Mọi hàm nhận giao dịch của người gọi (trong action: ctx.data.tx — ctx.documents.* gói sẵn).
 */
import { z } from 'zod';
import { BASE_CURRENCY, CURRENCY_RE, roundCurrency, toBaseAmount, type DocRef } from '@bizcity/contracts';
import type { Db } from '../db/client.js';
import { Errors } from './errors.js';
import { documents } from './documents.js';
import type { Workflow, WorkflowActor, StatusGroup } from './workflow.js';

export interface DocumentTypeDef {
  /** `<module>.<loại>` — trùng `workflow.type`, là tiền tố của doc_ref. */
  type: string;
  label: string;
  /** Dãy số (chữ hoa / số, ≤ 10 ký tự): số chứng từ `<series>-<năm>-<số>`. */
  series: string;
  workflow: Workflow;
  /** Khoá meta được phép (như register_meta): không khai = không nhận meta. */
  meta?: z.AnyZodObject;
}

const TYPE_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
const types = new Map<string, DocumentTypeDef>();

export function defineDocumentType(def: DocumentTypeDef): DocumentTypeDef {
  if (!TYPE_RE.test(def.type)) throw new Error(`Loại chứng từ dạng <module>.<loại>: ${def.type}`);
  if (def.workflow.type !== def.type) throw new Error(`Loại ${def.type} khác workflow.type ${def.workflow.type}`);
  if (!def.workflow.statesIn('draft').length) throw new Error(`Workflow ${def.type} cần ít nhất một trạng thái nhóm draft (trạng thái đầu)`);
  if (types.has(def.type) && types.get(def.type) !== def) throw new Error(`Loại chứng từ ${def.type} đã khai`);
  types.set(def.type, def);
  return def;
}
export function documentType(type: string): DocumentTypeDef {
  const t = types.get(type);
  if (!t) throw Errors.notFound(`loại chứng từ ${type}`);
  return t;
}
export function listDocumentTypes(): DocumentTypeDef[] { return [...types.values()]; }

/** Tiền của đầu phiếu. Cùng tiền hạch toán: chỉ `total`. Ngoại tệ: `currency` + `fxRate` + `totalFc` ⇒ `total` tính ở máy chủ. */
export interface MoneyInput { total?: number; currency?: string; fxRate?: number; totalFc?: number }
export interface DocumentHeaderInput extends MoneyInput {
  date?: string;
  title?: string;
  partnerRef?: string;
  orgUnitCode?: string;
  meta?: Record<string, unknown>;
}
export interface DocumentHeader {
  docRef: DocRef; type: string; docNo: string; date: string | null; title: string; partnerRef: string; orgUnitCode: string;
  status: string; group: StatusGroup; version: number; total: number; currency: string; fxRate: number; totalFc: number | null;
  meta: Record<string, unknown>; createdBy: string; approvedBy: string; archived: boolean;
}

/** R-FX-1..3: quy về tiền hạch toán; cùng tiền ⇒ tỷ giá 1, không có nguyên tệ. */
export function resolveMoney(m: MoneyInput, base = BASE_CURRENCY): { total: number; currency: string; fxRate: number; totalFc: number | null } {
  const currency = m.currency ?? base;
  if (!CURRENCY_RE.test(currency)) throw Errors.validation(`Mã tiền tệ ISO 4217 (ba chữ hoa): ${currency}`);
  if (currency === base) {
    if (m.fxRate !== undefined && m.fxRate !== 1) throw Errors.validation(`Chứng từ bằng ${base} thì tỷ giá là 1`);
    return { total: roundCurrency(m.total ?? 0, base), currency, fxRate: 1, totalFc: null };
  }
  if (!(m.fxRate! > 0)) throw Errors.validation(`Chứng từ bằng ${currency} cần tỷ giá > 0 (R-FX-3)`);
  if (m.totalFc === undefined) throw Errors.validation(`Chứng từ bằng ${currency} cần tổng nguyên tệ (totalFc)`);
  const totalFc = roundCurrency(m.totalFc, currency);
  const total = toBaseAmount(totalFc, m.fxRate!, base);
  if (m.total !== undefined && roundCurrency(m.total, base) !== total) throw Errors.validation(`Tổng ${base} phải = ${totalFc} ${currency} × ${m.fxRate} = ${total} (máy chủ tính, R-FX-2)`);
  return { total, currency, fxRate: m.fxRate!, totalFc };
}

const checkMeta = (t: DocumentTypeDef, meta: Record<string, unknown>) => {
  if (!Object.keys(meta).length) return meta;
  if (!t.meta) throw Errors.validation(`Loại ${t.type} không khai meta — thêm khoá vào defineDocumentType trước khi ghi`);
  const r = t.meta.partial().strict().safeParse(meta);
  if (!r.success) throw Errors.validation(`Meta của ${t.type} sai: ${r.error.issues.map((i) => `${i.path.join('.') || '(khoá lạ)'}: ${i.message}`).join('; ')}`);
  return r.data as Record<string, unknown>;
};

type Row = Record<string, unknown> & { doc_ref: string; doc_type: string; status_raw: string; status: string };
const toHeader = (r: Row): DocumentHeader => ({
  docRef: r.doc_ref as DocRef, type: r.doc_type, docNo: String(r.doc_no), date: r.doc_date ? String(r.doc_date).slice(0, 10) : null, title: String(r.title),
  partnerRef: String(r.partner_ref), orgUnitCode: String(r.org_unit_code), status: r.status_raw, group: r.status as StatusGroup, version: Number(r.version),
  total: Number(r.total), currency: String(r.currency), fxRate: Number(r.fx_rate), totalFc: r.total_fc == null ? null : Number(r.total_fc),
  meta: (r.meta ?? {}) as Record<string, unknown>, createdBy: String(r.created_by), approvedBy: String(r.approved_by), archived: r.archived_at != null,
});

const activity = (tx: Db, tenantId: string, docRef: string, a: { kind: 'create' | 'transition' | 'note' | 'meta' | 'archive' | 'restore'; actor: string; from?: string; to?: string; reason?: string; body?: string; data?: unknown }) =>
  tx.insertInto('document_activities').values({
    tenant_id: tenantId, doc_ref: docRef, kind: a.kind, from_status: a.from ?? null, to_status: a.to ?? null, reason: a.reason ?? '', body: a.body ?? '',
    data: JSON.stringify(a.data ?? {}), actor: a.actor,
  }).execute();

async function load(tx: Db, tenantId: string, docRef: string, lock = false): Promise<Row> {
  let q = tx.selectFrom('business_documents').selectAll().where('tenant_id', '=', tenantId).where('doc_ref', '=', docRef);
  if (lock) q = q.forUpdate();
  const r = await q.executeTakeFirst();
  if (!r) throw Errors.notFound(`chứng từ ${docRef}`);
  return r as unknown as Row;
}

export const documentSpine = {
  /** Tạo đầu phiếu ở trạng thái nháp đầu tiên, cấp số theo dãy của loại, ghi hoạt động "create". */
  async create(tx: Db, tenantId: string, type: string, input: DocumentHeaderInput, actor: string, opts: { baseCurrency?: string } = {}): Promise<DocumentHeader> {
    const t = documentType(type);
    const money = resolveMoney(input, opts.baseCurrency);
    const meta = checkMeta(t, input.meta ?? {});
    const docNo = await documents.nextNumber(tx, tenantId, type.split('.')[0]!, t.series, input.date ? { date: input.date } : {});
    const docRef = `${type}:${docNo}`;
    const first = t.workflow.statesIn('draft')[0]!;
    const row = await tx.insertInto('business_documents').values({
      tenant_id: tenantId, doc_ref: docRef, module: type.split('.')[0]!, doc_type: type, doc_no: docNo, doc_date: input.date ?? null,
      title: input.title ?? '', partner_ref: input.partnerRef ?? '', org_unit_code: input.orgUnitCode ?? '', status_raw: first, status: 'draft',
      total: String(money.total), currency: money.currency, fx_rate: String(money.fxRate), total_fc: money.totalFc == null ? null : String(money.totalFc),
      meta: JSON.stringify(meta), created_by: actor,
    }).returningAll().executeTakeFirstOrThrow();
    await activity(tx, tenantId, docRef, { kind: 'create', actor, to: first });
    return toHeader(row as unknown as Row);
  },

  async get(tx: Db, tenantId: string, docRef: string): Promise<DocumentHeader> { return toHeader(await load(tx, tenantId, docRef)); },

  /** Sửa đầu phiếu — chỉ khi đang nháp (R-FX: tiền và tỷ giá đóng băng khi rời nháp; sửa sau duyệt = phiên bản mới). */
  async update(tx: Db, tenantId: string, docRef: string, patch: DocumentHeaderInput, actor: string, opts: { baseCurrency?: string } = {}): Promise<DocumentHeader> {
    const r = await load(tx, tenantId, docRef, true);
    const t = documentType(r.doc_type);
    if (!t.workflow.editable(r.status_raw)) throw Errors.conflict(`${t.label} ${r.doc_no} đang "${t.workflow.label(r.status_raw)}": chỉ sửa được khi nháp`);
    const cur = toHeader(r);
    const moneyTouched = ['total', 'currency', 'fxRate', 'totalFc'].some((k) => k in patch);
    const money = moneyTouched ? resolveMoney({ currency: cur.currency, ...(cur.totalFc == null ? { total: cur.total } : { fxRate: cur.fxRate, totalFc: cur.totalFc }), ...patch }, opts.baseCurrency) : null;
    const meta = patch.meta ? checkMeta(t, { ...cur.meta, ...patch.meta }) : undefined;
    const row = await tx.updateTable('business_documents').set({
      ...(patch.date !== undefined ? { doc_date: patch.date } : {}), ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.partnerRef !== undefined ? { partner_ref: patch.partnerRef } : {}), ...(patch.orgUnitCode !== undefined ? { org_unit_code: patch.orgUnitCode } : {}),
      ...(money ? { total: String(money.total), currency: money.currency, fx_rate: String(money.fxRate), total_fc: money.totalFc == null ? null : String(money.totalFc) } : {}),
      ...(meta ? { meta: JSON.stringify(meta) } : {}), updated_at: new Date().toISOString(),
    }).where('tenant_id', '=', tenantId).where('doc_ref', '=', docRef).returningAll().executeTakeFirstOrThrow();
    if (meta) await activity(tx, tenantId, docRef, { kind: 'meta', actor, data: patch.meta });
    return toHeader(row as unknown as Row);
  },

  /** Chuyển trạng thái theo workflow (quyền, tách nhiệm, lý do — workflow.plan); ghi hoạt động "transition". */
  async transition(tx: Db, tenantId: string, docRef: string, verb: string, who: WorkflowActor, input: { reason?: string } = {}): Promise<DocumentHeader & { ledger: boolean }> {
    const r = await load(tx, tenantId, docRef, true);
    const t = documentType(r.doc_type);
    if (r.archived_at) throw Errors.conflict(`${r.doc_no} đang lưu trữ — khôi phục trước`);
    const step = t.workflow.plan(verb, { id: docRef, status: r.status_raw, createdBy: String(r.created_by) }, who, input);
    const approved = step.group === 'approved';
    const row = await tx.updateTable('business_documents').set({
      status_raw: step.to, status: step.group, updated_at: new Date().toISOString(),
      ...(approved ? { approved_by: who.id, approved_at: new Date().toISOString() } : {}),
    }).where('tenant_id', '=', tenantId).where('doc_ref', '=', docRef).returningAll().executeTakeFirstOrThrow();
    await activity(tx, tenantId, docRef, { kind: 'transition', actor: who.id, from: step.from, to: step.to, reason: input.reason?.trim(), data: { verb, ...(step.level ? { level: step.level } : {}) } });
    return { ...toHeader(row as unknown as Row), ledger: step.ledger };
  },

  /** Ghi chú (chatter). */
  async note(tx: Db, tenantId: string, docRef: string, body: string, actor: string): Promise<void> {
    if (!body.trim()) throw Errors.validation('Ghi chú trống');
    await load(tx, tenantId, docRef);
    await activity(tx, tenantId, docRef, { kind: 'note', actor, body: body.trim() });
  },

  /** Lưu trữ — chỉ chứng từ đã kết thúc (nhóm done / cancelled); không xoá (R-DEL). */
  async archive(tx: Db, tenantId: string, docRef: string, actor: string, reason: string): Promise<void> {
    const r = await load(tx, tenantId, docRef, true);
    if (!['done', 'cancelled'].includes(r.status)) throw Errors.conflict(`${r.doc_no} chưa kết thúc (đang ${r.status_raw}) — huỷ hoặc hoàn tất trước khi lưu trữ`);
    if (!reason.trim()) throw Errors.validation('Cần ghi lý do lưu trữ');
    if (r.archived_at) return;
    await tx.updateTable('business_documents').set({ archived_at: new Date().toISOString() }).where('tenant_id', '=', tenantId).where('doc_ref', '=', docRef).execute();
    await activity(tx, tenantId, docRef, { kind: 'archive', actor, reason: reason.trim() });
  },

  async restore(tx: Db, tenantId: string, docRef: string, actor: string): Promise<void> {
    const r = await load(tx, tenantId, docRef, true);
    if (!r.archived_at) return;
    await tx.updateTable('business_documents').set({ archived_at: null }).where('tenant_id', '=', tenantId).where('doc_ref', '=', docRef).execute();
    await activity(tx, tenantId, docRef, { kind: 'restore', actor });
  },

  /** Hoạt động cũ → mới. */
  async activities(tx: Db, tenantId: string, docRef: string) {
    const rows = await tx.selectFrom('document_activities').selectAll().where('tenant_id', '=', tenantId).where('doc_ref', '=', docRef).orderBy('id').execute();
    return rows.map((a) => ({ kind: a.kind, from: a.from_status, to: a.to_status, reason: a.reason, body: a.body, data: a.data, actor: a.actor, at: new Date(a.created_at as unknown as string).toISOString() }));
  },
};
