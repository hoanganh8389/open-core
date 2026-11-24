-- [2026-11-24 06:15 PM Johnny Chu - Chu Hoàng Anh] P2b-2 — migration NỀN của @bizcity/platform (dải 00xx, D-PLAT-5), gom từ open-ketoan 6ad77b6 (178 migration áp đủ → pg_dump 26 bảng nền + 16 hàm).
-- =============================================================================
-- 0001_platform_nen_tang — bảng nền mọi app dùng chung: đơn vị · người dùng · vai / luật vai / gán vai · khoá API · app cài đặt · module ·
--   nhật ký kiểm (chuỗi băm) · yêu cầu action (idempotency) · outbox sự kiện + giao · cài đặt · chính sách · thư viện · thông báo · MCP xác nhận ·
--   chứng từ dùng chung (business_documents, phiên bản, đính kèm, ký, liên kết, số chứng từ). RLS FORCE như open-ketoan.
--   BỎ so với open-ketoan (phần kế toán, R-PLAT-1): trigger tenants_seed_unit_names, tenants_seed_warehouse_types, business_documents_unit_ids;
--   khoá ngoại document_signatures.event_id → accounting_events (cột giữ, NULL được; ký theo doc_ref).
--   Tên tệp có tiền tố platform_ để không trùng tên migration riêng của app; open-ketoan khi chuyển sang gói (P6) ghi nhận tệp này bằng hook
--   (bảng đã có), không chạy lại.
-- =============================================================================

-- ── Bảng, chỉ mục, ràng buộc (pg_dump) ───────────────────────────────────────
--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    actor text NOT NULL,
    action text NOT NULL,
    object_type text NOT NULL,
    object_id text,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_kind text DEFAULT 'user'::text NOT NULL,
    actor_via text,
    on_behalf_of text,
    module_id text,
    module_version text,
    subject text,
    request_id text,
    correlation_id text,
    idempotency_key text,
    input_hash text,
    result_ok boolean DEFAULT true NOT NULL,
    result_code text,
    dry_run boolean DEFAULT false NOT NULL,
    chain_seq bigint,
    prev_hash text,
    hash text,
    trace_id text,
    CONSTRAINT audit_logs_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['user'::text, 'apikey'::text, 'ai'::text, 'system'::text]))),
    CONSTRAINT audit_logs_trace_id_check CHECK (((trace_id IS NULL) OR (trace_id ~ '^[0-9a-f]{32}$'::text)))
);

ALTER TABLE ONLY public.audit_logs FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Nhật ký thao tác. actor = user:<id> hoặc apikey:<id>.';

--
-- Name: COLUMN audit_logs.actor_kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.actor_kind IS 'Loại người gọi (bizcity_evidence@1): user, apikey, ai (qua Cell / MCP), system (tác vụ nền).';

--
-- Name: COLUMN audit_logs.actor_via; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.actor_via IS 'Kênh khi người gọi là AI / tích hợp, vd cell:zalo-hub, mcp:claude.';

--
-- Name: COLUMN audit_logs.on_behalf_of; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.on_behalf_of IS 'Người dùng chủ của khoá / kênh khi AI thao tác thay (STD-EVD-6), vd user:5.';

--
-- Name: COLUMN audit_logs.module_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.module_id IS 'Module của action (phần đầu mã action), core cho Core.';

--
-- Name: COLUMN audit_logs.module_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.module_version IS 'Phiên bản module lúc ghi.';

--
-- Name: COLUMN audit_logs.subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.subject IS 'Chủ thể: docRef / docKey của chứng từ bị tác động, vd payment_request:YC26-00001.';

--
-- Name: COLUMN audit_logs.request_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.request_id IS 'Mã yêu cầu HTTP (truy vết với log kỹ thuật).';

--
-- Name: COLUMN audit_logs.correlation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.correlation_id IS 'Mã nối nhiều yêu cầu của cùng một việc (vd một hội thoại Cell).';

--
-- Name: COLUMN audit_logs.idempotency_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.idempotency_key IS 'Idempotency-Key của lần gọi (bizcity_action@1 §8), để trả lại biên nhận khi gửi lặp.';

--
-- Name: COLUMN audit_logs.input_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.input_hash IS 'SHA-256 của input đã chuẩn hoá: kiểm được nội dung đã gửi mà không lưu lại dữ liệu nhạy cảm.';

--
-- Name: COLUMN audit_logs.result_ok; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.result_ok IS 'Thao tác thành công (true) hay bị từ chối vì lỗi nghiệp vụ (false, kèm result_code) — STD-EVD-1.';

--
-- Name: COLUMN audit_logs.result_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.result_code IS 'Mã lỗi chuẩn khi result_ok = false (CONFLICT, PERIOD_LOCKED…).';

--
-- Name: COLUMN audit_logs.dry_run; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.dry_run IS 'Bản ghi của lần chạy thử (dự phòng; v1 không ghi bằng chứng cho chạy thử).';

--
-- Name: COLUMN audit_logs.chain_seq; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.chain_seq IS 'Thứ tự trong chuỗi băm của đơn vị (1, 2, 3…), cấp dưới khoá theo đơn vị. NULL = dòng trước migration 0036.';

--
-- Name: COLUMN audit_logs.prev_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.prev_hash IS 'hash của dòng chain_seq liền trước (NULL ở dòng đầu chuỗi).';

--
-- Name: COLUMN audit_logs.hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.hash IS 'audit_log_hash(dòng) = sha256 mọi trường + prev_hash. Sửa / xoá một dòng giữa chuỗi là lộ.';

--
-- Name: COLUMN audit_logs.trace_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.trace_id IS 'Mã trace OpenTelemetry của yêu cầu (ADR-0010): tra trace trong Tempo, log trong Loki. Quan sát — không thuộc chuỗi băm (audit_log_hash).';

--
-- Name: action_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_requests (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    action_id text NOT NULL,
    idem_key text NOT NULL,
    request_hash text NOT NULL,
    status_code integer DEFAULT 200 NOT NULL,
    response jsonb,
    actor text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT action_requests_idem_key_check CHECK (((length(idem_key) >= 8) AND (length(idem_key) <= 128)))
);

ALTER TABLE ONLY public.action_requests FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE action_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.action_requests IS 'Idempotency của action ghi (bizcity_action@1 §8): một dòng mỗi (đơn vị, action, Idempotency-Key), lưu phản hồi để trả lại khi gửi lặp. Giữ 7 ngày.';

--
-- Name: COLUMN action_requests.action_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.action_requests.action_id IS 'Mã action dạng <module>.<thực thể>.<động từ>, vd quy.payment-request.create.';

--
-- Name: COLUMN action_requests.idem_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.action_requests.idem_key IS 'Header Idempotency-Key do bên gọi sinh (8–128 ký tự), một khoá cho một ý định thao tác.';

--
-- Name: COLUMN action_requests.request_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.action_requests.request_hash IS 'SHA-256 của input đã chuẩn hoá: cùng khoá khác băm → IDEMPOTENCY_CONFLICT.';

--
-- Name: COLUMN action_requests.status_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.action_requests.status_code IS 'Mã HTTP của phản hồi lần đầu (200, 201) để gửi lặp nhận đúng mã đó.';

--
-- Name: COLUMN action_requests.response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.action_requests.response IS 'Phần data của phản hồi lần đầu (khuôn { ok, data }).';

--
-- Name: COLUMN action_requests.actor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.action_requests.actor IS 'Người / khoá gọi lần đầu: user:<id>, apikey:<id>.';

--
-- Name: action_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: action_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.action_requests_id_seq OWNED BY public.action_requests.id;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT ARRAY['documents:write'::text, 'reports:read'::text] NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    app_key text
);

ALTER TABLE ONLY public.api_keys FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_keys IS 'Khoá API tích hợp. key_hash = sha256(khoá). Gửi khoá qua header X-Api-Key.';

--
-- Name: COLUMN api_keys.app_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.app_key IS 'Khoá của app ngoài tiến trình (ADR-0011 mức 2): quyền = app_installations.permissions, chỉ dùng được khi kết nối active. NULL = khoá tích hợp thường (quyền theo scopes).';

--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.api_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: app_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_installations (
    tenant_id bigint NOT NULL,
    app_key text NOT NULL,
    app_version text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    events text[] DEFAULT '{}'::text[] NOT NULL,
    webhook_salt text NOT NULL,
    installed_by text NOT NULL,
    installed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    CONSTRAINT app_installations_app_key_check CHECK ((app_key ~ '^[a-z][a-z0-9-]*$'::text)),
    CONSTRAINT app_installations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text]))),
    CONSTRAINT app_installations_webhook_salt_check CHECK ((length(webhook_salt) >= 16))
);

ALTER TABLE ONLY public.app_installations FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE app_installations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.app_installations IS 'App ngoài tiến trình (ADR-0011 mức 2) đã kết nối với đơn vị. Một dòng / (đơn vị, app). Quyền và sự kiện chụp từ manifest app lúc kết nối, chủ đơn vị đồng ý.';

--
-- Name: COLUMN app_installations.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.tenant_id IS 'Đơn vị kết nối app.';

--
-- Name: COLUMN app_installations.app_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.app_key IS 'Khoá app (manifest key, kind "app"). docKey app nộp phải bắt đầu "<app_key>:".';

--
-- Name: COLUMN app_installations.app_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.app_version IS 'Phiên bản manifest app lúc kết nối / cập nhật phạm vi.';

--
-- Name: COLUMN app_installations.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.status IS 'active: khoá app dùng được, webhook chạy; disabled: khoá bị từ chối, webhook ngừng (sự kiện phát lúc tắt không gửi lại khi bật).';

--
-- Name: COLUMN app_installations.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.permissions IS 'Quyền của khoá app (danh sách Permission của Core) — chỉ những quyền manifest app khai trong permissions[].';

--
-- Name: COLUMN app_installations.events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.events IS 'Loại sự kiện Core đẩy tới webhook app — manifest events.subscribes[].';

--
-- Name: COLUMN app_installations.webhook_salt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.webhook_salt IS 'Muối ngẫu nhiên; bí mật ký webhook = HMAC(khoá máy chủ, đơn vị:app:muối). Đổi muối = đổi bí mật (xoay khoá).';

--
-- Name: COLUMN app_installations.installed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.installed_by IS 'Người kết nối (user:<id>).';

--
-- Name: COLUMN app_installations.installed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.installed_at IS 'Lúc kết nối lần đầu.';

--
-- Name: COLUMN app_installations.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.updated_by IS 'Người đổi trạng thái / xoay khoá lần cuối.';

--
-- Name: COLUMN app_installations.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_installations.updated_at IS 'Lúc đổi trạng thái / xoay khoá lần cuối.';

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: business_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_documents (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    doc_ref text NOT NULL,
    module text NOT NULL,
    doc_type text NOT NULL,
    doc_no text DEFAULT ''::text NOT NULL,
    doc_date date,
    branch_code text DEFAULT ''::text NOT NULL,
    partner_ref text DEFAULT ''::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    total numeric(20,4) DEFAULT 0 NOT NULL,
    status_raw text NOT NULL,
    status text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by text DEFAULT ''::text NOT NULL,
    approved_at timestamp with time zone,
    branch_uid text,
    warehouse_uid text,
    department_uid text,
    work_branch_code text,
    work_branch_uid text,
    CONSTRAINT business_documents_doc_ref_check CHECK ((doc_ref ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[^\s]{1,200}$'::text)),
    CONSTRAINT business_documents_doc_type_check CHECK ((doc_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT business_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]))),
    CONSTRAINT business_documents_version_check CHECK ((version > 0))
);

ALTER TABLE ONLY public.business_documents FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE business_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_documents IS 'Sổ chứng từ chung (0156, bizcity_document@1): đầu phiếu của mọi chứng từ nghiệp vụ — định danh, loại, số, ngày, chi nhánh, đối tượng, tổng tiền, trạng thái, phiên bản. Dòng chi tiết ở bảng phân hệ; phiên bản ở document_versions; liên kết ở document_links. Đồng bộ bằng trigger từ bảng nguồn — không ghi tay.';

--
-- Name: COLUMN business_documents.doc_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.doc_ref IS 'Định danh chứng từ <module>.<loại>:<id> (bất biến); trùng doc_key khi chứng từ nộp sự việc kế toán.';

--
-- Name: COLUMN business_documents.module; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.module IS 'Phân hệ giữ nội dung: mua-hang, kho, quy…';

--
-- Name: COLUMN business_documents.doc_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.doc_type IS 'Loại chứng từ <nghiệp vụ>.<loại> theo chứng từ là gì: purchase.contract, purchase.order, inventory.receipt, inventory.issue, inventory.transfer, finance.payment, finance.payment_request, pricing.policy…';

--
-- Name: COLUMN business_documents.doc_no; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.doc_no IS 'Số chứng từ (do phân hệ cấp).';

--
-- Name: COLUMN business_documents.doc_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.doc_date IS 'Ngày chứng từ (ngày ghi trên phiếu, theo bảng nguồn); trống khi bảng nguồn chưa có ngày.';

--
-- Name: COLUMN business_documents.branch_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.branch_code IS 'Chi nhánh lập / chi nhánh xuất.';

--
-- Name: COLUMN business_documents.partner_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.partner_ref IS 'Đối tượng (mã NCC / khách / dt_…), rỗng nếu không có.';

--
-- Name: COLUMN business_documents.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.title IS 'Tên loại chứng từ để hiển thị (Đơn đặt hàng, Phiếu nhập kho…).';

--
-- Name: COLUMN business_documents.total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.total IS 'Tổng tiền của chứng từ (0 nếu không có tiền).';

--
-- Name: COLUMN business_documents.status_raw; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.status_raw IS 'Trạng thái riêng của phân hệ (pending_approval, shipped, approved1…).';

--
-- Name: COLUMN business_documents.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.status IS 'Vòng đời chuẩn: draft (nháp, bị trả) · pending (chờ duyệt) · approved (đã duyệt, chưa thực hiện) · in_progress (đang thực hiện: đơn nhập dở, hàng đi đường, hợp đồng / chính sách đang hiệu lực) · done (hoàn tất) · cancelled (huỷ).';

--
-- Name: COLUMN business_documents.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.version IS 'Phiên bản nội dung mới nhất (= số phiên bản cuối ở document_versions).';

--
-- Name: COLUMN business_documents.meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.meta IS 'Thông tin thêm dạng JSON (như local_ledger_meta): hạn thanh toán, kho, số hoá đơn… tuỳ loại.';

--
-- Name: COLUMN business_documents.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.created_by IS 'Người lập chứng từ (theo bảng nguồn): user:<id> hoặc tên hiển thị.';

--
-- Name: COLUMN business_documents.approved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.approved_by IS 'Người duyệt (cấp cuối); rỗng = chưa duyệt / loại chứng từ không có bước duyệt (0162).';

--
-- Name: COLUMN business_documents.approved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.approved_at IS 'Thời điểm duyệt (cấp cuối) (0162).';

--
-- Name: COLUMN business_documents.branch_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.branch_uid IS 'Định danh bất biến đơn vị cn_… của chứng từ (0173), trigger điền theo branch_code.';

--
-- Name: COLUMN business_documents.warehouse_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.warehouse_uid IS 'Định danh bất biến phân kho kho_… (0173), theo meta.warehouseCode / fromWarehouse.';

--
-- Name: COLUMN business_documents.department_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.department_uid IS 'Định danh bất biến bộ phận pb_… (0173), theo meta.departmentCode.';

--
-- Name: COLUMN business_documents.work_branch_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.work_branch_code IS 'Chi nhánh đang làm việc của người lập (nơi lập) — trống thì bằng chi nhánh của chứng từ (0176).';

--
-- Name: COLUMN business_documents.work_branch_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_documents.work_branch_uid IS 'Định danh cn_… của chi nhánh đang làm việc (0176).';

--
-- Name: business_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: business_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_documents_id_seq OWNED BY public.business_documents.id;

--
-- Name: document_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_attachments (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    doc_ref text NOT NULL,
    kind text DEFAULT 'other'::text NOT NULL,
    file_name text NOT NULL,
    content_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 text,
    storage_path text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by text,
    storage_root text DEFAULT 'attachments'::text NOT NULL,
    legacy_ref text,
    CONSTRAINT document_attachments_doc_ref_check CHECK ((doc_ref ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[^\s]{1,200}$'::text)),
    CONSTRAINT document_attachments_file_name_check CHECK (((length(file_name) >= 1) AND (length(file_name) <= 200))),
    CONSTRAINT document_attachments_kind_check CHECK ((kind ~ '^[a-z][a-z0-9_-]{0,39}$'::text)),
    CONSTRAINT document_attachments_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT document_attachments_size_bytes_check CHECK ((size_bytes > 0)),
    CONSTRAINT document_attachments_storage_root_check CHECK ((storage_root = ANY (ARRAY['attachments'::text, 'dinh-kem'::text])))
);

ALTER TABLE ONLY public.document_attachments FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE document_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_attachments IS 'Tệp đính kèm chung của mọi chứng từ (bizcity_document@1 STD-DOC-7). Nội dung trên ổ dữ liệu, ở đây siêu dữ liệu + sha256; gỡ tệp = archived_at, không xoá cứng.';

--
-- Name: COLUMN document_attachments.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN document_attachments.doc_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.doc_ref IS 'Chứng từ được đính kèm (docRef).';

--
-- Name: COLUMN document_attachments.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.kind IS 'Loại tệp do module đặt: chữ thường, số, gạch ngang / gạch dưới (vd contract-scan, hop_dong); mặc định other.';

--
-- Name: COLUMN document_attachments.file_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.file_name IS 'Tên tệp gốc người gửi.';

--
-- Name: COLUMN document_attachments.content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.content_type IS 'Kiểu MIME.';

--
-- Name: COLUMN document_attachments.size_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.size_bytes IS 'Kích thước (byte).';

--
-- Name: COLUMN document_attachments.sha256; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.sha256 IS 'Băm nội dung tệp — kiểm toàn vẹn khi tải về. NULL chỉ ở dòng chuyển từ purchase_attachments (0046) chưa tải lần nào; lần tải đầu máy chủ băm và điền.';

--
-- Name: COLUMN document_attachments.storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.storage_path IS 'Đường dẫn tương đối trong DATA_DIR/attachments/<đơn vị>/ — nội dung tệp không lưu trong CSDL.';

--
-- Name: COLUMN document_attachments.note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.note IS 'Ghi chú.';

--
-- Name: COLUMN document_attachments.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.created_by IS 'Người gửi tệp.';

--
-- Name: COLUMN document_attachments.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.created_at IS 'Thời điểm gửi.';

--
-- Name: COLUMN document_attachments.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.archived_at IS 'Thời điểm gỡ tệp khỏi chứng từ; NULL = đang hiệu lực.';

--
-- Name: COLUMN document_attachments.archived_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.archived_by IS 'Người gỡ tệp.';

--
-- Name: COLUMN document_attachments.storage_root; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.storage_root IS 'Thư mục gốc trong DATA_DIR: attachments (tệp gửi từ 0045) hoặc dinh-kem (tệp Mua hàng gửi trước 0046, giữ nguyên chỗ).';

--
-- Name: COLUMN document_attachments.legacy_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_attachments.legacy_ref IS 'Dòng gốc trước khi dùng đính kèm chung (vd purchase_attachments:12) — đối chiếu khi chuyển dữ liệu; NULL với tệp gửi mới.';

--
-- Name: document_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: document_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_attachments_id_seq OWNED BY public.document_attachments.id;

--
-- Name: document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_links (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    from_ref text NOT NULL,
    to_ref text NOT NULL,
    role text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_links_check CHECK ((from_ref <> to_ref)),
    CONSTRAINT document_links_from_ref_check CHECK ((from_ref ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[^\s]{1,200}$'::text)),
    CONSTRAINT document_links_role_check CHECK ((role = ANY (ARRAY['source'::text, 'reverses'::text, 'replaces'::text, 'settles'::text, 'attachesTo'::text, 'ledger'::text, 'applies'::text, 'uses'::text, 'adjusts'::text]))),
    CONSTRAINT document_links_to_ref_check CHECK ((to_ref ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[^\s]{1,200}$'::text))
);

ALTER TABLE ONLY public.document_links FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE document_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_links IS 'Tham chiếu giữa chứng từ (bizcity_document@1 §3): from_ref --role--> to_ref. Gắn lặp cùng cặp + vai trò thì giữ một dòng.';

--
-- Name: COLUMN document_links.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_links.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN document_links.from_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_links.from_ref IS 'Chứng từ gốc của liên kết (docRef).';

--
-- Name: COLUMN document_links.to_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_links.to_ref IS 'Chứng từ được tham chiếu (docRef; sự việc kế toán: ledger.event:<docKey>).';

--
-- Name: COLUMN document_links.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_links.role IS 'source = lập từ, reverses = đảo, replaces = thay thế, settles = thanh toán cho, attachesTo = đính vào, ledger = sự việc kế toán sinh ra, applies = áp chính sách / chương trình (0162), uses = dùng lô hàng (0162), adjusts = điều chỉnh cho (hoá đơn điều chỉnh → hoá đơn gốc, 0179).';

--
-- Name: COLUMN document_links.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_links.created_by IS 'Người tạo liên kết.';

--
-- Name: COLUMN document_links.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_links.created_at IS 'Thời điểm tạo.';

--
-- Name: document_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: document_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_links_id_seq OWNED BY public.document_links.id;

--
-- Name: document_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_sequences (
    tenant_id bigint NOT NULL,
    doc_type text NOT NULL,
    year smallint NOT NULL,
    last_no integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.document_sequences FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE document_sequences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_sequences IS 'Bộ đếm số phiếu nhập tay theo (đơn vị, loại phiếu, năm).';

--
-- Name: document_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_signatures (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    event_id bigint,
    version integer NOT NULL,
    role text NOT NULL,
    signer text NOT NULL,
    signer_name text NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by text,
    doc_ref text,
    CONSTRAINT document_signatures_doc_ref_check CHECK ((doc_ref ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[^\s]{1,200}$'::text)),
    CONSTRAINT document_signatures_role_check CHECK (((role ~ '^[a-z][a-z0-9_]{1,39}$'::text) AND ((event_id IS NULL) OR (role = ANY (ARRAY['preparer'::text, 'cashier'::text, 'chief_accountant'::text, 'director'::text]))))),
    CONSTRAINT document_signatures_target_check CHECK (((event_id IS NULL) <> (doc_ref IS NULL)))
);

ALTER TABLE ONLY public.document_signatures FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE document_signatures; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_signatures IS 'Ký xác nhận theo vai, gắn phiên bản lúc ký: phiếu kế toán (event_id; người lập, thủ quỹ, kế toán trưởng, giám đốc) hoặc chứng từ của module (doc_ref; vai do module đặt). Phiên bản mới thì chữ ký cũ hết hiệu lực nhưng vẫn lưu; huỷ chữ ký = revoked_at.';

--
-- Name: COLUMN document_signatures.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_signatures.event_id IS 'Phiếu kế toán được ký (accounting_events.id); NULL khi ký chứng từ của module (doc_ref).';

--
-- Name: COLUMN document_signatures.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_signatures.version IS 'Phiên bản chứng từ lúc ký (phiếu kế toán: accounting_events.version; chứng từ module: document_versions.version, chưa lưu phiên bản nào = 1).';

--
-- Name: COLUMN document_signatures.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_signatures.role IS 'Vai ký. Phiếu kế toán: preparer / cashier / chief_accountant / director. Chứng từ module: vai do module đặt (chữ thường, số, gạch dưới).';

--
-- Name: COLUMN document_signatures.doc_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_signatures.doc_ref IS 'Chứng từ của module được ký (<module>.<loại>:<id>); NULL khi ký phiếu kế toán (event_id). Đúng một trong hai có giá trị.';

--
-- Name: document_signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.document_signatures ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.document_signatures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    doc_ref text NOT NULL,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    content_hash text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_versions_doc_ref_check CHECK ((doc_ref ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[^\s]{1,200}$'::text)),
    CONSTRAINT document_versions_version_check CHECK ((version > 0))
);

ALTER TABLE ONLY public.document_versions FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE document_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_versions IS 'Ảnh chụp từng phiên bản chứng từ nghiệp vụ (bizcity_document@1 STD-DOC-2): chỉ thêm, không sửa / xoá. Nội dung trùng phiên bản trước thì không thêm.';

--
-- Name: COLUMN document_versions.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN document_versions.doc_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.doc_ref IS 'Chứng từ: <module>.<loại>:<id> (vd hop-dong.contract:42).';

--
-- Name: COLUMN document_versions.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.version IS 'Số phiên bản, tăng từ 1 theo từng doc_ref.';

--
-- Name: COLUMN document_versions.snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.snapshot IS 'Nội dung chứng từ tại phiên bản này (JSON do module gửi).';

--
-- Name: COLUMN document_versions.content_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.content_hash IS 'sha256 của nội dung đã chuẩn hoá (khoá sắp xếp) — so để biết nội dung có đổi.';

--
-- Name: COLUMN document_versions.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.created_by IS 'Người lưu phiên bản (actor của action).';

--
-- Name: COLUMN document_versions.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_versions.created_at IS 'Thời điểm lưu.';

--
-- Name: document_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: document_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_versions_id_seq OWNED BY public.document_versions.id;

--
-- Name: event_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_deliveries (
    tenant_id bigint NOT NULL,
    consumer text NOT NULL,
    event_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    done_at timestamp with time zone,
    consumed_at timestamp with time zone,
    CONSTRAINT event_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'dead'::text, 'skipped'::text])))
);

ALTER TABLE ONLY public.event_deliveries FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE event_deliveries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.event_deliveries IS 'Giao sự kiện cho từng subscriber: tạo lúc phát, dispatcher đọc SKIP LOCKED, thử lại giãn nhịp, quá số lần → dead.';

--
-- Name: COLUMN event_deliveries.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.tenant_id IS 'Đơn vị (chép từ sự kiện) — lọc / RLS không cần nối event_outbox.';

--
-- Name: COLUMN event_deliveries.consumer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.consumer IS 'id subscriber (defineSubscriber.id); đổi id = mất lịch sử đã xử lý.';

--
-- Name: COLUMN event_deliveries.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.event_id IS 'Sự kiện được giao (event_outbox.id).';

--
-- Name: COLUMN event_deliveries.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.status IS 'pending: chờ giao / chờ thử lại; done: đã xử lý; dead: hết lượt thử, hiện ở tự chẩn đoán; skipped: module của subscriber đang tắt ở đơn vị lúc giao (0052) — không xử lý, bật lại thì phát lại bằng core.events.replay nếu cần.';

--
-- Name: COLUMN event_deliveries.attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.attempts IS 'Số lần đã thử.';

--
-- Name: COLUMN event_deliveries.next_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.next_at IS 'Lúc được thử tiếp.';

--
-- Name: COLUMN event_deliveries.last_error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.last_error IS 'Lỗi lần thử gần nhất (đã cắt ngắn, không dữ liệu cá nhân).';

--
-- Name: COLUMN event_deliveries.done_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.done_at IS 'Lúc xử lý xong.';

--
-- Name: COLUMN event_deliveries.consumed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_deliveries.consumed_at IS 'Thời điểm subscriber đã xử lý sự kiện (0161, thay event_consumptions): có giá trị thì giao lại → bỏ qua (R-OUTBOX-4); phát lại thì xoá.';

--
-- Name: event_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_outbox (
    id uuid NOT NULL,
    seq bigint NOT NULL,
    tenant_id bigint NOT NULL,
    type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    subject text NOT NULL,
    source_module text NOT NULL,
    actor_kind text NOT NULL,
    actor_id text NOT NULL,
    correlation_id text,
    causation_id uuid,
    dedupe_key text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    trace_parent text,
    CONSTRAINT event_outbox_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['user'::text, 'apikey'::text, 'ai'::text, 'system'::text]))),
    CONSTRAINT event_outbox_trace_parent_check CHECK (((trace_parent IS NULL) OR (trace_parent ~ '^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$'::text))),
    CONSTRAINT event_outbox_type_check CHECK ((type ~ '^[a-z][a-z0-9-]*(\.[a-z0-9-]+){2,}$'::text)),
    CONSTRAINT event_outbox_version_check CHECK ((version >= 1))
);

ALTER TABLE ONLY public.event_outbox FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE event_outbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.event_outbox IS 'Sự kiện miền (bizcity_event@1): ghi cùng giao dịch với dữ liệu, giao sau commit. Chỉ thêm; xoá khi quá hạn giữ.';

--
-- Name: COLUMN event_outbox.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.id IS 'UUID v7 (có thứ tự thời gian); khoá chống trùng của consumer.';

--
-- Name: COLUMN event_outbox.seq; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.seq IS 'Thứ tự ghi; giao theo seq trong cùng (đơn vị, subject).';

--
-- Name: COLUMN event_outbox.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.type IS '<module>.<thực thể>.<việc ở quá khứ>; sự kiện Core bắt đầu bằng bizcity.';

--
-- Name: COLUMN event_outbox.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.version IS 'Phiên bản khuôn data của loại sự kiện này (không phải phiên bản chứng từ).';

--
-- Name: COLUMN event_outbox.subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.subject IS 'Đối tượng (docKey, period:<yyyy-mm>, clock…): khoá thứ tự giao.';

--
-- Name: COLUMN event_outbox.source_module; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.source_module IS 'Module phát (bizcity.kernel, bizcity.platform, <key> của module).';

--
-- Name: COLUMN event_outbox.actor_kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.actor_kind IS 'user / apikey / ai / system.';

--
-- Name: COLUMN event_outbox.actor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.actor_id IS 'Định danh người / khoá / tiến trình gây ra sự kiện.';

--
-- Name: COLUMN event_outbox.correlation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.correlation_id IS 'Nối chuỗi phản ứng (X-Correlation-Id, mặc định mã yêu cầu).';

--
-- Name: COLUMN event_outbox.causation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.causation_id IS 'Sự kiện gây ra sự kiện này (subscriber phát tiếp).';

--
-- Name: COLUMN event_outbox.dedupe_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.dedupe_key IS 'Khoá chống phát trùng trong một đơn vị (vd bizcity.clock.daily:2026-10-30); NULL = không chống.';

--
-- Name: COLUMN event_outbox.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.data IS 'Chỉ mã và số; không dữ liệu cá nhân thô, không tài khoản kế toán (STD-DATA-10).';

--
-- Name: COLUMN event_outbox.occurred_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.occurred_at IS 'Lúc phát (thời điểm giao dịch ghi).';

--
-- Name: COLUMN event_outbox.trace_parent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_outbox.trace_parent IS 'W3C traceparent của span phát (ADR-0010): span giao sự kiện nối (link) về đây. NULL = phát khi chưa bật truy vết / sự kiện trước 0047.';

--
-- Name: event_outbox_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_outbox_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: event_outbox_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_outbox_seq_seq OWNED BY public.event_outbox.seq;

--
-- Name: library_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_change_requests (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    library_id text NOT NULL,
    item_code text,
    kind text NOT NULL,
    content text NOT NULL,
    basis_key text,
    status text DEFAULT 'gui'::text NOT NULL,
    resolved_version text,
    status_note text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    CONSTRAINT library_change_requests_basis_key_check CHECK (((basis_key IS NULL) OR ((length(basis_key) >= 1) AND (length(basis_key) <= 80)))),
    CONSTRAINT library_change_requests_content_check CHECK (((length(btrim(content)) >= 5) AND (length(btrim(content)) <= 2000))),
    CONSTRAINT library_change_requests_item_code_check CHECK (((item_code IS NULL) OR ((length(item_code) >= 1) AND (length(item_code) <= 80)))),
    CONSTRAINT library_change_requests_kind_check CHECK ((kind = ANY (ARRAY['them-muc'::text, 'sua-gia-tri'::text, 'can-cu'::text, 'bao-sai'::text, 'ngung-dung'::text]))),
    CONSTRAINT library_change_requests_library_id_check CHECK ((library_id ~ '^[a-z0-9-]+\.[a-z0-9][a-z0-9-]{1,48}$'::text)),
    CONSTRAINT library_change_requests_resolved_version_check CHECK (((resolved_version IS NULL) OR (resolved_version ~ '^\d+\.\d+\.\d+$'::text))),
    CONSTRAINT library_change_requests_status_check CHECK ((status = ANY (ARRAY['gui'::text, 'nhan'::text, 'da-vao'::text, 'tu-choi'::text, 'rut'::text]))),
    CONSTRAINT library_change_requests_status_note_check CHECK (((status_note IS NULL) OR (length(status_note) <= 500)))
);

ALTER TABLE ONLY public.library_change_requests FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE library_change_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.library_change_requests IS 'Phiếu đề xuất cập nhật thư viện của đơn vị gửi Nhóm Lõi (S030-49b, PHASE-030 · 26 §5): không đổi thư viện gốc; vào bản mới qua PR. Không lưu dữ liệu khách / số tiền chứng từ (R-SEC-10).';

--
-- Name: COLUMN library_change_requests.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.id IS 'Số phiếu.';

--
-- Name: COLUMN library_change_requests.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.tenant_id IS 'Đơn vị gửi.';

--
-- Name: COLUMN library_change_requests.library_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.library_id IS 'Thư viện được đề xuất.';

--
-- Name: COLUMN library_change_requests.item_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.item_code IS 'Mã mục liên quan (trống khi đề xuất thêm mục mới).';

--
-- Name: COLUMN library_change_requests.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.kind IS 'them-muc · sua-gia-tri · can-cu · bao-sai · ngung-dung.';

--
-- Name: COLUMN library_change_requests.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.content IS 'Nội dung đề xuất (giá trị mới, khoảng hiệu lực, lý do).';

--
-- Name: COLUMN library_change_requests.basis_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.basis_key IS 'Mã / bí danh văn bản căn cứ trong vn.can-cu-phap-ly (tuỳ chọn).';

--
-- Name: COLUMN library_change_requests.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.status IS 'gui (đã gửi) → nhan (Nhóm Lõi nhận) → da-vao (đã vào bản) | tu-choi; rut = người gửi rút.';

--
-- Name: COLUMN library_change_requests.resolved_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.resolved_version IS 'Bản thư viện đã đưa đề xuất vào (khi da-vao).';

--
-- Name: COLUMN library_change_requests.status_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.status_note IS 'Ghi chú lần đổi trạng thái gần nhất.';

--
-- Name: COLUMN library_change_requests.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.created_by IS 'Người gửi.';

--
-- Name: COLUMN library_change_requests.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.created_at IS 'Lúc gửi.';

--
-- Name: COLUMN library_change_requests.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.updated_by IS 'Người đổi trạng thái gần nhất.';

--
-- Name: COLUMN library_change_requests.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_change_requests.updated_at IS 'Lúc đổi trạng thái gần nhất.';

--
-- Name: library_change_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.library_change_requests ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.library_change_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: library_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_settings (
    tenant_id bigint NOT NULL,
    library_id text NOT NULL,
    version integer NOT NULL,
    config jsonb NOT NULL,
    reason text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_settings_config_check CHECK ((jsonb_typeof(config) = 'object'::text)),
    CONSTRAINT library_settings_library_id_check CHECK ((library_id ~ '^[a-z0-9-]+\.[a-z0-9][a-z0-9-]{1,48}$'::text)),
    CONSTRAINT library_settings_reason_check CHECK (((length(btrim(reason)) >= 5) AND (length(btrim(reason)) <= 500))),
    CONSTRAINT library_settings_version_check CHECK ((version >= 1))
);

ALTER TABLE ONLY public.library_settings FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE library_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.library_settings IS 'Cấu hình thư viện theo đơn vị (S030-49b, PHASE-030 · 26 §7.1): mỗi lần đổi một phiên bản mới, chỉ thêm; bản hiện hành = phiên bản lớn nhất.';

--
-- Name: COLUMN library_settings.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN library_settings.library_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.library_id IS 'id thư viện <miền>.<tên>.';

--
-- Name: COLUMN library_settings.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.version IS 'Phiên bản cấu hình của đơn vị cho thư viện này (1, 2, …).';

--
-- Name: COLUMN library_settings.config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.config IS '{ enabled?, atPolicy?: docDate|today, ruleLevels?: { mã luật: warn|info }, overrides?: { mã mục: [{ from, value, reason, basisKey? }] } }.';

--
-- Name: COLUMN library_settings.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.reason IS 'Lý do đổi (bắt buộc).';

--
-- Name: COLUMN library_settings.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.created_by IS 'Người đổi (id người dùng / khoá).';

--
-- Name: COLUMN library_settings.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_settings.created_at IS 'Lúc đổi.';

--
-- Name: mcp_confirm_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_confirm_tokens (
    jti text NOT NULL,
    tenant_id bigint NOT NULL,
    tool text NOT NULL,
    actor text NOT NULL,
    args_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.mcp_confirm_tokens FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE mcp_confirm_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mcp_confirm_tokens IS 'Token xác nhận trước khi ghi qua MCP (bizcity_mcp@1 STD-MCP-4): một lần, 900 giây, gắn công cụ + người gọi + băm tham số.';

--
-- Name: COLUMN mcp_confirm_tokens.jti; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.jti IS 'Mã token ngẫu nhiên (confirm_token trả cho AI).';

--
-- Name: COLUMN mcp_confirm_tokens.tool; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.tool IS 'Tên công cụ MCP được xác nhận, vd quy.payment_request.create.';

--
-- Name: COLUMN mcp_confirm_tokens.actor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.actor IS 'Người / khoá đã nhận bản xem trước: chỉ chính người đó dùng được token.';

--
-- Name: COLUMN mcp_confirm_tokens.args_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.args_hash IS 'SHA-256 tham số lúc xem trước: gọi xác nhận với tham số khác → MCP_CONFIRM_ARGS_CHANGED.';

--
-- Name: COLUMN mcp_confirm_tokens.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.expires_at IS 'Hết hạn (900 giây sau khi cấp).';

--
-- Name: COLUMN mcp_confirm_tokens.used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.used_at IS 'Lúc đã ghi thật bằng token này (NULL = chưa dùng).';

--
-- Name: COLUMN mcp_confirm_tokens.idempotency_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_confirm_tokens.idempotency_key IS 'params._meta.idempotency_key của lần dùng: gửi lại cùng khoá → trả kết quả cũ (meta.replayed), khoá khác → MCP_CONFIRM_INVALID.';

--
-- Name: module_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_registry (
    key text NOT NULL,
    kind text NOT NULL,
    version text NOT NULL,
    source text DEFAULT 'bundled'::text NOT NULL,
    build_hash text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    installed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    history jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_load_at timestamp with time zone,
    last_load_result text,
    last_load_hash text,
    CONSTRAINT module_registry_build_hash_check CHECK ((build_hash ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT module_registry_key_check CHECK ((key ~ '^[a-z][a-z0-9-]*$'::text)),
    CONSTRAINT module_registry_kind_check CHECK ((kind = ANY (ARRAY['module'::text, 'addin'::text]))),
    CONSTRAINT module_registry_last_load_result_check CHECK ((last_load_result = ANY (ARRAY['loaded'::text, 'skipped_status'::text, 'skipped_hash'::text, 'skipped_missing'::text]))),
    CONSTRAINT module_registry_source_check CHECK ((source = ANY (ARRAY['bundled'::text, 'local'::text]))),
    CONSTRAINT module_registry_status_check CHECK ((status = ANY (ARRAY['installed'::text, 'active'::text, 'disabled'::text])))
);

--
-- Name: TABLE module_registry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.module_registry IS 'Module / add-in đã cài vào BẢN CÀI (ADR-0011 D1, D2): phiên bản, hash bản dựng, trạng thái. Cấp bản cài, không theo đơn vị. Ghi bằng job cài đặt / lệnh module; API chỉ đọc + ghi kết quả nạp.';

--
-- Name: COLUMN module_registry.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.key IS 'Khoá module (manifest key), trùng thư mục.';

--
-- Name: COLUMN module_registry.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.kind IS 'module (phân hệ) | addin.';

--
-- Name: COLUMN module_registry.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.version IS 'Phiên bản manifest lúc cài / nâng cấp lần cuối.';

--
-- Name: COLUMN module_registry.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.source IS 'bundled: đi kèm mã nguồn Core (apps/api/src/phan-he, addins); local: module bản cài tự thêm (modules/<key>, PR-5).';

--
-- Name: COLUMN module_registry.build_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.build_hash IS 'sha256 của thư mục module (đường dẫn tương đối + nội dung, sắp theo đường dẫn) lúc cài / nâng cấp. API so với thư mục đang chạy.';

--
-- Name: COLUMN module_registry.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.status IS 'installed: đã cài, chưa nạp; active: nạp khi khởi động; disabled: không nạp trên cả bản cài.';

--
-- Name: COLUMN module_registry.installed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.installed_at IS 'Lúc cài lần đầu.';

--
-- Name: COLUMN module_registry.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.updated_at IS 'Lúc đổi phiên bản / hash / trạng thái lần cuối.';

--
-- Name: COLUMN module_registry.history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.history IS 'Lịch sử chỉ thêm: [{at, by, action: install|upgrade|rehash|activate|deactivate, from?, to?}].';

--
-- Name: COLUMN module_registry.last_load_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.last_load_at IS 'Lần API khởi động gần nhất xét module này.';

--
-- Name: COLUMN module_registry.last_load_result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.last_load_result IS 'loaded | skipped_status (không active) | skipped_hash (hash lệch) | skipped_missing (registry có, mã không có). DG-MOD-1 đọc cột này.';

--
-- Name: COLUMN module_registry.last_load_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.module_registry.last_load_hash IS 'Hash thư mục module API thấy ở lần khởi động gần nhất.';

--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_reads (
    notification_id bigint NOT NULL,
    user_id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notification_reads FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE notification_reads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_reads IS 'Người đã đọc thông báo nào, lúc nào.';

--
-- Name: COLUMN notification_reads.notification_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_reads.notification_id IS 'Thông báo.';

--
-- Name: COLUMN notification_reads.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_reads.user_id IS 'Người đọc (users.id).';

--
-- Name: COLUMN notification_reads.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_reads.tenant_id IS 'Đơn vị (RLS).';

--
-- Name: COLUMN notification_reads.read_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_reads.read_at IS 'Lúc đánh dấu đã đọc.';

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    source text NOT NULL,
    recipient_user_id bigint,
    audience_permission text,
    title text NOT NULL,
    body text,
    link text,
    dedupe_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_body_check CHECK (((body IS NULL) OR (length(body) <= 2000))),
    CONSTRAINT notifications_check CHECK (((recipient_user_id IS NULL) <> (audience_permission IS NULL))),
    CONSTRAINT notifications_link_check CHECK (((link IS NULL) OR (link ~ '^/'::text))),
    CONSTRAINT notifications_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)))
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS 'Thông báo trong ứng dụng (notify.inapp): Core / module gửi tới một người hoặc mọi người có một quyền. Chỉ thêm.';

--
-- Name: COLUMN notifications.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.id IS 'Số thông báo.';

--
-- Name: COLUMN notifications.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN notifications.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.source IS 'Nguồn gửi: mã module (vd hop-dong) hoặc core.';

--
-- Name: COLUMN notifications.recipient_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.recipient_user_id IS 'Gửi riêng một người (users.id); NULL khi gửi theo quyền.';

--
-- Name: COLUMN notifications.audience_permission; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.audience_permission IS 'Gửi mọi người của đơn vị có quyền này (vd hop-dong:collect); NULL khi gửi riêng.';

--
-- Name: COLUMN notifications.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.title IS 'Tiêu đề (≤ 200 ký tự), không chứa số tiền.';

--
-- Name: COLUMN notifications.body; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.body IS 'Nội dung ngắn (≤ 2000 ký tự).';

--
-- Name: COLUMN notifications.link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.link IS 'Đường dẫn màn trong ứng dụng (bắt đầu bằng /), bấm để mở.';

--
-- Name: COLUMN notifications.dedupe_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.dedupe_key IS 'Khoá chống trùng theo (đơn vị, nguồn): giao lại sự kiện không gửi lần hai.';

--
-- Name: COLUMN notifications.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.created_at IS 'Lúc gửi.';

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: policy_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_registry (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    policy_key text NOT NULL,
    policy_id text NOT NULL,
    version integer NOT NULL,
    owner_module text NOT NULL,
    rule_contract text NOT NULL,
    scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    effective_from date,
    effective_to date,
    status text DEFAULT 'published'::text NOT NULL,
    store text NOT NULL,
    store_ref text DEFAULT ''::text NOT NULL,
    content jsonb,
    content_hash text NOT NULL,
    legal_ref text,
    published_by text NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT policy_registry_content_hash_check CHECK ((content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT policy_registry_inline_chk CHECK (((store = 'inline'::text) = (content IS NOT NULL))),
    CONSTRAINT policy_registry_owner_module_check CHECK ((owner_module ~ '^[a-z0-9-]+$'::text)),
    CONSTRAINT policy_registry_policy_id_check CHECK ((policy_id ~ '^[a-z0-9-]+:[a-z0-9_.-]+:[A-Za-z0-9_.-]+$'::text)),
    CONSTRAINT policy_registry_policy_key_check CHECK (((length(btrim(policy_key)) >= 1) AND (length(btrim(policy_key)) <= 128))),
    CONSTRAINT policy_registry_range_chk CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= (effective_from - 1)))),
    CONSTRAINT policy_registry_rule_contract_check CHECK ((rule_contract ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+@[0-9]+$'::text)),
    CONSTRAINT policy_registry_status_check CHECK ((status = ANY (ARRAY['published'::text, 'retired'::text]))),
    CONSTRAINT policy_registry_store_check CHECK ((store = ANY (ARRAY['module'::text, 'settings'::text, 'inline'::text]))),
    CONSTRAINT policy_registry_version_check CHECK ((version >= 1))
);

ALTER TABLE ONLY public.policy_registry FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE policy_registry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_registry IS 'Sổ đăng ký chính sách (ADR-0031): phong bì từng bản chính sách nghiệp vụ. Nội dung ở module chủ (store = module / settings) hoặc ngay dòng này (inline). Bản đã phát hành không sửa; chỉ được ngừng hoặc đóng hiệu lực khi có bản mới.';

--
-- Name: COLUMN policy_registry.policy_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.policy_key IS 'Mã hiển thị của chính sách (vd mã chính sách mua hàng) — mã ≠ định danh (ADR-0028).';

--
-- Name: COLUMN policy_registry.policy_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.policy_id IS 'Định danh ổn định qua mọi bản: <module>:<bảng>:<id>, vd mua-hang:purchase_policies:42.';

--
-- Name: COLUMN policy_registry.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.version IS 'Số bản, tăng dần theo (đơn vị, policy_id).';

--
-- Name: COLUMN policy_registry.owner_module; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.owner_module IS 'Module sở hữu nội dung — chỉ module này phát hành bản mới (D-POL-2).';

--
-- Name: COLUMN policy_registry.rule_contract; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.rule_contract IS 'Khuôn luật <miền>.<loại>@<major> (D-POL-3), vd purchase.trade_discount@1.';

--
-- Name: COLUMN policy_registry.scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.scope IS 'Phạm vi áp (đối tác, nhãn, mã hàng, chi nhánh, kênh…) như module khai; rỗng = mọi.';

--
-- Name: COLUMN policy_registry.effective_from; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.effective_from IS 'Hiệu lực của BẢN theo ngày chứng từ: từ ngày (NULL = từ đầu). Khác hiệu lực nghiệp vụ nằm trong nội dung chính sách.';

--
-- Name: COLUMN policy_registry.effective_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.effective_to IS 'Hiệu lực của bản: đến ngày (NULL = chưa đóng). Đặt một lần khi bản mới thay thế.';

--
-- Name: COLUMN policy_registry.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.status IS 'published (đang dùng được) | retired (ngừng; chứng từ cũ vẫn trỏ được).';

--
-- Name: COLUMN policy_registry.store; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.store IS 'Nội dung ở đâu: module (bảng của module chủ) | settings (setting_values) | inline (cột content).';

--
-- Name: COLUMN policy_registry.store_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.store_ref IS 'Chỗ nội dung trong kho của module, vd purchase_policy_versions:42@3.';

--
-- Name: COLUMN policy_registry.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.content IS 'Nội dung khi store = inline (chính sách không thuộc module nào, chủ he-thong).';

--
-- Name: COLUMN policy_registry.content_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.content_hash IS 'sha256 nội dung đã chuẩn hoá (contentHash của core/documents.ts) lúc phát hành — chứng từ tham chiếu kiểm khớp bằng băm này.';

--
-- Name: COLUMN policy_registry.legal_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.legal_ref IS 'Căn cứ (văn bản, điều, khoản; quy chế nội bộ).';

--
-- Name: COLUMN policy_registry.published_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.published_by IS 'Người phát hành (user:<id> / apikey:<id> / system:<luồng>).';

--
-- Name: COLUMN policy_registry.published_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.published_at IS 'Lúc phát hành bản.';

--
-- Name: COLUMN policy_registry.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.reason IS 'Lý do phát hành bản này.';

--
-- Name: COLUMN policy_registry.findings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_registry.findings IS 'Cảnh báo lúc phát hành (mã bizcity_findings@1, vd POL-ACC-001).';

--
-- Name: policy_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.policy_registry ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.policy_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: setting_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setting_values (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    key text NOT NULL,
    scope_type text NOT NULL,
    scope_id text DEFAULT ''::text NOT NULL,
    value jsonb NOT NULL,
    valid_from date DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date NOT NULL,
    version integer NOT NULL,
    reason text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    basis jsonb,
    CONSTRAINT setting_values_basis_check CHECK (((basis IS NULL) OR (jsonb_typeof(basis) = 'object'::text))),
    CONSTRAINT setting_values_key_check CHECK ((key ~ '^bizcity\.[a-z0-9_]+(\.[a-z0-9_]+)+$'::text)),
    CONSTRAINT setting_values_reason_check CHECK (((reason IS NULL) OR (length(btrim(reason)) >= 3))),
    CONSTRAINT setting_values_scope_chk CHECK (((scope_type = 'tenant'::text) = (scope_id = ''::text))),
    CONSTRAINT setting_values_scope_type_check CHECK ((scope_type = ANY (ARRAY['tenant'::text, 'accounting_unit'::text, 'branch'::text, 'user'::text]))),
    CONSTRAINT setting_values_version_check CHECK ((version >= 1))
);

ALTER TABLE ONLY public.setting_values FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE setting_values; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.setting_values IS 'Giá trị cấu hình có phiên bản (bizcity_settings@1 §2, PHASE-029 E2). Chỉ thêm: mỗi lần ghi một dòng; giá trị hiệu lực = dòng valid_from ≤ ngày mới nhất ở phạm vi hẹp nhất có giá trị.';

--
-- Name: COLUMN setting_values.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.id IS 'Định danh dòng.';

--
-- Name: COLUMN setting_values.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN setting_values.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.key IS 'Khoá registry (docs/contracts/bizcity-settings.registry.json), dạng bizcity.<miền>.<khoá>.';

--
-- Name: COLUMN setting_values.scope_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.scope_type IS 'Phạm vi: tenant | accounting_unit | branch | user (hẹp dần: user thắng trước).';

--
-- Name: COLUMN setting_values.scope_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.scope_id IS 'Định danh phạm vi dạng chữ (accounting_units.id / branches.id / users.id); chuỗi rỗng khi tenant.';

--
-- Name: COLUMN setting_values.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.value IS 'Giá trị (jsonb) đã kiểm theo valueType của khoá.';

--
-- Name: COLUMN setting_values.valid_from; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.valid_from IS 'Ngày bắt đầu hiệu lực (giờ Việt Nam).';

--
-- Name: COLUMN setting_values.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.version IS 'Phiên bản tăng dần theo (đơn vị, khoá, phạm vi).';

--
-- Name: COLUMN setting_values.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.reason IS 'Lý do đổi; bắt buộc với khoá loại A hoặc hiệu lực lùi về trước ngày ghi.';

--
-- Name: COLUMN setting_values.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.created_by IS 'Người ghi (user:<id> / apikey:<id>).';

--
-- Name: COLUMN setting_values.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.created_at IS 'Lúc ghi.';

--
-- Name: COLUMN setting_values.basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.setting_values.basis IS 'Căn cứ của phiên bản này: { doc, article?, clause?, point?, url?, effectiveFrom? } (bizcity_settings@1 1.2.0). Rỗng = chưa khai căn cứ; không bắt buộc.';

--
-- Name: setting_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.setting_values ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.setting_values_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: tenant_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_modules (
    tenant_id bigint NOT NULL,
    module_key text NOT NULL,
    enabled boolean NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by text NOT NULL,
    reason text,
    CONSTRAINT tenant_modules_module_key_check CHECK ((module_key ~ '^[a-z][a-z0-9-]*$'::text))
);

ALTER TABLE ONLY public.tenant_modules FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE tenant_modules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_modules IS 'Bật / tắt module cho từng đơn vị (ADR-0011 D1). Không có dòng = bật. Tắt: route trả MODULE_DISABLED, sự kiện giao skipped; dữ liệu, bút toán giữ nguyên.';

--
-- Name: COLUMN tenant_modules.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_modules.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN tenant_modules.module_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_modules.module_key IS 'Khoá module / add-in (module_registry.key).';

--
-- Name: COLUMN tenant_modules.enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_modules.enabled IS 'true: bật; false: tắt cho đơn vị này.';

--
-- Name: COLUMN tenant_modules.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_modules.changed_at IS 'Lúc đổi lần cuối.';

--
-- Name: COLUMN tenant_modules.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_modules.changed_by IS 'Người đổi (user:<id>).';

--
-- Name: COLUMN tenant_modules.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_modules.reason IS 'Lý do tắt / bật (ghi cùng bằng chứng của action core.module.enable / disable).';

--
-- Name: tenant_role_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_role_rules (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    tenant_role_id bigint NOT NULL,
    permission text NOT NULL,
    effect text NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    note text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    removed_by text,
    removed_at timestamp with time zone,
    remove_reason text,
    CONSTRAINT tenant_role_rules_allow_exact_chk CHECK (((effect <> 'allow'::text) OR (POSITION(('*'::text) IN (permission)) = 0))),
    CONSTRAINT tenant_role_rules_conditions_check CHECK ((conditions = '{}'::jsonb)),
    CONSTRAINT tenant_role_rules_effect_check CHECK ((effect = ANY (ARRAY['allow'::text, 'deny'::text]))),
    CONSTRAINT tenant_role_rules_permission_check CHECK ((permission ~ '^[a-z*][a-z0-9*-]*:[a-z*][a-z0-9*-]*$'::text)),
    CONSTRAINT tenant_role_rules_remove_chk CHECK ((((removed_at IS NULL) = (removed_by IS NULL)) AND ((removed_at IS NULL) OR (length(btrim(COALESCE(remove_reason, ''::text))) >= 3))))
);

ALTER TABLE ONLY public.tenant_role_rules FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE tenant_role_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_role_rules IS 'Luật Cho / Cấm của vai trò của đơn vị (ADR-0027 Phụ lục A, D-AUTH-12). Chỉ thêm; gỡ luật bằng removed_* một lần. Nới (relax) và điều kiện: bước 4.';

--
-- Name: COLUMN tenant_role_rules.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.id IS 'Định danh luật.';

--
-- Name: COLUMN tenant_role_rules.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.tenant_id IS 'Đơn vị; khoá ngoại ghép với tenant_role_id nên luật không trỏ vai trò của đơn vị khác.';

--
-- Name: COLUMN tenant_role_rules.tenant_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.tenant_role_id IS 'Vai trò chứa luật.';

--
-- Name: COLUMN tenant_role_rules.permission; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.permission IS 'Quyền <module>:<việc>. Cho: đích danh; Cấm: được dùng *. Quyền phải có trong sổ quyền của code (kiểm ở API).';

--
-- Name: COLUMN tenant_role_rules.effect; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.effect IS 'allow (Cho) | deny (Cấm, thắng mọi Cho trong cùng phạm vi).';

--
-- Name: COLUMN tenant_role_rules.conditions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.conditions IS 'Điều kiện của luật (bizcity_authorization@1 §5); bước 1 luôn {}.';

--
-- Name: COLUMN tenant_role_rules.note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.note IS 'Ghi chú của người lập.';

--
-- Name: COLUMN tenant_role_rules.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.created_by IS 'Người thêm luật (user:<id>).';

--
-- Name: COLUMN tenant_role_rules.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.created_at IS 'Lúc thêm.';

--
-- Name: COLUMN tenant_role_rules.removed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.removed_by IS 'Người gỡ luật; NULL = đang áp dụng.';

--
-- Name: COLUMN tenant_role_rules.removed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.removed_at IS 'Lúc gỡ; đặt một lần.';

--
-- Name: COLUMN tenant_role_rules.remove_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_role_rules.remove_reason IS 'Lý do gỡ (bắt buộc khi gỡ).';

--
-- Name: tenant_role_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tenant_role_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tenant_role_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: tenant_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_roles (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    kind text NOT NULL,
    base_role text,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    CONSTRAINT tenant_roles_base_role_check CHECK ((base_role = ANY (ARRAY['chief_accountant'::text, 'accountant'::text, 'viewer'::text, 'developer'::text, 'auditor'::text, 'staff'::text]))),
    CONSTRAINT tenant_roles_code_check CHECK (((code ~ '^[a-z][a-z0-9_-]{1,39}$'::text) AND (code <> ALL (ARRAY['owner'::text, 'chief_accountant'::text, 'accountant'::text, 'viewer'::text, 'developer'::text, 'auditor'::text])))),
    CONSTRAINT tenant_roles_kind_check CHECK ((kind = ANY (ARRAY['job'::text, 'privilege'::text, 'restriction'::text]))),
    CONSTRAINT tenant_roles_label_check CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 120))),
    CONSTRAINT tenant_roles_restriction_chk CHECK (((kind <> 'restriction'::text) OR (base_role IS NULL))),
    CONSTRAINT tenant_roles_version_check CHECK ((version >= 1))
);

ALTER TABLE ONLY public.tenant_roles FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE tenant_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_roles IS 'Vai trò của đơn vị (ADR-0027 Phụ lục A, D-AUTH-11): vai trò nền + luật Cho / Cấm ở tenant_role_rules. Không xoá — vô hiệu bằng is_active; mã, loại, vai trò nền bất biến.';

--
-- Name: COLUMN tenant_roles.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.id IS 'Định danh vai trò; lần gán trỏ vào đây (user_role_assignments.tenant_role_id), không trỏ mã.';

--
-- Name: COLUMN tenant_roles.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN tenant_roles.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.code IS 'Mã vai trò, duy nhất theo đơn vị, không trùng 6 mã vai trò hệ thống. Bất biến.';

--
-- Name: COLUMN tenant_roles.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.label IS 'Tên hiển thị (vd "Thủ kho"). Sửa được, kèm tăng version.';

--
-- Name: COLUMN tenant_roles.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.kind IS 'job: vai trò công việc; privilege: đặc quyền thêm; restriction: chỉ để Cấm (không có vai trò nền). Bất biến.';

--
-- Name: COLUMN tenant_roles.base_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.base_role IS 'Vai trò hệ thống làm nền (kế thừa một cấp, D-AUTH-14); không bao giờ là owner. NULL = không nền. Bất biến — đổi nền = vai trò mới.';

--
-- Name: COLUMN tenant_roles.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.is_active IS 'false = vô hiệu: lần gán còn đó nhưng không cấp gì.';

--
-- Name: COLUMN tenant_roles.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.version IS 'Tăng đúng 1 ở mỗi lần sửa tên / bật tắt (trigger kiểm).';

--
-- Name: COLUMN tenant_roles.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.created_by IS 'Người tạo (user:<id>).';

--
-- Name: COLUMN tenant_roles.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.created_at IS 'Lúc tạo.';

--
-- Name: COLUMN tenant_roles.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.updated_by IS 'Người sửa gần nhất (bắt buộc khi sửa).';

--
-- Name: COLUMN tenant_roles.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_roles.updated_at IS 'Lúc sửa gần nhất (bắt buộc khi sửa).';

--
-- Name: CONSTRAINT tenant_roles_base_role_check ON tenant_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT tenant_roles_base_role_check ON public.tenant_roles IS 'Vai trò nền hợp lệ của vai trò đơn vị — không owner (0149 thêm staff).';

--
-- Name: tenant_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tenant_roles ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tenant_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    tax_code text,
    address text,
    phone text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    config_version bigint DEFAULT 0 NOT NULL,
    authz_version bigint DEFAULT 0 NOT NULL,
    is_sample boolean DEFAULT false NOT NULL
);

--
-- Name: TABLE tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenants IS 'Đơn vị sử dụng (công ty). Mọi dữ liệu nghiệp vụ gắn tenant_id.';

--
-- Name: COLUMN tenants.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.settings IS 'Cấu hình riêng của đơn vị: add-in bật, mẫu in, tuỳ chọn hiển thị.';

--
-- Name: COLUMN tenants.config_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.config_version IS 'Tăng 1 mỗi lần ghi cấu hình qua settings.set (bizcity_settings@1 §2.1) — khoá huỷ bộ nhớ đệm cấu hình của đơn vị (R-CACHE).';

--
-- Name: COLUMN tenants.authz_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.authz_version IS 'Phiên bản phân quyền của đơn vị: trigger tăng mỗi lần ghi tenant_roles / tenant_role_rules / user_role_assignments. Bộ tính nhận làm authzVersion; đệm quyền cũ hơn số này là cũ (ADR-0027 Phụ lục A).';

--
-- Name: COLUMN tenants.is_sample; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.is_sample IS 'Đơn vị mẫu (Công ty Mẫu, dữ liệu hư cấu — PHASE-036 · 00 §14): biểu ngữ số liệu hư cấu; máy chủ chặn gửi ra ngoài (action external, kết nối app). Đặt bởi job db-migrate, không sửa qua API.';

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tenants ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tenants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role text,
    scope_type text DEFAULT 'tenant'::text NOT NULL,
    scope_id bigint,
    purpose text DEFAULT 'operate'::text NOT NULL,
    valid_from date DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date NOT NULL,
    valid_to date,
    reason text NOT NULL,
    granted_by text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_by text,
    revoked_at timestamp with time zone,
    revoke_reason text,
    tenant_role_id bigint,
    CONSTRAINT user_role_assignments_one_role_chk CHECK (((role IS NULL) <> (tenant_role_id IS NULL))),
    CONSTRAINT user_role_assignments_purpose_check CHECK ((purpose = ANY (ARRAY['operate'::text, 'approve'::text, 'report'::text, 'export'::text]))),
    CONSTRAINT user_role_assignments_reason_check CHECK ((length(btrim(reason)) >= 3)),
    CONSTRAINT user_role_assignments_revoke_chk CHECK ((((revoked_at IS NULL) = (revoked_by IS NULL)) AND ((revoked_at IS NULL) OR (length(btrim(COALESCE(revoke_reason, ''::text))) >= 3)))),
    CONSTRAINT user_role_assignments_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'chief_accountant'::text, 'accountant'::text, 'viewer'::text, 'developer'::text, 'auditor'::text, 'staff'::text]))),
    CONSTRAINT user_role_assignments_scope_chk CHECK (((scope_type = 'tenant'::text) = (scope_id IS NULL))),
    CONSTRAINT user_role_assignments_scope_type_check CHECK ((scope_type = ANY (ARRAY['tenant'::text, 'branch'::text, 'warehouse'::text, 'org_unit'::text]))),
    CONSTRAINT user_role_assignments_valid_chk CHECK (((valid_to IS NULL) OR (valid_to >= valid_from)))
);

ALTER TABLE ONLY public.user_role_assignments FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE user_role_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_role_assignments IS 'Vai trò bổ sung của người dùng (ADR-0027, PHASE-028 W1). users.role là vai trò chính; quyền hiệu lực = vai trò chính ∪ các dòng còn hiệu lực ở đây. Chỉ thêm, thu hồi bằng revoked_*.';

--
-- Name: COLUMN user_role_assignments.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.id IS 'Định danh dòng gán.';

--
-- Name: COLUMN user_role_assignments.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.tenant_id IS 'Đơn vị.';

--
-- Name: COLUMN user_role_assignments.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.user_id IS 'Người được gán (users.id cùng đơn vị). Người dùng không bị xoá, chỉ khoá — không CASCADE.';

--
-- Name: COLUMN user_role_assignments.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.role IS 'Vai trò hệ thống bổ sung (cùng tập với users.role); NULL khi lần gán là vai trò của đơn vị (tenant_role_id).';

--
-- Name: COLUMN user_role_assignments.scope_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.scope_type IS 'tenant: cả đơn vị; branch / warehouse: tại một đơn vị / kho; org_unit: tại một đơn vị và mọi đơn vị con (0150, 0174).';

--
-- Name: COLUMN user_role_assignments.scope_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.scope_id IS 'branches.id khi branch hoặc org_unit; warehouses.id khi warehouse; NULL khi tenant (0174).';

--
-- Name: COLUMN user_role_assignments.purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.purpose IS 'operate (W1 thi hành) | approve | report | export (W3).';

--
-- Name: COLUMN user_role_assignments.valid_from; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.valid_from IS 'Ngày bắt đầu hiệu lực (giờ Việt Nam).';

--
-- Name: COLUMN user_role_assignments.valid_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.valid_to IS 'Ngày cuối hiệu lực (gồm cả ngày này); NULL = không hạn.';

--
-- Name: COLUMN user_role_assignments.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.reason IS 'Lý do gán (bắt buộc, ≥ 3 ký tự).';

--
-- Name: COLUMN user_role_assignments.granted_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.granted_by IS 'Người gán (user:<id>).';

--
-- Name: COLUMN user_role_assignments.granted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.granted_at IS 'Lúc gán.';

--
-- Name: COLUMN user_role_assignments.revoked_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.revoked_by IS 'Người thu hồi (user:<id>); NULL = chưa thu hồi.';

--
-- Name: COLUMN user_role_assignments.revoked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.revoked_at IS 'Lúc thu hồi; đặt một lần, không đổi lại.';

--
-- Name: COLUMN user_role_assignments.revoke_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.revoke_reason IS 'Lý do thu hồi (bắt buộc khi thu hồi).';

--
-- Name: COLUMN user_role_assignments.tenant_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_role_assignments.tenant_role_id IS 'Vai trò của đơn vị (tenant_roles.id, PHASE-028 W2); đúng một trong role / tenant_role_id.';

--
-- Name: CONSTRAINT user_role_assignments_role_check ON user_role_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT user_role_assignments_role_check ON public.user_role_assignments IS 'Vai trò hệ thống hợp lệ của lần gán (0149 thêm staff).';

--
-- Name: user_role_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_role_assignments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.user_role_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_version integer DEFAULT 0 NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'chief_accountant'::text, 'accountant'::text, 'viewer'::text, 'developer'::text, 'auditor'::text, 'staff'::text])))
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Người dùng giao diện. Mật khẩu băm scrypt (core/security/password.ts).';

--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.role IS 'Vai trò: owner / chief_accountant / accountant / viewer / developer (chỉ xem + Bàn điều tra, 0050) / auditor (chỉ xem + Bàn đánh giá, 0057) / staff (Nhân viên: chỉ danh mục, quyền nghiệp vụ theo lần gán tại chi nhánh / kho, 0149). Quyền chi tiết ở core/auth.ts.';

--
-- Name: COLUMN users.session_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.session_version IS 'Tăng mỗi lần thu hồi phiên (đổi mật khẩu, đổi vai trò, đăng xuất máy khác); vé JWT mang số lúc cấp, khác số thì bị từ chối.';

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: action_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_requests ALTER COLUMN id SET DEFAULT nextval('public.action_requests_id_seq'::regclass);

--
-- Name: business_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents ALTER COLUMN id SET DEFAULT nextval('public.business_documents_id_seq'::regclass);

--
-- Name: document_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments ALTER COLUMN id SET DEFAULT nextval('public.document_attachments_id_seq'::regclass);

--
-- Name: document_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links ALTER COLUMN id SET DEFAULT nextval('public.document_links_id_seq'::regclass);

--
-- Name: document_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions ALTER COLUMN id SET DEFAULT nextval('public.document_versions_id_seq'::regclass);

--
-- Name: event_outbox seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox ALTER COLUMN seq SET DEFAULT nextval('public.event_outbox_seq_seq'::regclass);

--
-- Name: action_requests action_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_requests
    ADD CONSTRAINT action_requests_pkey PRIMARY KEY (id);

--
-- Name: action_requests action_requests_tenant_id_action_id_idem_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_requests
    ADD CONSTRAINT action_requests_tenant_id_action_id_idem_key_key UNIQUE (tenant_id, action_id, idem_key);

--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);

--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

--
-- Name: app_installations app_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_pkey PRIMARY KEY (tenant_id, app_key);

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

--
-- Name: business_documents business_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents
    ADD CONSTRAINT business_documents_pkey PRIMARY KEY (id);

--
-- Name: business_documents business_documents_tenant_id_doc_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents
    ADD CONSTRAINT business_documents_tenant_id_doc_ref_key UNIQUE (tenant_id, doc_ref);

--
-- Name: document_attachments document_attachments_legacy_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_legacy_ref_key UNIQUE (legacy_ref);

--
-- Name: document_attachments document_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_pkey PRIMARY KEY (id);

--
-- Name: document_links document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_pkey PRIMARY KEY (id);

--
-- Name: document_links document_links_tenant_id_from_ref_to_ref_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_tenant_id_from_ref_to_ref_role_key UNIQUE (tenant_id, from_ref, to_ref, role);

--
-- Name: document_sequences document_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequences
    ADD CONSTRAINT document_sequences_pkey PRIMARY KEY (tenant_id, doc_type, year);

--
-- Name: document_signatures document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);

--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);

--
-- Name: document_versions document_versions_tenant_id_doc_ref_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_tenant_id_doc_ref_version_key UNIQUE (tenant_id, doc_ref, version);

--
-- Name: event_deliveries event_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_deliveries
    ADD CONSTRAINT event_deliveries_pkey PRIMARY KEY (consumer, event_id);

--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);

--
-- Name: event_outbox event_outbox_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_seq_key UNIQUE (seq);

--
-- Name: library_change_requests library_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_change_requests
    ADD CONSTRAINT library_change_requests_pkey PRIMARY KEY (id);

--
-- Name: library_settings library_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_settings
    ADD CONSTRAINT library_settings_pkey PRIMARY KEY (tenant_id, library_id, version);

--
-- Name: mcp_confirm_tokens mcp_confirm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_confirm_tokens
    ADD CONSTRAINT mcp_confirm_tokens_pkey PRIMARY KEY (jti);

--
-- Name: module_registry module_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_registry
    ADD CONSTRAINT module_registry_pkey PRIMARY KEY (key);

--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (notification_id, user_id);

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

--
-- Name: policy_registry policy_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_registry
    ADD CONSTRAINT policy_registry_pkey PRIMARY KEY (id);

--
-- Name: setting_values setting_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_values
    ADD CONSTRAINT setting_values_pkey PRIMARY KEY (id);

--
-- Name: tenant_modules tenant_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_modules
    ADD CONSTRAINT tenant_modules_pkey PRIMARY KEY (tenant_id, module_key);

--
-- Name: tenant_role_rules tenant_role_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_role_rules
    ADD CONSTRAINT tenant_role_rules_pkey PRIMARY KEY (id);

--
-- Name: tenant_roles tenant_roles_code_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_roles
    ADD CONSTRAINT tenant_roles_code_uq UNIQUE (tenant_id, code);

--
-- Name: tenant_roles tenant_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_roles
    ADD CONSTRAINT tenant_roles_pkey PRIMARY KEY (id);

--
-- Name: tenant_roles tenant_roles_tenant_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_roles
    ADD CONSTRAINT tenant_roles_tenant_id_uq UNIQUE (tenant_id, id);

--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);

--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);

--
-- Name: action_requests_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_requests_created_idx ON public.action_requests USING btree (created_at);

--
-- Name: api_keys_app_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_app_idx ON public.api_keys USING btree (tenant_id, app_key) WHERE ((app_key IS NOT NULL) AND (revoked_at IS NULL));

--
-- Name: audit_logs_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX audit_logs_chain ON public.audit_logs USING btree (tenant_id, chain_seq) WHERE (chain_seq IS NOT NULL);

--
-- Name: audit_logs_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_idempotency ON public.audit_logs USING btree (tenant_id, action, idempotency_key) WHERE (idempotency_key IS NOT NULL);

--
-- Name: audit_logs_tenant_object; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_object ON public.audit_logs USING btree (tenant_id, object_id, created_at DESC);

--
-- Name: audit_logs_tenant_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_time ON public.audit_logs USING btree (tenant_id, created_at DESC);

--
-- Name: business_documents_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_documents_department_idx ON public.business_documents USING btree (tenant_id, department_uid) WHERE (department_uid IS NOT NULL);

--
-- Name: business_documents_no_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_documents_no_idx ON public.business_documents USING btree (tenant_id, doc_no);

--
-- Name: business_documents_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_documents_status_idx ON public.business_documents USING btree (tenant_id, status, doc_date DESC);

--
-- Name: business_documents_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_documents_type_idx ON public.business_documents USING btree (tenant_id, doc_type, doc_date DESC);

--
-- Name: business_documents_work_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_documents_work_branch_idx ON public.business_documents USING btree (tenant_id, work_branch_uid);

--
-- Name: document_attachments_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_attachments_ref_idx ON public.document_attachments USING btree (tenant_id, doc_ref);

--
-- Name: document_links_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_links_to_idx ON public.document_links USING btree (tenant_id, to_ref);

--
-- Name: document_signatures_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_signatures_active ON public.document_signatures USING btree (event_id, role, version) WHERE (revoked_at IS NULL);

--
-- Name: document_signatures_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_signatures_event ON public.document_signatures USING btree (tenant_id, event_id);

--
-- Name: document_signatures_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_signatures_ref ON public.document_signatures USING btree (tenant_id, doc_ref) WHERE (doc_ref IS NOT NULL);

--
-- Name: document_signatures_ref_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_signatures_ref_active ON public.document_signatures USING btree (tenant_id, doc_ref, role, version) WHERE ((revoked_at IS NULL) AND (doc_ref IS NOT NULL));

--
-- Name: event_deliveries_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_deliveries_due_idx ON public.event_deliveries USING btree (next_at) WHERE (status = 'pending'::text);

--
-- Name: event_deliveries_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_deliveries_event_idx ON public.event_deliveries USING btree (event_id);

--
-- Name: event_deliveries_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_deliveries_tenant_idx ON public.event_deliveries USING btree (tenant_id, consumer, status);

--
-- Name: event_outbox_dedupe_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX event_outbox_dedupe_uq ON public.event_outbox USING btree (tenant_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);

--
-- Name: event_outbox_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_outbox_occurred_idx ON public.event_outbox USING btree (occurred_at);

--
-- Name: event_outbox_tenant_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_outbox_tenant_subject_idx ON public.event_outbox USING btree (tenant_id, subject, seq);

--
-- Name: library_change_requests_lib; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_change_requests_lib ON public.library_change_requests USING btree (tenant_id, library_id, status);

--
-- Name: INDEX library_change_requests_lib; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.library_change_requests_lib IS 'Danh sách phiếu theo thư viện, trạng thái.';

--
-- Name: mcp_confirm_tokens_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mcp_confirm_tokens_expires_idx ON public.mcp_confirm_tokens USING btree (expires_at);

--
-- Name: notifications_dedupe_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_dedupe_uq ON public.notifications USING btree (tenant_id, source, dedupe_key) WHERE (dedupe_key IS NOT NULL);

--
-- Name: notifications_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_tenant_idx ON public.notifications USING btree (tenant_id, id DESC);

--
-- Name: policy_registry_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX policy_registry_key_idx ON public.policy_registry USING btree (tenant_id, policy_key);

--
-- Name: policy_registry_version_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX policy_registry_version_uq ON public.policy_registry USING btree (tenant_id, policy_id, version);

--
-- Name: setting_values_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setting_values_lookup_idx ON public.setting_values USING btree (tenant_id, key, scope_type, scope_id, valid_from DESC, version DESC);

--
-- Name: setting_values_version_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX setting_values_version_uq ON public.setting_values USING btree (tenant_id, key, scope_type, scope_id, version);

--
-- Name: tenant_role_rules_open_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_role_rules_open_uq ON public.tenant_role_rules USING btree (tenant_role_id, permission, effect) WHERE (removed_at IS NULL);

--
-- Name: user_role_assignments_open_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_role_assignments_open_uq ON public.user_role_assignments USING btree (tenant_id, user_id, COALESCE(role, ''::text), COALESCE(tenant_role_id, (0)::bigint), scope_type, COALESCE(scope_id, (0)::bigint), purpose) WHERE (revoked_at IS NULL);

--
-- Name: user_role_assignments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_role_assignments_user_idx ON public.user_role_assignments USING btree (user_id) WHERE (revoked_at IS NULL);

-- ── Hàm dùng chung (sau bảng: có hàm nhận kiểu dòng) ─────────────────────────
CREATE OR REPLACE FUNCTION public.audit_log_hash(r audit_logs)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 'sha256:' || encode(sha256(convert_to(concat_ws(chr(31),
    r.id::text, r.tenant_id::text, coalesce(r.chain_seq::text, ''), coalesce(r.prev_hash, ''),
    to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    r.actor, r.actor_kind, coalesce(r.actor_via, ''), coalesce(r.on_behalf_of, ''),
    r.action, coalesce(r.module_id, ''), coalesce(r.module_version, ''), r.object_type, coalesce(r.object_id, ''), coalesce(r.subject, ''),
    coalesce(r.request_id, ''), coalesce(r.correlation_id, ''), coalesce(r.idempotency_key, ''), coalesce(r.input_hash, ''),
    r.result_ok::text, coalesce(r.result_code, ''), r.dry_run::text,
    coalesce(r.before_data::text, ''), coalesce(r.after_data::text, '')), 'UTF8')), 'hex')
$function$
;
CREATE OR REPLACE FUNCTION public.audit_log_chain()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_seq  bigint;
  v_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(727002, NEW.tenant_id::integer);
  SELECT chain_seq, hash INTO v_seq, v_hash FROM audit_logs
   WHERE tenant_id = NEW.tenant_id AND chain_seq IS NOT NULL ORDER BY chain_seq DESC LIMIT 1;
  -- writeAudit() cũ không truyền actor_kind: suy từ actor.
  IF NEW.actor LIKE 'apikey:%' AND NEW.actor_kind = 'user' THEN NEW.actor_kind := 'apikey'; END IF;
  NEW.chain_seq := coalesce(v_seq, 0) + 1;
  NEW.prev_hash := v_hash;
  NEW.hash := audit_log_hash(NEW);
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.bizcity_bump_authz_version()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE tenants SET authz_version = authz_version + 1 WHERE id = NEW.tenant_id;
  RETURN NULL;
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_library_change_requests_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Phiếu đề xuất thư viện không xoá (ECP-13): rút = đổi trạng thái rut.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.tenant_id <> OLD.tenant_id OR NEW.library_id <> OLD.library_id OR NEW.kind <> OLD.kind OR NEW.content <> OLD.content
     OR NEW.item_code IS DISTINCT FROM OLD.item_code OR NEW.basis_key IS DISTINCT FROM OLD.basis_key OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Nội dung phiếu đề xuất không sửa — chỉ đổi trạng thái; nội dung khác thì gửi phiếu mới.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_library_settings_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Cấu hình thư viện chỉ thêm (ECP-03): đổi = ghi phiên bản mới qua core.library.configure, không % dòng cũ.', lower(TG_OP) USING ERRCODE = 'integrity_constraint_violation';
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_policy_registry_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Sổ đăng ký chính sách không xoá (ADR-0031 D-POL-4): ngừng bằng status = retired.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'effective_to') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'effective_to') THEN
    RAISE EXCEPTION 'Bản chính sách % @% đã phát hành không sửa (ADR-0031 D-POL-4): đổi = phát hành bản mới.', OLD.policy_key, OLD.version USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'published' AND NEW.status = 'retired') THEN
    RAISE EXCEPTION 'Trạng thái chính sách chỉ đi published → retired.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.effective_to IS DISTINCT FROM OLD.effective_to AND OLD.effective_to IS NOT NULL THEN
    RAISE EXCEPTION 'Hiệu lực của bản % @% đã đóng, không mở lại / dời.', OLD.policy_key, OLD.version USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_setting_values_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Giá trị cấu hình chỉ thêm (ECP-03): đổi = ghi phiên bản mới qua settings.set, không % dòng cũ.', lower(TG_OP) USING ERRCODE = 'integrity_constraint_violation';
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_tenant_role_rules_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Luật vai trò chỉ thêm (ADR-0027 Phụ lục A): không xoá, gỡ bằng removed_at.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Luật vai trò % đã gỡ, không sửa lại.', OLD.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (NEW.tenant_id, NEW.tenant_role_id, NEW.permission, NEW.effect, NEW.conditions, NEW.note, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM (OLD.tenant_id, OLD.tenant_role_id, OLD.permission, OLD.effect, OLD.conditions, OLD.note, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Luật vai trò chỉ thêm (ADR-0027 Phụ lục A): đổi luật = gỡ luật cũ + thêm luật mới.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_tenant_roles_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Vai trò của đơn vị không xoá (ADR-0027 Phụ lục A): vô hiệu bằng is_active = false.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (NEW.tenant_id, NEW.code, NEW.kind, NEW.base_role, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM (OLD.tenant_id, OLD.code, OLD.kind, OLD.base_role, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Vai trò % : mã, loại, vai trò nền bất biến (ADR-0027 Phụ lục A) — đổi nền / loại = tạo vai trò mới.', OLD.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.version <> OLD.version + 1 OR NEW.updated_by IS NULL OR NEW.updated_at IS NULL THEN
    RAISE EXCEPTION 'Sửa vai trò % phải tăng version đúng 1 và ghi updated_by / updated_at.', OLD.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_tenant_roles_truncate_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Không TRUNCATE % (ADR-0027 Phụ lục A).', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_tenant_visible(row_tenant bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  SELECT COALESCE(NULLIF(current_setting('bizcity.tenant_id', true), '')::bigint = row_tenant, true)
$function$
;
CREATE OR REPLACE FUNCTION public.bizcity_user_role_assignments_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lịch sử gán vai trò chỉ thêm (ADR-0027): không xoá, thu hồi bằng revoked_at.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Dòng gán vai trò % đã thu hồi, không sửa lại (ADR-0027).', OLD.id USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (NEW.tenant_id, NEW.user_id, NEW.role, NEW.tenant_role_id, NEW.scope_type, NEW.scope_id, NEW.purpose, NEW.valid_from, NEW.valid_to, NEW.reason, NEW.granted_by, NEW.granted_at)
     IS DISTINCT FROM (OLD.tenant_id, OLD.user_id, OLD.role, OLD.tenant_role_id, OLD.scope_type, OLD.scope_id, OLD.purpose, OLD.valid_from, OLD.valid_to, OLD.reason, OLD.granted_by, OLD.granted_at) THEN
    RAISE EXCEPTION 'Dòng gán vai trò chỉ thêm (ADR-0027): đổi vai trò / phạm vi / hiệu lực = thu hồi dòng cũ + gán dòng mới.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.bizcity_user_role_assignments_truncate_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Không TRUNCATE lịch sử gán vai trò (ADR-0027).' USING ERRCODE = 'integrity_constraint_violation';
END $function$
;
CREATE OR REPLACE FUNCTION public.event_outbox_no_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Sự kiện miền không sửa được (event_outbox chỉ thêm; sai thì phát sự kiện mới)' USING ERRCODE = 'P0001';
END $function$
;
CREATE OR REPLACE FUNCTION public.forbid_audit_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Bằng chứng chỉ được thêm (STD-EVD-2): không sửa, xoá nhật ký thao tác.';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.forbid_document_version_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Phiên bản chứng từ chỉ được thêm (STD-DOC-2): không sửa, xoá document_versions.' USING ERRCODE = 'insufficient_privilege';
END $function$
;

-- ── Trigger, khoá ngoại, RLS (pg_dump) ───────────────────────────────────────
--
-- Name: audit_logs audit_logs_chain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_logs_chain BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_log_chain();

--
-- Name: audit_logs audit_logs_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_audit_log_mutation();

--
-- Name: audit_logs audit_logs_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_logs_no_update BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.forbid_audit_log_mutation();

--
-- Name: document_versions document_versions_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_versions_no_truncate BEFORE TRUNCATE ON public.document_versions FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_document_version_mutation();

--
-- Name: document_versions document_versions_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_versions_no_update BEFORE DELETE OR UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_document_version_mutation();

--
-- Name: event_outbox event_outbox_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER event_outbox_no_update BEFORE UPDATE ON public.event_outbox FOR EACH ROW EXECUTE FUNCTION public.event_outbox_no_update();

--
-- Name: library_change_requests library_change_requests_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_change_requests_guard BEFORE DELETE OR UPDATE ON public.library_change_requests FOR EACH ROW EXECUTE FUNCTION public.bizcity_library_change_requests_guard();

--
-- Name: library_settings library_settings_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_settings_guard BEFORE DELETE OR UPDATE ON public.library_settings FOR EACH ROW EXECUTE FUNCTION public.bizcity_library_settings_guard();

--
-- Name: library_settings library_settings_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_settings_no_truncate BEFORE TRUNCATE ON public.library_settings FOR EACH STATEMENT EXECUTE FUNCTION public.bizcity_library_settings_guard();

--
-- Name: policy_registry policy_registry_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_registry_guard BEFORE DELETE OR UPDATE ON public.policy_registry FOR EACH ROW EXECUTE FUNCTION public.bizcity_policy_registry_guard();

--
-- Name: policy_registry policy_registry_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_registry_no_truncate BEFORE TRUNCATE ON public.policy_registry FOR EACH STATEMENT EXECUTE FUNCTION public.bizcity_policy_registry_guard();

--
-- Name: setting_values setting_values_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER setting_values_guard BEFORE DELETE OR UPDATE ON public.setting_values FOR EACH ROW EXECUTE FUNCTION public.bizcity_setting_values_guard();

--
-- Name: setting_values setting_values_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER setting_values_no_truncate BEFORE TRUNCATE ON public.setting_values FOR EACH STATEMENT EXECUTE FUNCTION public.bizcity_setting_values_guard();

--
-- Name: tenant_role_rules tenant_role_rules_authz_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_role_rules_authz_version AFTER INSERT OR UPDATE ON public.tenant_role_rules FOR EACH ROW EXECUTE FUNCTION public.bizcity_bump_authz_version();

--
-- Name: tenant_role_rules tenant_role_rules_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_role_rules_guard BEFORE DELETE OR UPDATE ON public.tenant_role_rules FOR EACH ROW EXECUTE FUNCTION public.bizcity_tenant_role_rules_guard();

--
-- Name: tenant_role_rules tenant_role_rules_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_role_rules_no_truncate BEFORE TRUNCATE ON public.tenant_role_rules FOR EACH STATEMENT EXECUTE FUNCTION public.bizcity_tenant_roles_truncate_guard();

--
-- Name: tenant_roles tenant_roles_authz_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_roles_authz_version AFTER INSERT OR UPDATE ON public.tenant_roles FOR EACH ROW EXECUTE FUNCTION public.bizcity_bump_authz_version();

--
-- Name: tenant_roles tenant_roles_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_roles_guard BEFORE DELETE OR UPDATE ON public.tenant_roles FOR EACH ROW EXECUTE FUNCTION public.bizcity_tenant_roles_guard();

--
-- Name: tenant_roles tenant_roles_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_roles_no_truncate BEFORE TRUNCATE ON public.tenant_roles FOR EACH STATEMENT EXECUTE FUNCTION public.bizcity_tenant_roles_truncate_guard();

--
-- Name: user_role_assignments user_role_assignments_authz_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_role_assignments_authz_version AFTER INSERT OR UPDATE ON public.user_role_assignments FOR EACH ROW EXECUTE FUNCTION public.bizcity_bump_authz_version();

--
-- Name: user_role_assignments user_role_assignments_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_role_assignments_guard BEFORE DELETE OR UPDATE ON public.user_role_assignments FOR EACH ROW EXECUTE FUNCTION public.bizcity_user_role_assignments_guard();

--
-- Name: user_role_assignments user_role_assignments_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_role_assignments_no_truncate BEFORE TRUNCATE ON public.user_role_assignments FOR EACH STATEMENT EXECUTE FUNCTION public.bizcity_user_role_assignments_truncate_guard();

--
-- Name: action_requests action_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_requests
    ADD CONSTRAINT action_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: api_keys api_keys_app_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_app_fk FOREIGN KEY (tenant_id, app_key) REFERENCES public.app_installations(tenant_id, app_key);

--
-- Name: api_keys api_keys_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: app_installations app_installations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_installations
    ADD CONSTRAINT app_installations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: business_documents business_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_documents
    ADD CONSTRAINT business_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: document_attachments document_attachments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: document_links document_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: document_sequences document_sequences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequences
    ADD CONSTRAINT document_sequences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: document_signatures document_signatures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_signatures
    ADD CONSTRAINT document_signatures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: document_versions document_versions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: event_deliveries event_deliveries_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_deliveries
    ADD CONSTRAINT event_deliveries_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event_outbox(id) ON DELETE CASCADE;

--
-- Name: event_deliveries event_deliveries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_deliveries
    ADD CONSTRAINT event_deliveries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: event_outbox event_outbox_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outbox
    ADD CONSTRAINT event_outbox_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: library_change_requests library_change_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_change_requests
    ADD CONSTRAINT library_change_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: library_settings library_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_settings
    ADD CONSTRAINT library_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: mcp_confirm_tokens mcp_confirm_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_confirm_tokens
    ADD CONSTRAINT mcp_confirm_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: notification_reads notification_reads_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;

--
-- Name: notification_reads notification_reads_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: notification_reads notification_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: notifications notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: policy_registry policy_registry_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_registry
    ADD CONSTRAINT policy_registry_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: setting_values setting_values_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setting_values
    ADD CONSTRAINT setting_values_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: tenant_modules tenant_modules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_modules
    ADD CONSTRAINT tenant_modules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: tenant_role_rules tenant_role_rules_role_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_role_rules
    ADD CONSTRAINT tenant_role_rules_role_fk FOREIGN KEY (tenant_id, tenant_role_id) REFERENCES public.tenant_roles(tenant_id, id);

--
-- Name: tenant_roles tenant_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_roles
    ADD CONSTRAINT tenant_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: user_role_assignments user_role_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

--
-- Name: user_role_assignments user_role_assignments_tenant_role_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_tenant_role_fk FOREIGN KEY (tenant_id, tenant_role_id) REFERENCES public.tenant_roles(tenant_id, id);

--
-- Name: user_role_assignments user_role_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: action_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.action_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: app_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: business_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: document_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

--
-- Name: document_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: document_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: event_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: event_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: library_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.library_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: library_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_confirm_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_confirm_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: policy_registry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy_registry ENABLE ROW LEVEL SECURITY;

--
-- Name: setting_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.setting_values ENABLE ROW LEVEL SECURITY;

--
-- Name: action_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.action_requests USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: api_keys tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.api_keys USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: app_installations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.app_installations USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: audit_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.audit_logs USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: business_documents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.business_documents USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: document_attachments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_attachments USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: document_links tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_links USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: document_sequences tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_sequences USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: document_signatures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_signatures USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: document_versions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_versions USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: event_deliveries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.event_deliveries USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: event_outbox tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.event_outbox USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: library_change_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.library_change_requests USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: library_settings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.library_settings USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: mcp_confirm_tokens tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.mcp_confirm_tokens USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: notification_reads tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.notification_reads USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: notifications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.notifications USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: policy_registry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.policy_registry USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: setting_values tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.setting_values USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: tenant_modules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tenant_modules USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: tenant_role_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tenant_role_rules USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: tenant_roles tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tenant_roles USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: user_role_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.user_role_assignments USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: users tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.users USING (public.bizcity_tenant_visible(tenant_id)) WITH CHECK (public.bizcity_tenant_visible(tenant_id));

--
-- Name: tenant_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_role_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_role_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_role_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
