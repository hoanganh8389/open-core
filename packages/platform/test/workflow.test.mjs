// [2026-11-28 07:41 PM Johnny Chu - Chu Hoàng Anh] S001-T — workflow YAML (bizcity_document_workflow@1) chạy thật ở lõi; chép từ open-ketoan apps/api/test/workflow.test.ts
// (phần tệp khai báo + runtime quyết định chuyển; bỏ phần gọi app ketoan). Không cần CSDL.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgres://x@localhost/x';
const { parseWorkflow, STATUS_GROUPS } = await import('../dist/core/workflow.js');

const actor = (id, ...perms) => ({ id, can: (p) => perms.includes(p) });
const code = (fn) => { try { fn(); return 'OK'; } catch (e) { return e.code ?? e.message; } };

const BASE = `
type: thu.phieu
label: Phiếu thử
states:
  draft:    { group: draft, label: Nháp }
  waiting:  { group: pending, label: Chờ duyệt }
  level1:   { group: pending, label: Đã duyệt cấp 1 }
  ok:       { group: approved, label: Đã duyệt }
  void:     { group: cancelled, label: Đã huỷ }
transitions:
  submit: { title: Gửi duyệt, from: [draft], to: waiting, permission: documents:write, owner: documents:edit-all }
  approve:
    title: Duyệt
    levels:
      - { from: waiting, to: level1, permission: payments:approve }
      - { from: level1, to: ok, permission: payments:approve-final, denied: Cần người duyệt cấp 2 }
  sign: { title: Ký, from: [waiting], to: ok, permission: payments:approve, sod: true }
  reject: { title: Từ chối, from: [waiting, level1], to: draft, permission: { waiting: payments:approve, level1: payments:approve-final }, requires: [reason] }
  cancel: { title: Huỷ, from: [draft, waiting], to: void, permission: documents:write, ledger: true, blocked: { ok: 'Đã duyệt: rút duyệt trước' } }
`;

test('sáu nhóm trạng thái chuẩn (STD-DOC-4)', () => {
  assert.deepEqual([...STATUS_GROUPS], ['draft', 'pending', 'approved', 'in_progress', 'done', 'cancelled']);
  const wf = parseWorkflow(BASE, 'thu.yaml');
  assert.deepEqual(wf.statesIn('pending'), ['waiting', 'level1']);
  assert.equal(wf.editable('draft'), true);
  assert.equal(wf.editable('ok'), false);
});

test('nhãn, tên chuyển tuỳ chọn', () => {
  const wf = parseWorkflow('type: thu.toi-gian\nstates:\n  draft: { group: draft }\n  sent: { group: pending }\ntransitions:\n  send: { from: [draft], to: sent, permission: documents:write }\n', 'x');
  assert.equal(wf.label('sent'), 'sent');
  assert.equal(wf.spec.transitions.send.title, 'send');
  assert.equal(wf.plan('send', { status: 'draft' }, actor('user:1', 'documents:write')).to, 'sent');
});

test('khai sai bị từ chối, nêu đủ chỗ sai', () => {
  const bad = (patch) => code(() => parseWorkflow(BASE.replace(/transitions:[\s\S]*/, `transitions:\n${patch}`), 'thu.yaml'));
  assert.match(code(() => parseWorkflow(BASE.replace('group: pending, label: Chờ duyệt', 'group: review, label: Chờ duyệt'), 'x')), /states\.waiting\.group/);
  assert.match(bad('  go: { title: Đi, from: [draft], to: nowhere, permission: documents:write }'), /"nowhere" chưa khai/);
  assert.match(bad('  go: { title: Đi, from: [draft], to: ok, permission: documents:fly }'), /permission/);
  assert.match(bad('  go: { title: Đi, from: [draft], to: waiting, permission: documents:write, ledger: true }'), /R-WF-3/);
  assert.match(bad('  go: { title: Đi, from: [draft, waiting], to: ok, permission: { draft: documents:write } }'), /thiếu quyền cho trạng thái nguồn "waiting"/);
  assert.match(bad('  go:\n    title: Đi\n    levels:\n      - { from: waiting, to: level1, permission: payments:approve }\n      - { from: waiting, to: ok, permission: payments:approve }'), /levels\[1\]\.from phải là "level1"/);
  assert.match(bad('  go:\n    title: Đi\n    levels:\n      - { from: waiting, to: level1, permission: payments:approve }\n      - { from: level1, to: void, permission: payments:approve }'), /cấp cuối/);
  assert.match(bad('  go: { title: Đi, from: [draft], to: ok, permission: documents:write, colour: red }'), /colour|Unrecognized/);
});

const wf = parseWorkflow(BASE, 'thu.yaml');
const doc = (status, levelsRequired = 1) => ({ status, createdBy: 'user:1', levelsRequired });

test('duyệt nhiều cấp: số cấp chứng từ cần quyết định đích; cấp 2 cần quyền riêng', () => {
  const ktt = actor('user:2', 'payments:approve');
  const one = wf.plan('approve', doc('waiting', 1), ktt);
  assert.equal(one.to, 'ok'); assert.equal(one.level, 1); assert.equal(one.group, 'approved');
  const two = wf.plan('approve', doc('waiting', 2), ktt);
  assert.equal(two.to, 'level1'); assert.equal(two.group, 'pending');
  assert.equal(code(() => wf.plan('approve', doc('level1', 2), ktt)), 'FORBIDDEN');
  const fin = wf.plan('approve', doc('level1', 2), actor('user:3', 'payments:approve-final'));
  assert.equal(fin.to, 'ok'); assert.equal(fin.level, 2);
  assert.equal(code(() => wf.plan('approve', doc('draft'), ktt)), 'CONFLICT');
});

test('quyền theo trạng thái nguồn, lý do bắt buộc, tách nhiệm, chỉ người lập, thông báo chặn riêng', () => {
  assert.equal(code(() => wf.plan('reject', doc('level1', 2), actor('user:2', 'payments:approve'), { reason: 'x' })), 'FORBIDDEN');
  assert.equal(code(() => wf.plan('reject', doc('waiting'), actor('user:2', 'payments:approve'), { reason: '  ' })), 'VALIDATION_ERROR');
  assert.equal(wf.plan('reject', doc('waiting'), actor('user:2', 'payments:approve'), { reason: 'Thiếu hoá đơn' }).to, 'draft');
  assert.equal(code(() => wf.plan('sign', doc('waiting'), actor('user:1', 'payments:approve'))), 'FORBIDDEN');
  assert.equal(wf.plan('sign', doc('waiting'), actor('user:2', 'payments:approve')).to, 'ok');
  assert.equal(code(() => wf.plan('submit', doc('draft'), actor('user:9', 'documents:write'))), 'FORBIDDEN');
  assert.equal(wf.plan('submit', doc('draft'), actor('user:9', 'documents:write', 'documents:edit-all')).to, 'waiting');
  assert.equal(code(() => wf.plan('cancel', doc('ok'), actor('user:1', 'documents:write'))), 'CONFLICT');
  let msg = '';
  try { wf.plan('cancel', doc('ok'), actor('user:1', 'documents:write')); } catch (e) { msg = e.message; }
  assert.equal(msg, 'Đã duyệt: rút duyệt trước');
  assert.equal(wf.plan('cancel', doc('draft'), actor('user:1', 'documents:write')).ledger, true);
});

test('allowed: các chuyển người này làm được (giao diện hiện nút)', () => {
  assert.deepEqual(wf.allowed(doc('waiting', 2), actor('user:2', 'payments:approve', 'documents:write')), ['approve', 'sign', 'reject', 'cancel']);
  assert.deepEqual(wf.allowed(doc('ok'), actor('user:2', 'documents:write')), []);
});
