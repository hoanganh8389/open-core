// @bizcity-layer P data
// [2026-11-08 06:30 PM Johnny Chu - Chu Hoàng Anh] PHASE-029 — S029-19 đợt 1: kiểu bảng entity_attributes (0087); cột partner_name / partner_attr_id trên ledger_entries và ledger_lines
// [2026-11-08 01:49 PM Johnny Chu - Chu Hoàng Anh] PHASE-026 — S026-4 + S030-41b: kiểu bảng entity_codes (0085); LedgerEntriesTable.event_id: string (NOT NULL từ 0077)
// [2026-11-02 02:10 AM Johnny Chu - Chu Hoàng Anh] PHASE-020 — kiểu bảng accounting_profiles (0049, ADR-0013).
// [2026-11-02 03:10 AM Johnny Chu - Chu Hoàng Anh] PHASE-020 — kiểu bảng conformance_runs (0051, ADR-0012).
// [2026-11-02 05:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-020 — ADR-0016: kiểu bảng rulepack_approvals (0053).
// [2026-11-02 02:40 AM Johnny Chu - Chu Hoàng Anh] PHASE-020 — đổi số migration hồ sơ kế toán 0049 → 0050 (main đã có 0049_khoa_dau_but_toan từ PR #18).
// [2026-10-29 10:24 PM Johnny Chu - Chu Hoàng Anh] INIT — khởi tạo Bizcity Core Framework: sổ cái chỉ thêm, cửa nạp sự việc, CANON, hợp đồng, bộ kiểm chuẩn.
// [2026-10-30 09:58 AM Johnny Chu - Chu Hoàng Anh] PHASE-002 — nhãn lớp @bizcity-layer, đồ thị phụ thuộc mốc, bản nháp API module-sdk.
// [2026-10-30 10:29 AM Johnny Chu - Chu Hoàng Anh] PHASE-003 — tự chẩn đoán L1 / L3, diagnostic_runs, khoá kỳ chặn khi sổ lỗi (PHASES 2.10).
// [2026-10-30 11:10 AM Johnny Chu - Chu Hoàng Anh] PHASE-003 — runtime action defineAction, idempotency, dry-run (PHASES 2.5).
// [2026-10-30 11:27 AM Johnny Chu - Chu Hoàng Anh] PHASE-003 — bằng chứng chỉ thêm, chuỗi băm theo đơn vị, biên nhận (PHASES 2.6).
// [2026-10-30 11:45 AM Johnny Chu - Chu Hoàng Anh] PHASE-003 — MCP cho trợ lý AI: POST /mcp, công cụ sinh từ action, xác nhận trước khi ghi (PHASES 2.11, 2.12).
// [2026-10-30 07:46 PM Johnny Chu - Chu Hoàng Anh] PHASE-006 — transactional outbox, subscriber, đồng hồ, correlation_id.
// [2026-10-30 09:03 PM Johnny Chu - Chu Hoàng Anh] PHASE-005 — chính sách kế toán có phiên bản + ngày hiệu lực (ADR-0009).
// [2026-10-30 10:11 PM Johnny Chu - Chu Hoàng Anh] PHASE-012 — gói định khoản cài / xem trước / gỡ: bảng config_packs, cài = phát hành một bản chính sách (ADR-0009 Q-5).
// [2026-10-31 08:15 PM Johnny Chu - Chu Hoàng Anh] PHASE-012 — ledger.query (PHASES 3.7, S012-2): kiểu khung nhìn chỉ đọc bizcity_read.ledger_* (migration 0043).
// [2026-10-31 11:25 PM Johnny Chu - Chu Hoàng Anh] PHASE-007 — data.read-views (PHASES 2.4): kiểu tám khung nhìn danh mục bizcity_read.* (migration 0044).
// [2026-11-01 12:16 AM Johnny Chu - Chu Hoàng Anh] PHASE-010 — documents.* (PHASES 2.7): kiểu document_versions / document_links / document_attachments (migration 0045).
// [2026-11-01 12:47 AM Johnny Chu - Chu Hoàng Anh] PHASE-010 — document_attachments.storage_root, legacy_ref, sha256 null (0046).
// [2026-11-01 03:13 PM Johnny Chu - Chu Hoàng Anh] PHASE-010 — document_signatures.doc_ref, event_id null (0048, documents.signatures).
// [2026-11-01 04:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-010 — dời từ apps/api/src/db/types.ts sang packages/platform (@bizcity/platform, D010-7 chặng 2); import tương đối viết lại theo chỗ mới
// [2026-11-02 10:43 AM Johnny Chu - Chu Hoàng Anh] PHASE-011 — 3.14 (ADR-0011 mức 2): app_installations + api_keys.app_key (migration 0050)
// [2026-11-02 03:28 PM Johnny Chu - Chu Hoàng Anh] PHASE-011 — migration app ngoài tiến trình đổi số 0050 → 0051
// [2026-11-02 04:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-011 — 3.13: module_registry, tenant_modules, event_deliveries.status 'skipped' (0052)
// [2026-11-02 04:55 PM Johnny Chu - Chu Hoàng Anh] PHASE-011 — 3.10: schema_migrations.module (0053)
// [2026-11-02 07:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-021 — W2: intake_inbox (0054)
// [2026-11-08 05:05 PM Johnny Chu - Chu Hoàng Anh] PHASE-026 — S026-4: đổi số migration 0083 → 0085 khi gộp main (0083 thuộc S030-48, 0084 thuộc PHASE-031 W2c — so-tiep-theo kiem)
/**
 * Khai báo kiểu cho từng bảng — Kysely dùng để kiểm tra câu truy vấn lúc biên dịch.
 *
 * Khi thêm cột/bảng trong migrations/*.sql, PHẢI cập nhật file này cho khớp.
 * Quy ước:
 *   Generated<T>  cột có giá trị mặc định ở database (không bắt buộc khi insert)
 *   numeric       PostgreSQL trả về chuỗi (để không mất chính xác) → khai báo string,
 *                 đổi sang number ở tầng repository bằng toNumber().
 */
import type { ColumnType, Generated, Insertable, Selectable } from 'kysely';

export type Timestamp = ColumnType<Date, Date | string, Date | string>;
/** Thời điểm có giá trị mặc định (now()) — không bắt buộc khi insert. */
export type TimestampDefault = ColumnType<Date, Date | string | undefined, Date | string>;
export type DateOnly = ColumnType<string, string, string>;
export type Numeric = ColumnType<string, number | string, number | string>;
/** Cột jsonb: đọc ra object, ghi vào bằng chuỗi JSON (JSON.stringify). */
export type Json<T = Record<string, unknown>> = ColumnType<T, string, string>;
/** Cột jsonb có giá trị mặc định. */
export type JsonDefault<T = Record<string, unknown>> = ColumnType<T, string | undefined, string>;
/** Cột jsonb cho phép NULL. */
export type JsonNullable<T = Record<string, unknown>> = ColumnType<T | null, string | null, string | null>;

export interface TenantsTable {
  id: Generated<string>;
  code: string;
  name: string;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  settings: JsonDefault;
  is_active: Generated<boolean>;
  created_at: TimestampDefault;
}


export interface UsersTable {
  id: Generated<string>;
  tenant_id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: string;
  is_active: Generated<boolean>;
  last_login_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  /** Số phiên bản phiên đăng nhập (0031): vé mang số khác bị từ chối. */
  session_version: Generated<number>;
  created_at: TimestampDefault;
}


export interface ApiKeysTable {
  id: Generated<string>;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: Generated<string[]>;
  last_used_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  revoked_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: TimestampDefault;
  /** Khoá của app ngoài tiến trình (0051): quyền theo app_installations. NULL = khoá tích hợp thường. */
  app_key: ColumnType<string | null, string | null | undefined, string | null>;
}


/** Module / add-in đã cài vào bản cài (0052, ADR-0011 D1, D2). Cấp bản cài, không tenant_id. */
export interface ModuleRegistryTable {
  key: string;
  kind: 'module' | 'addin';
  version: string;
  source: Generated<'bundled' | 'local'>;
  build_hash: string;
  status: Generated<'installed' | 'active' | 'disabled'>;
  installed_at: TimestampDefault;
  updated_at: TimestampDefault;
  history: Generated<unknown>;
  last_load_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  last_load_result: ColumnType<'loaded' | 'skipped_status' | 'skipped_hash' | 'skipped_missing' | null, string | null | undefined, string | null>;
  last_load_hash: ColumnType<string | null, string | null | undefined, string | null>;
}


/** Bật / tắt module theo đơn vị (0052). Không có dòng = bật. */
export interface TenantModulesTable {
  tenant_id: string;
  module_key: string;
  enabled: boolean;
  changed_at: TimestampDefault;
  changed_by: string;
  reason: ColumnType<string | null, string | null | undefined, string | null>;
}


/** App ngoài tiến trình đã kết nối với đơn vị (0051, ADR-0011 mức 2). */
export interface AppInstallationsTable {
  tenant_id: string;
  app_key: string;
  app_version: string;
  status: Generated<"active" | "disabled">;
  permissions: Generated<string[]>;
  events: Generated<string[]>;
  webhook_salt: string;
  installed_by: string;
  installed_at: TimestampDefault;
  updated_by: ColumnType<string | null, string | null | undefined, string | null>;
  updated_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}


export interface AuditLogsTable {
  id: Generated<string>;
  tenant_id: string;
  actor: string;
  action: string;
  object_type: string;
  object_id: string | null;
  before_data: JsonNullable;
  after_data: JsonNullable;
  created_at: TimestampDefault;
  // Bằng chứng (migration 0036, bizcity_evidence@1 §5). chain_seq / prev_hash / hash do trigger audit_log_chain điền.
  actor_kind: Generated<'user' | 'apikey' | 'ai' | 'system'>;
  actor_via: ColumnType<string | null, string | null | undefined, never>;
  on_behalf_of: ColumnType<string | null, string | null | undefined, never>;
  module_id: ColumnType<string | null, string | null | undefined, never>;
  module_version: ColumnType<string | null, string | null | undefined, never>;
  subject: ColumnType<string | null, string | null | undefined, never>;
  request_id: ColumnType<string | null, string | null | undefined, never>;
  correlation_id: ColumnType<string | null, string | null | undefined, never>;
  idempotency_key: ColumnType<string | null, string | null | undefined, never>;
  input_hash: ColumnType<string | null, string | null | undefined, never>;
  result_ok: Generated<boolean>;
  result_code: ColumnType<string | null, string | null | undefined, never>;
  dry_run: Generated<boolean>;
  chain_seq: ColumnType<string | null, never, never>;
  prev_hash: ColumnType<string | null, never, never>;
  hash: ColumnType<string | null, never, never>;
  // [2026-11-01 04:13 PM Johnny Chu - Chu Hoàng Anh] ADR-0010 — OpenTelemetry từ lõi (PHASE-018 W5): span ở khớp nối Platform + cổng Kernel, lọc thuộc tính, traceparent qua outbox
  /** Mã trace OpenTelemetry của yêu cầu (migration 0047): nối bằng chứng ↔ trace ↔ log. Quan sát, không vào chuỗi băm. */
  trace_id: ColumnType<string | null, string | null | undefined, never>;
}


/** Idempotency của action ghi (migration 0035, bizcity_action@1 §8). */
export interface ActionRequestsTable {
  id: Generated<string>;
  tenant_id: string;
  action_id: string;
  idem_key: string;
  request_hash: string;
  status_code: Generated<number>;
  response: JsonNullable<unknown>;
  actor: string;
  created_at: TimestampDefault;
}


/** Sự kiện miền (migration 0039, bizcity_event@1): outbox ghi cùng giao dịch; chỉ thêm. */
export interface EventOutboxTable {
  id: string;
  seq: Generated<string>;
  tenant_id: string;
  type: string;
  version: Generated<number>;
  subject: string;
  source_module: string;
  actor_kind: 'user' | 'apikey' | 'ai' | 'system';
  actor_id: string;
  correlation_id: string | null;
  causation_id: string | null;
  dedupe_key: string | null;
  data: JsonDefault<unknown>;
  occurred_at: TimestampDefault;
  /** W3C traceparent của span phát (migration 0047): span giao nối (link) về đây — lần ngược từ subscriber lỗi về yêu cầu gốc. */
  trace_parent: ColumnType<string | null, string | null | undefined, never>;
}


/** Giao sự kiện cho từng subscriber (migration 0039). */
export interface EventDeliveriesTable {
  tenant_id: string;
  consumer: string;
  event_id: string;
  status: ColumnType<'pending' | 'done' | 'dead' | 'skipped', 'pending' | 'done' | 'dead' | 'skipped' | undefined, 'pending' | 'done' | 'dead' | 'skipped'>;
  attempts: Generated<number>;
  next_at: TimestampDefault;
  last_error: string | null;
  done_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  /** 0161: thời điểm subscriber đã xử lý (dấu chống xử lý lặp, thay event_consumptions). */
  consumed_at: Timestamp | null;
}


/** Token xác nhận trước khi ghi qua MCP (migration 0037, bizcity_mcp@1 STD-MCP-4). */
export interface McpConfirmTokensTable {
  jti: string;
  tenant_id: string;
  tool: string;
  actor: string;
  args_hash: string;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  used_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  idempotency_key: string | null;
  created_at: TimestampDefault;
}


export interface DocumentSignaturesTable {
  id: Generated<string>;
  tenant_id: string;
  /** Phiếu kế toán; NULL khi ký chứng từ module (doc_ref) — 0048. */
  event_id: string | null;
  /** Chứng từ module <module>.<loại>:<id>; NULL khi ký phiếu kế toán — 0048. */
  doc_ref: string | null;
  version: number;
  role: string;
  signer: string;
  signer_name: string;
  signed_at: TimestampDefault;
  revoked_at: Date | null;
  revoked_by: string | null;
}


// [2026-11-02 10:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-014 — W4 (G4): thông báo trong ứng dụng (0060)
/** Thông báo trong ứng dụng (migration 0060, notify.inapp). */
export interface NotificationsTable {
  id: Generated<string>;
  tenant_id: string;
  source: string;
  recipient_user_id: string | null;
  audience_permission: string | null;
  title: string;
  body: string | null;
  link: string | null;
  dedupe_key: string | null;
  created_at: TimestampDefault;
}

export interface NotificationReadsTable {
  notification_id: string;
  user_id: string;
  tenant_id: string;
  read_at: TimestampDefault;
}


export interface DocumentSequencesTable {
  tenant_id: string;
  doc_type: string;
  year: number;
  last_no: Generated<number>;
}


/** 0045 (documents.versions): ảnh chụp phiên bản chứng từ, chỉ thêm. */
export interface DocumentVersionsTable {
  id: Generated<string>;
  tenant_id: string;
  doc_ref: string;
  version: number;
  snapshot: Json<unknown>;
  content_hash: string;
  created_by: Generated<string>;
  created_at: TimestampDefault;
}


/** 0156: sổ chứng từ chung — đầu phiếu mọi chứng từ nghiệp vụ, đồng bộ bằng trigger từ bảng nguồn (không ghi tay). */
export interface BusinessDocumentsTable {
  id: Generated<string>;
  tenant_id: string;
  doc_ref: string;
  module: string;
  doc_type: string;
  doc_no: Generated<string>;
  doc_date: string | null;
  branch_code: Generated<string>;
  partner_ref: Generated<string>;
  title: Generated<string>;
  total: Generated<string>;
  status_raw: string;
  status: 'draft' | 'pending' | 'approved' | 'in_progress' | 'done' | 'cancelled';
  version: Generated<number>;
  meta: ColumnType<Record<string, unknown>, string | undefined, string>;
  created_by: Generated<string>;
  created_at: TimestampDefault;
  updated_at: TimestampDefault;
  /** 0162: người duyệt cấp cuối, lúc duyệt. */
  approved_by: Generated<string>;
  approved_at: Timestamp | null;
  /** 0176: chi nhánh đang làm việc của người lập (nơi lập) + item_id cn_. */
  work_branch_code: string | null;
  work_branch_uid: string | null;
  // [2026-11-28 07:52 PM Johnny Chu - Chu Hoàng Anh] S003-14 + S003-19 — lõi 0005: tiền tệ, tỷ giá, tổng nguyên tệ, nút đơn vị, lưu trữ
  currency: Generated<string>;
  fx_rate: Generated<string>;
  total_fc: string | null;
  org_unit_code: Generated<string>;
  archived_at: ColumnType<Date | null, string | null | undefined, string | null>;
}


/** Lõi 0005: hoạt động trên chứng từ (chỉ thêm). */
export interface DocumentActivitiesTable {
  id: Generated<string>;
  tenant_id: string;
  doc_ref: string;
  kind: 'create' | 'transition' | 'note' | 'meta' | 'archive' | 'restore' | 'system';
  from_status: string | null;
  to_status: string | null;
  reason: Generated<string>;
  body: Generated<string>;
  data: ColumnType<Record<string, unknown>, string | undefined, string>;
  actor: string;
  created_at: TimestampDefault;
}

// [2026-11-28 11:47 PM Johnny Chu - Chu Hoàng Anh] S004-DM-2 — lõi 0007: ánh xạ ID xuyên instance (chỉ thêm; đóng = valid_to)
/** Lõi 0007: ánh xạ ID của app ↔ instance khác (NC-008 ADR-P6). */
export interface EntityLinksTable {
  id: Generated<string>;
  tenant_id: string;
  entity_type: string;
  local_id: string;
  peer_instance: string;
  remote_id: Generated<string>;
  remote_code: Generated<string>;
  link_kind: 'canonical' | 'alias' | 'merged_from' | 'proposal';
  valid_from: TimestampDefault;
  valid_to: ColumnType<Date | null, string | null | undefined, string | null>;
  created_by: string;
  closed_by: string | null;
  evidence_ref: Generated<string>;
}

// [2026-11-28 11:47 PM Johnny Chu - Chu Hoàng Anh] S004-DM-3 — lõi 0007: chủ của trục danh mục trong tenant
/** Lõi 0007: chủ dữ liệu theo trục (NC-008 ADR-P3 §2). */
export interface DataAuthorityTable {
  tenant_id: string;
  axis: string;
  owner_instance: string;
  epoch: Generated<number>;
  state: Generated<'local' | 'transferring' | 'replica'>;
  since: TimestampDefault;
  history: ColumnType<unknown[], string | undefined, string>;
}

/** 0045 (documents.links): tham chiếu giữa chứng từ. */
export interface DocumentLinksTable {
  id: Generated<string>;
  tenant_id: string;
  from_ref: string;
  to_ref: string;
  role: string;
  created_by: Generated<string>;
  created_at: TimestampDefault;
}


/** 0045 (documents.attachments): tệp đính kèm chung; nội dung trên ổ DATA_DIR/attachments. */
export interface DocumentAttachmentsTable {
  id: Generated<string>;
  tenant_id: string;
  doc_ref: string;
  kind: Generated<string>;
  file_name: string;
  content_type: Generated<string>;
  size_bytes: ColumnType<string, number | string, number | string>;
  sha256: string | null;
  storage_path: string;
  storage_root: Generated<string>;
  legacy_ref: string | null;
  note: Generated<string>;
  created_by: Generated<string>;
  created_at: TimestampDefault;
  archived_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  archived_by: string | null;
}


export interface SchemaMigrationsTable {
  name: string;
  applied_at: TimestampDefault;
  /** NULL: Core; khoá module: migration của module (0053, ADR-0011 D4). */
  module: ColumnType<string | null, string | null | undefined, string | null>;
  /** [2026-11-28 05:15 PM Johnny Chu - Chu Hoàng Anh] PHASE-001 S001-4 — nguồn: `app` (mặc định, cả dòng cũ) · tên nguồn lõi (vd `platform`) · `mod_<key>`. */
  source: ColumnType<string, string | undefined, string>;
}


/**
 * [2026-11-24 10:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 — cột thêm cho UsersTable (migration 0183, bizcity_identity@1: danh tính WordPress của người dùng đăng nhập một lần).
 * Khai báo gộp (declaration merging) của interface ở cuối tệp, KHÔNG sửa giữa tệp: bộ kiểm SC-SIG-2 chặn nợ cũ theo số dòng,
 * chèn dòng vào giữa làm ba dấu cũ (dòng 604 / 699 / 844) bị coi là nợ mới. Gộp lại vào UsersTable khi baseline được làm mới.
 * wp:<id> hoặc biz:<id>; NULL = chưa đăng nhập bằng vé WordPress.
 */
export interface UsersTable {
  external_sub: ColumnType<string | null, string | null | undefined, string | null>;
}

// [2026-11-24 06:28 PM Johnny Chu - Chu Hoàng Anh] P2b-4 — bảng của APP gắn vào kiểu Database bằng gộp khai báo (R-PLAT-2), không sửa gói:
//   declare module '@bizcity/platform/db/types' { interface AppDatabase { catalog_items: CatalogItemsTable } }
//   ⇒ db.selectFrom('catalog_items') có kiểu ở mọi nơi dùng db / Db. Tên bảng app không được trùng bảng nền (TS báo lỗi khi trùng mà khác kiểu).
// <!-- [2026-11-28 11:54 PM Johnny Chu - Chu Hoàng Anh] S004-W2-2 — Database chỉ còn bảng do migration lõi tạo (CoreDatabase); bảng kế toán ở src/ketoan-legacy/db-types.ts (cách ly, chỉ có khi import). -->
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppDatabase {}

/** Bảng do migration của lõi tạo (packages/platform/db/migrations) + sổ migration. Lõi chỉ truy vấn có kiểu các bảng này (R-CORE-8). */
export interface CoreDatabase {
  tenants: TenantsTable;
  users: UsersTable;
  api_keys: ApiKeysTable;
  app_installations: AppInstallationsTable;
  module_registry: ModuleRegistryTable;
  tenant_modules: TenantModulesTable;
  audit_logs: AuditLogsTable;
  action_requests: ActionRequestsTable;
  mcp_confirm_tokens: McpConfirmTokensTable;
  event_outbox: EventOutboxTable;
  event_deliveries: EventDeliveriesTable;
  document_signatures: DocumentSignaturesTable;
  notifications: NotificationsTable;
  notification_reads: NotificationReadsTable;
  document_sequences: DocumentSequencesTable;
  business_documents: BusinessDocumentsTable;
  document_activities: DocumentActivitiesTable;
  // [2026-11-28 11:47 PM Johnny Chu - Chu Hoàng Anh] S004-DM-2/3 — bảng cơ chế danh mục lõi 0007 (LANES §4: lane T chỉ thêm)
  entity_links: EntityLinksTable;
  data_authority: DataAuthorityTable;
  document_versions: DocumentVersionsTable;
  document_links: DocumentLinksTable;
  document_attachments: DocumentAttachmentsTable;
  schema_migrations: SchemaMigrationsTable;
}

export interface Database extends CoreDatabase, AppDatabase {}
