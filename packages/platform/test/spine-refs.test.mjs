// [2026-11-28 05:22 PM Johnny Chu - Chu Hoàng Anh] PHASE-002 S002-2 — zod của @bizcity/contracts khớp đúng vector spine 1.2 của open-platform (một nguồn sự thật cho mọi ngôn ngữ)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const c = await import('@bizcity/contracts');
const PLATFORM = process.env.BIZCITY_PLATFORM_DIR ?? fileURLToPath(new URL('../../../../bizcity-platform', import.meta.url));
const VEC = join(PLATFORM, 'schema/spine/vectors/refs.vectors.json');
const MAP = {
  tenant: c.tenantSchema, site: c.siteSchema, blog_ref: c.blogRefSchema, sub: c.subSchema, item_id: c.ulidSchema, doc_ref: c.spineDocRefSchema,
  uom: c.uomSchema, branch_code: c.branchCodeSchema, qty: c.qtySchema, ItemRef: c.itemRefSchema, PartnerRef: c.partnerRefSchema,
  ContactRef: c.contactRefSchema, BranchRef: c.branchRefSchema, QtyLine: c.qtyLineSchema, DocLink: c.docLinkSchema, Envelope: c.envelopeSchema,
};

test('vector spine 1.2 (refs.schema.json): mọi ca hợp lệ qua, mọi ca sai bị chặn', { skip: !existsSync(VEC) && `không thấy ${VEC} (đặt BIZCITY_PLATFORM_DIR)` }, () => {
  const v = JSON.parse(readFileSync(VEC, 'utf8'));
  const cases = v.cases.filter((x) => x.schema === 'refs.schema.json');
  const missing = [...new Set(cases.map((x) => x.def))].filter((d) => !MAP[d]);
  assert.deepEqual(missing, [], 'thêm trục / hình mới ở spine ⇒ thêm zod tương ứng ở @bizcity/contracts');
  for (const x of cases) {
    for (const ok of x.valid) assert.ok(MAP[x.def].safeParse(ok).success, `${x.name}: phải hợp lệ ${JSON.stringify(ok)}`);
    for (const bad of x.invalid) assert.ok(!MAP[x.def].safeParse(bad).success, `${x.name}: phải bị chặn ${JSON.stringify(bad)}`);
  }
});

test('khuôn doc_ref trên dây là tập con của khuôn lưu (CHECK 0045 của open-ketoan)', () => {
  for (const r of ['pos.order:8812', 'ledger.event:pos:CN01:sale:8812', 'cake.order_request:01JD8K2Q4F3M9R7X5T1V0W6Y8Z']) {
    assert.ok(c.SPINE_DOC_REF_RE.test(r)); assert.ok(c.DOC_REF_RE.test(r));
  }
  assert.ok(c.DOC_REF_RE.test('pos.order:HĐ/1') && !c.SPINE_DOC_REF_RE.test('pos.order:HĐ/1'), 'khuôn lưu rộng hơn — siết sau khi kiểm dữ liệu (S002-6)');
});

test('qtyMatchesUnits: 2 Thùng × 24 = 48 Cái; lệch ⇒ false; số lẻ đúng tới 4 / 6 chữ số', () => {
  assert.equal(c.qtyMatchesUnits({ qty: '48', unitQty: '2', unitRatio: '24' }), true);
  assert.equal(c.qtyMatchesUnits({ qty: '47', unitQty: '2', unitRatio: '24' }), false);
  assert.equal(c.qtyMatchesUnits({ qty: '1.5', unitQty: '0.0015', unitRatio: '1000' }), true);
  assert.equal(c.qtyMatchesUnits({ qty: '12' }), true);
});
