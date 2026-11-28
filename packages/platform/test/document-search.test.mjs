// [2026-11-28 08:45 PM Johnny Chu - Chu Hoàng Anh] S003-20 — tìm chứng từ chuẩn hoá (core.document.list, bizcity_list@1) chạy thật: vector URL ⇄ ListQuery dùng chung với bizcity-platform,
// lọc / tìm / sắp xếp / con trỏ keyset / tổng / phạm vi theo vai / ẩn lưu trữ trên trục chứng từ, chứng từ của hai app khác nhau cùng một danh sách.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csdlMoi, themDonVi, nguoi, ma, skip } from './_csdl.mjs';

const url = await csdlMoi('oc_t_search');
const { parseListQuery, formatListQuery } = await import('../dist/core/list-query.js');
const { documentSearch, documentListAction, DOCUMENT_COLUMNS } = await import('../dist/core/document-search.js');
const { defineDocumentType, documentSpine } = await import('../dist/core/document-spine.js');
const { runAction } = await import('../dist/core/actions.js');
const { db } = await import('../dist/db/client.js');

const here = dirname(fileURLToPath(import.meta.url));
const VEC = join(here, '../../../../bizcity-platform/schema/list/vectors/list.vectors.json');

test('URL ⇄ ListQuery: vector dùng chung với bizcity-platform (hai chiều, thứ tự khoá chuẩn); URL sai bị chặn nêu đúng tham số', { skip: !existsSync(VEC) && 'không có bizcity-platform cạnh repo' }, () => {
  const v = JSON.parse(readFileSync(VEC, 'utf8'));
  for (const c of v.url) {
    assert.deepEqual(parseListQuery(c.url), c.query, c.url);
    assert.deepEqual(parseListQuery(formatListQuery(c.query)), c.query);
  }
  for (const bad of v.urlInvalid) assert.equal(ma0(() => parseListQuery(bad)), 'VALIDATION_ERROR', bad);
});
function ma0(fn) { try { fn(); return 'OK'; } catch (e) { return e.code ?? e.message; } }

test('cột chuẩn: mỗi cột khai kiểu + phép lọc; thứ tự cột cố định', () => {
  assert.ok(DOCUMENT_COLUMNS.length >= 15);
  assert.deepEqual(DOCUMENT_COLUMNS.filter((c) => c.sort).map((c) => c.field), ['doc_type', 'doc_no', 'doc_date', 'total', 'created_at', 'updated_at']);
});

let t1, t2;
before(async () => {
  if (!url) return;
  t1 = await themDonVi(url, 'tim-1'); t2 = await themDonVi(url, 'tim-2');
  defineDocumentType({ type: 'thu.hoa_don', label: 'Hoá đơn thử', mirror: { statuses: { moi: 'draft', xong: 'done', huy: 'cancelled' } } });
  defineDocumentType({ type: 'kho.phieu_thu', label: 'Phiếu thử', mirror: { statuses: { moi: 'draft', duyet: 'approved' } } });
});
after(async () => { await db.destroy(); });
const tx = (fn) => db.transaction().execute(fn);
const mir = (t, type, key, o) => tx((trx) => documentSpine.mirror(trx, t, type, { key, ...o }, 'user:1'));
const list = (q, scope, t = t1) => tx((trx) => documentSearch.list(trx, t, typeof q === 'string' ? parseListQuery(q) : q, scope));

test('tìm chứng từ: hai app cùng một danh sách; q, lọc theo loại / nhóm / ngày / tiền; mặc định ẩn lưu trữ', { skip }, async () => {
  // 12 chứng từ: 8 hoá đơn thử (ngày 01..08), 3 phiếu kho, 1 ngoại tệ; đơn vị CN01 / CN02
  for (let i = 1; i <= 8; i++) await mir(t1, 'thu.hoa_don', `HD${i}`, { status: i % 4 === 0 ? 'xong' : 'moi', date: `2026-11-0${i}`, title: `Khách ${i % 2 ? 'Lan' : 'Hùng'}`, partnerRef: `P${i % 3}`, orgUnitCode: i <= 5 ? 'CN01' : 'CN02', total: i * 100000 });
  for (let i = 1; i <= 3; i++) await mir(t1, 'kho.phieu_thu', `PK${i}`, { status: 'duyet', date: `2026-11-1${i}`, title: 'Nhập kho', orgUnitCode: 'CN01', total: 50000 });
  await mir(t1, 'thu.hoa_don', 'USD1', { status: 'moi', date: '2026-11-20', currency: 'USD', fxRate: 25000, totalFc: 10, orgUnitCode: 'CN01' });
  await mir(t2, 'thu.hoa_don', 'KHAC', { status: 'moi', date: '2026-11-01', total: 1 });
  await tx((trx) => documentSpine.mirror(trx, t1, 'thu.hoa_don', { key: 'CU', status: 'huy', date: '2026-10-01', total: 5 }, 'user:1'));
  await tx((trx) => db.updateTable('business_documents').set({ archived_at: new Date().toISOString() }).where('doc_ref', '=', 'thu.hoa_don:CU').execute());

  assert.equal((await list('count=exact')).meta.total, 12, 'không gồm lưu trữ, không gồm đơn vị khác');
  assert.equal((await list('f.archived_at.null=false&count=exact')).meta.total, 1, 'xem lưu trữ');
  assert.deepEqual((await list('f.doc_type.eq=kho.phieu_thu&sort=doc_no&limit=50')).data.map((r) => r.docNo), ['PK1', 'PK2', 'PK3']);
  const mixed = await list('f.doc_type.in=thu.hoa_don,kho.phieu_thu&f.org_unit_code.eq=CN01&count=exact&sums=1');
  assert.equal(mixed.meta.total, 5 + 3 + 1);
  assert.equal(mixed.meta.sums.total, 100000 + 200000 + 300000 + 400000 + 500000 + 150000 + 250000, 'tổng tính theo tiền hạch toán; ngoại tệ đã quy (10 USD × 25.000)');
  assert.equal(mixed.meta.sums.totalFc, undefined, 'nguyên tệ chỉ khi lọc một tiền tệ');
  const usd = await list('f.currency.eq=USD&sums=1');
  assert.deepEqual([usd.data.length, usd.data[0].totalFc, usd.meta.sums.total, usd.meta.sums.totalFc], [1, 10, 250000, 10]);
  assert.deepEqual((await list('q=lan&f.status.eq=draft&sort=doc_no')).data.map((r) => r.docNo), ['HD1', 'HD3', 'HD5', 'HD7']);
  assert.equal((await list('q=hd')).data.length, 8, 'q tìm cả số chứng từ');
  assert.equal((await list('f.doc_date.between=2026-11-02..2026-11-04&count=exact')).meta.total, 3);
  assert.equal((await list('f.total.gte=400000&f.status.ne=done&count=exact')).meta.total, 2 + 0 + 1, 'HD5 HD6 HD7 (HD4 / HD8 đã done; USD1 chỉ 250.000)');
});

test('con trỏ keyset: duyệt hết không trùng không sót, đúng với sort tăng / giảm, nhiều khoá, khoá rỗng cuối', { skip }, async () => {
  for (const sort of ['doc_date', '-doc_date', 'doc_type,-doc_no', '-total,doc_no']) {
    const seen = []; let cursor = null;
    for (let guard = 0; guard < 20; guard++) {
      const p = await list({ sort: parseListQuery(`sort=${sort}`).sort, limit: 5, ...(cursor ? { cursor } : {}) });
      seen.push(...p.data.map((r) => r.docRef));
      cursor = p.meta.nextCursor;
      if (!cursor) break;
    }
    assert.equal(seen.length, 12, sort);
    assert.equal(new Set(seen).size, 12, `${sort}: không trùng`);
  }
  const all = (await list('sort=-doc_date&limit=50')).data.map((r) => r.date);
  assert.deepEqual(all, [...all].sort().reverse());
  assert.equal(await ma(list({ cursor: 'khong-phai-con-tro' })), 'VALIDATION_ERROR');
  assert.equal(await ma(list('sort=doc_no&limit=5').then((p) => list({ sort: [{ field: 'total', dir: 'asc' }], limit: 5, cursor: p.meta.nextCursor }))), 'VALIDATION_ERROR', 'con trỏ của cách sắp xếp khác');
});

test('cột / phép lạ bị chặn nêu đúng chỗ; chuỗi có % _ không phá câu lệnh', { skip }, async () => {
  assert.equal(await ma(list('f.khong_co.eq=1')), 'VALIDATION_ERROR');
  assert.equal(await ma(list('f.title.gt=a')), 'VALIDATION_ERROR');
  assert.equal(await ma(list('f.total.eq=abc')), 'VALIDATION_ERROR');
  assert.equal(await ma(list('f.doc_date.eq=28/11/2026')), 'VALIDATION_ERROR');
  assert.equal(await ma(list('sort=title')), 'VALIDATION_ERROR');
  assert.equal((await list('q=%25')).data.length, 0, '% là ký tự, không phải mẫu');
  assert.equal((await list("q='; DROP TABLE business_documents; --")).data.length, 0);
});

test('phạm vi theo vai giao với bộ lọc; action core.document.list: quyền, tham số URL, phạm vi từ branchScope', { skip }, async () => {
  assert.equal((await list('count=exact', { orgUnits: ['CN02'] })).meta.total, 3);
  assert.equal((await list('f.org_unit_code.eq=CN01&count=exact', { orgUnits: ['CN02'] })).meta.total, 0, 'lọc ngoài phạm vi không mở rộng được');
  assert.equal((await list('count=exact', { orgUnits: [] })).meta.total, 0);
  assert.equal((await list('count=exact', { modules: ['kho'] })).meta.total, 3);
  const call = (auth, input) => runAction(documentListAction, input, { auth, requestId: 'r-tim' });
  assert.equal(await ma(call(nguoi(t1, 1, 'documents:write'), {})), 'FORBIDDEN');
  const r = await call(nguoi(t1, 1, 'documents:read'), { 'f.doc_type.eq': 'kho.phieu_thu', sort: '-doc_no', limit: '2', count: 'exact' });
  assert.deepEqual(r.data.data.map((x) => x.docNo), ['PK3', 'PK2']);
  assert.equal(r.data.meta.total, 3);
  assert.ok(r.data.meta.nextCursor);
  assert.equal(await ma(call(nguoi(t1, 1, 'documents:read'), { 'tham-so-la': '1' })), 'VALIDATION_ERROR');
  const other = await call(nguoi(t2, 1, 'documents:read'), { count: 'exact' });
  assert.equal(other.data.meta.total, 1, 'đơn vị khác chỉ thấy chứng từ của mình');
});
