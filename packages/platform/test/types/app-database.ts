// [2026-11-24 06:28 PM Johnny Chu - Chu Hoàng Anh] P2b-4 — test KIỂU: app gắn bảng của mình vào Database bằng gộp khai báo, dùng thẳng db chung của gói.
//   Chạy trong npm test: tsc -p packages/platform/test/types (biên dịch qua = đạt; @ts-expect-error không dùng tới = trượt).
import type { Generated } from 'kysely';
import { db } from '@bizcity/platform/db/client';

interface CatalogItemsTable { item_id: string; tenant_id: string; sku: string; name: string; created_at: Generated<Date> }

declare module '@bizcity/platform/db/types' {
  interface AppDatabase { catalog_items: CatalogItemsTable }
}

export async function demo(): Promise<string[]> {
  const rows = await db.selectFrom('catalog_items').select(['item_id', 'sku']).where('tenant_id', '=', '1').execute();
  await db.insertInto('catalog_items').values({ item_id: 'x', tenant_id: '1', sku: 'A', name: 'B' }).execute(); // created_at tự sinh
  // bảng nền vẫn có kiểu như cũ
  await db.selectFrom('tenants').select('code').execute();
  // @ts-expect-error bảng app chưa khai ⇒ lỗi kiểu
  await db.selectFrom('bang_khong_co').selectAll().execute();
  // @ts-expect-error cột không có trong bảng app
  await db.selectFrom('catalog_items').select('khong_co_cot').execute();
  return rows.map((r) => r.sku);
}

// [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 — Database của lõi chỉ còn bảng lõi (CoreDatabase): không import khu cách ly ketoan-legacy ⇒ bảng kế toán KHÔNG có kiểu.
export async function coreOnly(): Promise<void> {
  // @ts-expect-error bảng sổ của open-ketoan không thuộc lõi
  await db.selectFrom('ledger_entries').selectAll().execute();
  // @ts-expect-error danh mục đối tượng của open-ketoan không thuộc lõi
  await db.selectFrom('partners').selectAll().execute();
  await db.selectFrom('business_documents').select(['doc_no', 'currency']).execute();
}
