// [2026-11-28 05:22 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 S002-2 — hình trên dây của định danh chung (bizcity_spine@1 1.2, open-platform schema/spine/refs.schema.json):
//   mọi app trên open-core dùng cùng zod — tenant ↔ blog_id, *Ref (bốn hình thức), doc_ref, DocLink, QtyLine (số lượng theo đơn vị nhỏ nhất).
//   Test: vector refs.vectors.json của open-platform (packages/platform/test/spine-refs.test.mjs).
/**
 * Hai khuôn doc_ref:
 *   SPINE_DOC_REF_RE (tệp này) — khuôn TRÊN DÂY giữa các app (spine 1.2): `<module>.<loại>:<id>`, id ký tự an toàn ≤ 200, cho phép `:`.
 *   DOC_REF_RE (doc-refs.ts)   — khuôn LƯU của open-ketoan (CHECK ở migration 0045): id `\S{1,200}`. Khuôn trên dây là TẬP CON của khuôn lưu
 *                                ⇒ mọi doc_ref hợp lệ trên dây đều lưu được; DOC_REF_RE chỉ siết lại sau khi kiểm dữ liệu (S002-6).
 */
import { z } from 'zod';
import { DOC_LINK_ROLES } from './doc-refs.js';

const SLUG_RE = /^[a-z][a-z0-9-]{2,29}$/;
export const SPINE_DOC_REF_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[A-Za-z0-9_.:-]{1,200}$/;

export const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID 26 ký tự Crockford');
/** Slug site (một CSDL mỗi app) trong registry open-setup. */
export const siteSchema = z.string().regex(SLUG_RE, 'site: slug chữ thường, 3–30 ký tự');
/** Mã đơn vị trong site; tenant ↔ blog_id một-một; site một đơn vị: tenant = slug site. */
export const tenantSchema = z.string().regex(SLUG_RE, 'tenant: mã đơn vị chữ thường, 3–30 ký tự');
/** tenants.external_ref — blog WordPress bizcity của đơn vị. */
export const blogRefSchema = z.string().regex(/^wp-blog:[0-9]+$/, 'blog: wp-blog:<id>');
export const subSchema = z.string().regex(/^(wp:[0-9]+|biz:[A-Za-z0-9_-]{1,64})$/, 'sub: wp:<id> hoặc biz:<mã>');
export const uomSchema = z.string().regex(/^[^\s]{1,20}$/, 'ĐVT: tên của chủ, không khoảng trắng, ≤ 20 ký tự');
export const branchCodeSchema = z.string().regex(/^[A-Z0-9_.-]{1,20}$/, 'mã chi nhánh: chữ hoa, số, _ . -');
export const partnerCodeSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,40}$/, 'mã đối tượng ≤ 40 ký tự');
export const spineDocRefSchema = z.string().regex(SPINE_DOC_REF_RE, 'doc_ref dạng <module>.<loại>:<id> (id ký tự an toàn, ≤ 200)');
const dateSchema = z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'ngày YYYY-MM-DD');
const localKeySchema = z.string().regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9_-]*:[A-Za-z0-9_.-]{1,64}$/, 'khoá cục bộ <app>:<loại>:<id>');
/** Số lượng theo ĐƠN VỊ NHỎ NHẤT (tỷ lệ 1), chuỗi thập phân ≤ 4 chữ số lẻ — numeric(18,4). */
export const qtySchema = z.string().regex(/^-?[0-9]{1,14}(\.[0-9]{1,4})?$/, 'số lượng: chuỗi thập phân ≤ 4 chữ số lẻ');
/** Tỷ lệ so với đơn vị nhỏ nhất, ≤ 6 chữ số lẻ — numeric(18,6). */
export const ratioSchema = z.string().regex(/^[0-9]{1,12}(\.[0-9]{1,6})?$/, 'tỷ lệ: chuỗi thập phân ≤ 6 chữ số lẻ');

export const identitySchema = z.object({
  kind: z.enum(['phone', 'email', 'tax_code', 'zalo_uid', 'fb_psid', 'fb_uid', 'bank_account']),
  value: z.string().min(1).max(200),
  scope: z.string().max(100).optional(),
  proof: z.string().max(100).optional(),
}).strict();

const refBase = z.object({
  id: z.string().min(1).max(64).optional(),
  code: z.string().min(1).max(64).optional(),
  as_of: dateSchema.optional(),
  identity: identitySchema.optional(),
  local: localKeySchema.optional(),
}).strict();
const oneForm = (r: z.infer<typeof refBase>) => r.id !== undefined || r.code !== undefined || r.identity !== undefined || r.local !== undefined;
const ONE_FORM = 'cần một trong: id · code · identity · local';

/** Mặt hàng: id = item_id ULID (chỉ khi lấy từ chủ, R-SPINE-1), hoặc mã có hiệu lực tại ngày, hoặc khoá cục bộ. */
export const itemRefSchema = refBase
  .refine(oneForm, ONE_FORM)
  .refine((r) => r.id === undefined || ulidSchema.safeParse(r.id).success, { message: 'id của mặt hàng là ULID', path: ['id'] })
  .refine((r) => r.code === undefined || /^[A-Za-z0-9_.\-/]{1,64}$/.test(r.code), { message: 'mã mặt hàng không hợp lệ', path: ['code'] })
  .refine((r) => r.identity === undefined, { message: 'mặt hàng không có danh tính', path: ['identity'] });
/** Đối tượng công nợ: chỉ mã (partner_id là nội bộ open-ketoan, không lộ ra dây — R-MD-2). */
export const partnerRefSchema = refBase
  .refine(oneForm, ONE_FORM)
  .refine((r) => r.code === undefined || partnerCodeSchema.safeParse(r.code).success, { message: 'mã đối tượng không hợp lệ', path: ['code'] })
  .refine((r) => r.id === undefined, { message: 'không gửi partner_id — gửi mã', path: ['id'] });
/** Khách (open-cake): id = contact_id ULID, hoặc danh tính có bằng chứng; không ghép theo tên. */
export const contactRefSchema = refBase
  .refine(oneForm, ONE_FORM)
  .refine((r) => r.id === undefined || ulidSchema.safeParse(r.id).success, { message: 'contact_id là ULID', path: ['id'] })
  .refine((r) => r.code === undefined, { message: 'khách không gọi bằng mã — dùng id hoặc identity', path: ['code'] });
export const branchRefSchema = z.object({ code: branchCodeSchema, as_of: dateSchema.optional() }).strict();
/** Chỉ để hiện / in — số lượng trên dây là QtyLine.qty. */
export const uomRefSchema = z.object({ uom: uomSchema }).strict();

/** Dòng số lượng (R-SPINE-11..13): qty LUÔN theo đơn vị nhỏ nhất; unit / unitQty / unitRatio chỉ để hiện. */
export const qtyLineSchema = z.object({
  item: itemRefSchema,
  qty: qtySchema,
  unit: uomSchema.optional(),
  unitQty: qtySchema.optional(),
  unitRatio: ratioSchema.optional(),
}).strict()
  .refine((l) => l.unitQty === undefined || (l.unit !== undefined && l.unitRatio !== undefined), { message: 'có unitQty thì phải có unit + unitRatio', path: ['unitQty'] })
  .refine((l) => l.unitRatio === undefined || l.unit !== undefined, { message: 'có unitRatio thì phải có unit', path: ['unitRatio'] });

export const docLinkSchema = z.object({ from: spineDocRefSchema, to: spineDocRefSchema, role: z.enum(DOC_LINK_ROLES) }).strict();
/** Phong bì tối thiểu của mọi lời gọi xuyên app: tenant bắt buộc, site khi một site có nhiều tenant. */
export const envelopeSchema = z.object({ tenant: tenantSchema, site: siteSchema.optional(), actor: z.object({ sub: subSchema }).partial().passthrough().optional() }).passthrough();

// tên SpineItemRef: `ItemRef` đã có ở item-master.ts (khuôn nội bộ của open-ketoan)
export type SpineItemRef = z.infer<typeof itemRefSchema>;
export type PartnerRef = z.infer<typeof partnerRefSchema>;
export type ContactRef = z.infer<typeof contactRefSchema>;
export type BranchRef = z.infer<typeof branchRefSchema>;
export type QtyLine = z.infer<typeof qtyLineSchema>;
export type DocLink = z.infer<typeof docLinkSchema>;

/** Kiểm qty = unitQty × unitRatio (R-SPINE-12) bằng số nguyên phần vạn — không dùng số thực. */
export function qtyMatchesUnits(l: Pick<QtyLine, 'qty' | 'unitQty' | 'unitRatio'>): boolean {
  if (l.unitQty === undefined || l.unitRatio === undefined) return true;
  const scaled = (s: string, d: number) => { const [i, f = ''] = s.replace('-', '').split('.'); const v = BigInt(i + f.padEnd(d, '0').slice(0, d)); return s.startsWith('-') ? -v : v; };
  return scaled(l.unitQty, 4) * scaled(l.unitRatio, 6) === scaled(l.qty, 4) * 10n ** 6n;
}
