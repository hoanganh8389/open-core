// @bizcity-layer P master-data
// [2026-11-28 11:47 PM Johnny Chu - Chu Hoàng Anh] S004-DM-2 + S004-DM-3 — cơ chế danh mục ở lõi (NC-008 ADR-P6, ADR-P3 §2): ánh xạ ID xuyên instance
// và chủ dữ liệu theo trục. Lõi không biết hàng / ĐVT / đối tác là gì (R-CHAIN-0, R-PLAT-3): chỉ lưu "ID này ở bên kia là gì" và "ai là chủ trục này".
/**
 * entityLinks — bảng entity_links (lõi 0007). Chỉ thêm: đổi ánh xạ = đóng dòng cũ (valid_to) + thêm dòng mới; lịch sử tra được theo thời điểm.
 *   link            gắn local → remote (mặc định canonical). Gắn lại đúng cặp đang mở ⇒ trả dòng cũ (idempotent). local đã gắn remote KHÁC
 *                   ⇒ đóng dòng cũ rồi thêm dòng mới (đổi ánh xạ có dấu vết). remote đã thuộc local KHÁC ⇒ CONFLICT (không gộp ngầm, ADR-P2 §8).
 *   resolveLocal    local → remote đang hiệu lực (hoặc tại thời điểm `at`).
 *   resolveRemote   remote (theo id, hoặc theo mã) → local.
 *   close / history đóng một ánh xạ; mọi dòng của một local_id.
 * dataAuthority — bảng data_authority (lõi 0007). App đứng riêng: chủ = chính nó, state local, epoch 1.
 *   ensureLocal     ghi nhận "tôi là chủ trục này" nếu trục chưa có chủ; đã có thì trả nguyên dòng (không giành chủ).
 *   assertWritable  cổng ghi trục: local + đúng instance ⇒ qua; transferring ⇒ CONFLICT AXIS_TRANSFERRING; replica / chủ khác ⇒ CONFLICT AXIS_READ_ONLY.
 *                   Trục chưa ghi nhận ⇒ qua (app đứng riêng chưa từng khai).
 *   Giao thức chuyển local → ketoan (transferring, replica, tăng epoch) là W4 (S004-SY-*): ở đây chưa có hàm chuyển.
 * Hàm nhận giao dịch của người gọi (như documents.*): trong action là ctx.data.tx, ngoài action là trx của service.
 */
import { AXIS_KEY_RE, ENTITY_LINK_KINDS, type DataAuthority, type EntityLink, type EntityLinkKind } from '@bizcity/contracts';
import { sql } from 'kysely';
import type { Db } from '../db/client.js';
import { Errors } from './errors.js';

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const isoOrNull = (v: unknown) => (v == null ? null : iso(v));

function assertKey(v: string, what: string): void {
  if (!AXIS_KEY_RE.test(v)) throw Errors.validation(`${what} phải dạng chữ thường / số / gạch dưới, bắt đầu bằng chữ (≤ 40): ${v}`);
}
function assertText(v: unknown, what: string, max = 200): asserts v is string {
  if (typeof v !== 'string' || v.trim() === '' || v.length > max) throw Errors.validation(`${what} bắt buộc, ≤ ${max} ký tự`);
}

type LinkRow = {
  id: string; entity_type: string; local_id: string; peer_instance: string; remote_id: string; remote_code: string;
  link_kind: EntityLinkKind; valid_from: unknown; valid_to: unknown; created_by: string; evidence_ref: string;
};
const LINK_COLS = ['id', 'entity_type', 'local_id', 'peer_instance', 'remote_id', 'remote_code', 'link_kind', 'valid_from', 'valid_to', 'created_by', 'evidence_ref'] as const;
const toLink = (r: LinkRow): EntityLink => ({
  id: String(r.id), entityType: r.entity_type, localId: r.local_id, peerInstance: r.peer_instance, remoteId: r.remote_id, remoteCode: r.remote_code,
  kind: r.link_kind, validFrom: iso(r.valid_from), validTo: isoOrNull(r.valid_to), createdBy: r.created_by, evidenceRef: r.evidence_ref,
});

export interface LinkInput {
  entityType: string;
  localId: string;
  peerInstance: string;
  remoteId?: string;
  remoteCode?: string;
  kind?: EntityLinkKind;
  evidenceRef?: string;
}

/** Ánh xạ đang hiệu lực tại `at` (mặc định bây giờ): valid_from ≤ at và (valid_to rỗng hoặc > at). */
const activeAt = (at: string | undefined) => (at ? at : new Date().toISOString());

export const entityLinks = {
  async link(tx: Db, tenantId: string, input: LinkInput, actor: string): Promise<EntityLink> {
    assertKey(input.entityType, 'entityType');
    assertText(input.localId, 'localId');
    assertText(input.peerInstance, 'peerInstance');
    assertText(actor, 'actor');
    const kind = input.kind ?? 'canonical';
    if (!(ENTITY_LINK_KINDS as readonly string[]).includes(kind)) throw Errors.validation(`kind không hợp lệ: ${kind}`);
    const remoteId = (input.remoteId ?? '').trim();
    const remoteCode = (input.remoteCode ?? '').trim();
    if (!remoteId && !remoteCode) throw Errors.validation('Cần remoteId hoặc remoteCode');
    const base = { tenant_id: tenantId, entity_type: input.entityType, peer_instance: input.peerInstance };

    if (kind === 'canonical') {
      // Khoá theo (tenant, loại, instance, local) trong giao dịch: hai lời gọi đồng thời cho cùng local nối tiếp nhau.
      const open = await tx.selectFrom('entity_links').select(LINK_COLS)
        .where('tenant_id', '=', tenantId).where('entity_type', '=', input.entityType).where('peer_instance', '=', input.peerInstance)
        .where('local_id', '=', input.localId).where('link_kind', '=', 'canonical').where('valid_to', 'is', null)
        .forUpdate().executeTakeFirst();
      if (open && open.remote_id === remoteId && open.remote_code === remoteCode) return toLink(open as LinkRow);
      if (remoteId) {
        const taken = await tx.selectFrom('entity_links').select(['local_id'])
          .where('tenant_id', '=', tenantId).where('entity_type', '=', input.entityType).where('peer_instance', '=', input.peerInstance)
          .where('remote_id', '=', remoteId).where('link_kind', '=', 'canonical').where('valid_to', 'is', null)
          .executeTakeFirst();
        if (taken && taken.local_id !== input.localId) {
          throw Errors.conflict(`${input.entityType} ${remoteId} ở ${input.peerInstance} đã gắn với ${taken.local_id}: gộp / tách là thao tác của chủ, không tự gộp`, { entityType: input.entityType, remoteId, localId: taken.local_id });
        }
      }
      if (open) {
        await tx.updateTable('entity_links').set({ valid_to: sql`now()` as never, closed_by: actor }).where('id', '=', open.id).execute();
      }
    }
    try {
      const row = await tx.insertInto('entity_links').values({
        ...base, local_id: input.localId, remote_id: remoteId, remote_code: remoteCode, link_kind: kind, created_by: actor, evidence_ref: input.evidenceRef ?? '',
      }).returning(LINK_COLS).executeTakeFirstOrThrow();
      return toLink(row as LinkRow);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw Errors.conflict(`Ánh xạ ${input.entityType} ${input.localId} ↔ ${remoteId || remoteCode} vừa bị ghi đồng thời — thử lại`, { entityType: input.entityType, localId: input.localId });
      }
      throw e;
    }
  },

  async resolveLocal(tx: Db, tenantId: string, q: { entityType: string; peerInstance: string; localId: string; at?: string }): Promise<EntityLink | undefined> {
    const at = activeAt(q.at);
    const row = await tx.selectFrom('entity_links').select(LINK_COLS)
      .where('tenant_id', '=', tenantId).where('entity_type', '=', q.entityType).where('peer_instance', '=', q.peerInstance)
      .where('local_id', '=', q.localId).where('link_kind', '=', 'canonical')
      .where('valid_from', '<=', at as never).where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', at as never)]))
      .orderBy('id', 'desc').executeTakeFirst();
    return row ? toLink(row as LinkRow) : undefined;
  },

  async resolveRemote(tx: Db, tenantId: string, q: { entityType: string; peerInstance: string; remoteId?: string; remoteCode?: string; at?: string }): Promise<EntityLink | undefined> {
    if (!q.remoteId && !q.remoteCode) throw Errors.validation('Cần remoteId hoặc remoteCode');
    const at = activeAt(q.at);
    let sel = tx.selectFrom('entity_links').select(LINK_COLS)
      .where('tenant_id', '=', tenantId).where('entity_type', '=', q.entityType).where('peer_instance', '=', q.peerInstance)
      .where('link_kind', 'in', ['canonical', 'alias', 'merged_from'])
      .where('valid_from', '<=', at as never).where((eb) => eb.or([eb('valid_to', 'is', null), eb('valid_to', '>', at as never)]));
    sel = q.remoteId ? sel.where('remote_id', '=', q.remoteId) : sel.where('remote_code', '=', q.remoteCode!);
    // canonical thắng alias / merged_from; cùng vai thì dòng mới nhất.
    const rows = (await sel.orderBy('id', 'desc').execute()) as LinkRow[];
    const pick = rows.find((r) => r.link_kind === 'canonical') ?? rows[0];
    return pick ? toLink(pick) : undefined;
  },

  async close(tx: Db, tenantId: string, id: string, actor: string): Promise<EntityLink> {
    assertText(actor, 'actor');
    const row = await tx.updateTable('entity_links').set({ valid_to: sql`now()` as never, closed_by: actor })
      .where('tenant_id', '=', tenantId).where('id', '=', id).where('valid_to', 'is', null)
      .returning(LINK_COLS).executeTakeFirst();
    if (!row) throw Errors.notFound(`ánh xạ đang mở ${id}`);
    return toLink(row as LinkRow);
  },

  async history(tx: Db, tenantId: string, q: { entityType: string; localId: string }): Promise<EntityLink[]> {
    const rows = await tx.selectFrom('entity_links').select(LINK_COLS)
      .where('tenant_id', '=', tenantId).where('entity_type', '=', q.entityType).where('local_id', '=', q.localId)
      .orderBy('id', 'asc').execute();
    return (rows as LinkRow[]).map(toLink);
  },
};

type AuthorityRow = { axis: string; owner_instance: string; epoch: number; state: DataAuthority['state']; since: unknown };
const AUTH_COLS = ['axis', 'owner_instance', 'epoch', 'state', 'since'] as const;
const toAuthority = (r: AuthorityRow): DataAuthority => ({ axis: r.axis, ownerInstance: r.owner_instance, epoch: Number(r.epoch), state: r.state, since: iso(r.since) });

export const dataAuthority = {
  async get(tx: Db, tenantId: string, axis: string): Promise<DataAuthority | undefined> {
    assertKey(axis, 'axis');
    const row = await tx.selectFrom('data_authority').select(AUTH_COLS).where('tenant_id', '=', tenantId).where('axis', '=', axis).executeTakeFirst();
    return row ? toAuthority(row as AuthorityRow) : undefined;
  },

  /** Ghi nhận chủ local nếu trục chưa có chủ. Đã có (kể cả chủ khác) ⇒ trả dòng hiện có, không giành chủ. */
  async ensureLocal(tx: Db, tenantId: string, axis: string, instance: string): Promise<DataAuthority> {
    assertKey(axis, 'axis');
    assertText(instance, 'instance');
    await tx.insertInto('data_authority').values({ tenant_id: tenantId, axis, owner_instance: instance })
      .onConflict((oc) => oc.columns(['tenant_id', 'axis']).doNothing()).execute();
    const row = await tx.selectFrom('data_authority').select(AUTH_COLS).where('tenant_id', '=', tenantId).where('axis', '=', axis).executeTakeFirstOrThrow();
    return toAuthority(row as AuthorityRow);
  },

  /** Cổng ghi một trục danh mục của app `instance`. Ném CONFLICT (reason AXIS_TRANSFERRING / AXIS_READ_ONLY) khi không được ghi. */
  async assertWritable(tx: Db, tenantId: string, axis: string, instance: string): Promise<void> {
    const a = await dataAuthority.get(tx, tenantId, axis);
    if (!a) return;
    if (a.state === 'transferring') {
      throw Errors.conflict(`Danh mục ${axis} đang chuyển chủ: tạm dừng ghi`, { reason: 'AXIS_TRANSFERRING', axis, epoch: a.epoch });
    }
    if (a.state === 'replica' || a.ownerInstance !== instance) {
      throw Errors.conflict(`Danh mục ${axis} do ${a.ownerInstance} quản lý: gửi đề xuất, không sửa ở đây`, { reason: 'AXIS_READ_ONLY', axis, owner: a.ownerInstance, epoch: a.epoch });
    }
  },
};
