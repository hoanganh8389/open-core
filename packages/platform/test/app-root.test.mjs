// [2026-11-28 04:54 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-2 — gốc app: biến môi trường > repo chứa gói > lên từ node_modules tới bizcity.app.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
const { findAppRoot } = await import('../dist/core/app-root.js');
const P = (...x) => path.resolve(path.sep, ...x); // resolve: Windows thêm ổ đĩa, giống findAppRoot

test('BIZCITY_APP_ROOT thắng mọi cách khác', () => {
  assert.equal(findAppRoot(P('srv', 'app', 'node_modules', '@bizcity', 'platform'), P('opt', 'ketoan')), P('opt', 'ketoan'));
});
test('gói trong repo app (packages/platform) ⇒ lùi 2 cấp như cũ', () => {
  assert.equal(findAppRoot(P('repo', 'open-ketoan', 'packages', 'platform'), undefined, () => false), P('repo', 'open-ketoan'));
});
test('npm: <app>/apps/api/node_modules/@bizcity/platform ⇒ lên tới thư mục có bizcity.app.json', () => {
  const has = (p) => p === P('repo', 'open-ketoan', 'bizcity.app.json');
  assert.equal(findAppRoot(P('repo', 'open-ketoan', 'apps', 'api', 'node_modules', '@bizcity', 'platform'), undefined, has), P('repo', 'open-ketoan'));
});
test('pnpm: <app>/node_modules/.pnpm/…/node_modules/@bizcity/platform ⇒ node_modules ĐẦU TIÊN', () => {
  const has = (p) => p === P('repo', 'open-cake', 'bizcity.app.json');
  assert.equal(findAppRoot(P('repo', 'open-cake', 'node_modules', '.pnpm', '@bizcity+platform@0.4.0', 'node_modules', '@bizcity', 'platform'), undefined, has), P('repo', 'open-cake'));
});
test('Docker /app không có bizcity.app.json ⇒ thư mục chứa node_modules', () => {
  assert.equal(findAppRoot(P('app', 'node_modules', '@bizcity', 'platform'), undefined, () => false), P('app'));
});
