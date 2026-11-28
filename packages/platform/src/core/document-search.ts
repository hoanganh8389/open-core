// @bizcity-layer P documents
// [2026-11-28 09:05 PM Johnny Chu - Chu Hoàng Anh] S003-4 — tìm chứng từ chuẩn hoá (NC-006 §3, NC-007 §3, R-DOCX-6) nay là một danh sách khai bằng defineListAction (core/list.ts):
// `core.document.list` + `core.document.export`. Chứng từ của mọi app ghi qua document-spine (quản lý hoặc phản chiếu) có mặt ở đây — palette ⌘K, danh sách chéo module,
// MCP chỉ đọc, xuất csv / json / ndjson đều dùng một nguồn. Hàng trả về theo tên cột (bizcity_list@1), không đổi tên sang camelCase.
import type { Db } from '../db/client.js';
import { defineListAction, listEngine, type ListColumn, type ListPageResult } from './list.js';
import type { ListQuery } from './list-query.js';

const TEXT = ['eq', 'ne', 'in', 'nin', 'prefix', 'like'] as const;
const ORD = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'] as const;

/** Cột của danh sách chứng từ (ListDef.columns). */
export const DOCUMENT_COLUMNS: ListColumn[] = [
  { field: 'doc_ref', type: 'text', label: 'Mã chứng từ', sql: 'doc_ref', ops: ['eq', 'in', 'prefix'], search: true },
  { field: 'doc_type', type: 'enum', label: 'Loại', sql: 'doc_type', ops: ['eq', 'ne', 'in', 'nin', 'prefix'], sort: true },
  { field: 'module', type: 'enum', label: 'Module', sql: 'module', ops: ['eq', 'in'] },
  { field: 'doc_no', type: 'text', label: 'Số', sql: 'doc_no', ops: [...TEXT], sort: true, search: true },
  { field: 'doc_date', type: 'date', label: 'Ngày', sql: 'doc_date', ops: [...ORD, 'null'], sort: true },
  { field: 'title', type: 'text', label: 'Tiêu đề', sql: 'title', ops: ['prefix', 'like'], search: true },
  { field: 'partner_ref', type: 'partner', label: 'Đối tượng', sql: 'partner_ref', ops: ['eq', 'in', 'prefix'], search: true },
  { field: 'org_unit_code', type: 'branch', label: 'Đơn vị', sql: 'org_unit_code', ops: ['eq', 'in', 'prefix'] },
  { field: 'status', type: 'status', label: 'Nhóm trạng thái', sql: 'status', ops: ['eq', 'ne', 'in', 'nin'] },
  { field: 'status_raw', type: 'status', label: 'Trạng thái', sql: 'status_raw', ops: ['eq', 'ne', 'in', 'nin'] },
  { field: 'currency', type: 'enum', label: 'Tiền tệ', sql: 'currency', ops: ['eq', 'in'] },
  { field: 'total', type: 'money', label: 'Tổng (tiền hạch toán)', sql: 'total', ops: [...ORD], sort: true, sum: true },
  { field: 'total_fc', type: 'money', label: 'Tổng nguyên tệ', sql: 'total_fc', ops: [...ORD, 'null'], sum: true, sumOnlyWith: 'currency' },
  { field: 'created_by', type: 'user', label: 'Người lập', sql: 'created_by', ops: ['eq', 'in'] },
  { field: 'created_at', type: 'datetime', label: 'Lập lúc', sql: 'created_at', ops: [...ORD], sort: true },
  { field: 'updated_at', type: 'datetime', label: 'Sửa lúc', sql: 'updated_at', ops: [...ORD], sort: true },
  { field: 'archived_at', type: 'datetime', label: 'Lưu trữ lúc', sql: 'archived_at', ops: ['null'] },
];

export const documentList = defineListAction({
  id: 'core.document.list', label: 'Chứng từ', permission: 'documents:read', exportPermission: 'documents:read',
  from: 'business_documents', columns: DOCUMENT_COLUMNS, defaultSort: [{ field: 'doc_date', dir: 'desc' }],
  // Mặc định ẩn chứng từ lưu trữ; lọc archived_at.null=false để xem (R-DEL).
  defaultWhere: [{ unlessField: 'archived_at', sql: 'archived_at IS NULL' }],
  scope: { orgUnits: 'org_unit_code', modules: 'module' },
  http: { path: '/api/v1/documents' },
});
/** Action danh sách `core.document.list` (GET /api/v1/documents) — app đưa vào `mountActions`. */
export const documentListAction = documentList.list;
/** Action xuất `core.document.export` (GET /api/v1/documents/export?format=csv|json|ndjson). */
export const documentExportAction = documentList.export!;

export type DocumentListScope = { orgUnits?: readonly string[] | null; modules?: readonly string[] | null };
export const documentSearch = {
  /** Danh sách chứng từ theo `bizcity_list@1` (xem `listEngine.run`). Hàng theo tên cột. */
  list(tx: Db, tenantId: string, query: ListQuery, scope: DocumentListScope = {}): Promise<ListPageResult> {
    return listEngine.run(tx, tenantId, documentList.def, query, scope);
  },
};
