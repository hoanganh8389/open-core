// [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 — test KIỂU (chương trình riêng): open-ketoan import khu cách ly một lần ⇒ bảng kế toán có kiểu như trước khi tách.
import '@bizcity/platform/ketoan-legacy/db-types';
import { db } from '@bizcity/platform/db/client';
import { installKetoanLegacy } from '@bizcity/platform/ketoan-legacy/index';

export async function ketoan(): Promise<string[]> {
  installKetoanLegacy();
  const rows = await db.selectFrom('ledger_entries').select(['id', 'event_id']).execute();
  await db.selectFrom('bizcity_read.partners').select(['code', 'name']).execute();
  // @ts-expect-error cột không có vẫn bị bắt
  await db.selectFrom('partners').select('khong_co_cot').execute();
  return rows.map((r) => r.event_id);
}
