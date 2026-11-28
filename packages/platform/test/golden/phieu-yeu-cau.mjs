// [2026-11-29 01:09 AM Johnny Chu - Chu Hoàng Anh] S005-F0-2 — module mẫu "golden": chứng từ Phiếu yêu cầu viết bằng API lõi HIỆN CÓ (0.6) — TP-10…13, 19, 20:
// đánh số + workflow + hoạt động có sẵn (defineDocumentType), nhưng action tạo / chuyển / ghi chú vẫn khai tay từng cái.
import { z } from 'zod';
import { defineAction } from '../../dist/core/actions.js';
import { parseWorkflow } from '../../dist/core/workflow.js';
import { defineDocumentType } from '../../dist/core/document-spine.js';

const workflow = parseWorkflow(`
type: golden.phieu-yeu-cau
label: Phiếu yêu cầu
states:
  draft:    { group: draft, label: Nháp }
  pending:  { group: pending, label: Chờ duyệt }
  approved: { group: approved, label: Đã duyệt }
  void:     { group: cancelled, label: Đã huỷ }
transitions:
  submit:  { title: Gửi duyệt, from: [draft], to: pending, permission: documents:write }
  approve: { title: Duyệt, from: [pending], to: approved, permission: payments:approve, sod: true }
  reject:  { title: Trả lại người lập, from: [pending], to: draft, permission: payments:approve, requires: [reason] }
  cancel:  { title: Huỷ, from: [draft], to: void, permission: documents:write, requires: [reason] }
`, 'golden.phieu-yeu-cau.workflow.yaml');

export const PhieuYeuCau = defineDocumentType({
  type: 'golden.phieu-yeu-cau', label: 'Phiếu yêu cầu', series: 'YC', workflow,
  meta: z.object({ nhomKhach: z.string().max(20), kenh: z.enum(['fanpage', 'zalo', 'cua-hang']) }),
});

const Header = z.object({ docRef: z.string(), docNo: z.string(), status: z.string(), group: z.string(), total: z.number() });
const pick = (h) => ({ docRef: h.docRef, docNo: h.docNo, status: h.status, group: h.group, total: h.total });

export const createPhieu = defineAction({
  id: 'golden.phieu-yeu-cau.create', title: 'Lập phiếu yêu cầu', permission: 'documents:write', effect: 'write', idempotency: 'required',
  sideEffects: ['documents'], expose: { http: { method: 'POST', path: '/api/v1/golden/phieu-yeu-cau' }, mcp: true },
  input: z.object({
    date: z.string().date(), title: z.string().min(1).max(200), partnerRef: z.string().max(40).optional(),
    total: z.number().nonnegative(), meta: z.object({ nhomKhach: z.string().max(20), kenh: z.enum(['fanpage', 'zalo', 'cua-hang']) }),
  }),
  output: Header,
  async handler(ctx, i) { return pick(await ctx.documents.create(PhieuYeuCau.type, i)); },
});

export const transitionPhieu = defineAction({
  id: 'golden.phieu-yeu-cau.transition', title: 'Chuyển trạng thái phiếu yêu cầu', permission: 'documents:read', effect: 'write', idempotency: 'required',
  sideEffects: ['documents'], expose: { http: { method: 'POST', path: '/api/v1/golden/phieu-yeu-cau/:docRef/transition' }, mcp: true },
  input: z.object({ docRef: z.string(), verb: z.enum(['submit', 'approve', 'reject', 'cancel']), reason: z.string().max(500).optional() }),
  output: Header,
  async handler(ctx, { docRef, verb, reason }) { return pick(await ctx.documents.transition(docRef, verb, { reason })); },
});

export const notePhieu = defineAction({
  id: 'golden.phieu-yeu-cau.note', title: 'Ghi chú phiếu yêu cầu', permission: 'documents:write', effect: 'write', idempotency: 'required',
  sideEffects: ['documents'], expose: { http: { method: 'POST', path: '/api/v1/golden/phieu-yeu-cau/:docRef/notes' }, mcp: true },
  input: z.object({ docRef: z.string(), body: z.string().min(1).max(2000) }), output: z.object({ ok: z.boolean() }),
  async handler(ctx, { docRef, body }) { await ctx.documents.note(docRef, body); return { ok: true }; },
});

export const phieuActions = [createPhieu, transitionPhieu, notePhieu];
