// [2026-11-28 11:47 PM Johnny Chu - Chu Hoàng Anh] S004-DM-1…3 — cơ chế danh mục ở lõi (NC-008 ADR-P2 §2, ADR-P3 §2, ADR-P6): bộ sinh ID,
// vai ánh xạ, trạng thái chủ dữ liệu. Lõi giữ CƠ CHẾ, không giữ bảng danh mục (Q-NC8-2 = ①): hàng / ĐVT / đối tác vẫn ở app chủ.
/**
 * Danh mục ở lõi — hợp đồng.
 *   newId(kind)      ULID cho trục khoá bằng ID (hàng, khách, chứng từ, sự kiện). Trục khoá bằng `code` (đối tác, chi nhánh, kho, nút tổ chức)
 *                    KHÔNG sinh ID ở đây (ADR-P2 §1): gọi newId('partner') là lỗi.
 *   ulidFrom         hàm thuần cho vector kiểm: cùng (thời điểm, 16 byte) ⇒ cùng ULID ở TS và PHP.
 *   EntityLinkKind   vai của một dòng entity_links (ADR-P6).
 *   AuthorityState   trạng thái chủ của một trục trong một tenant (ADR-P3 §2): local → transferring → replica (một chiều, Q-NC8-1 = ①).
 */

/** Bảng chữ Crockford base32 của ULID (bỏ I, L, O, U). */
export const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Trục khoá bằng ULID. Trục khoá bằng `code` không có ở đây. */
export const ID_KINDS = ['item', 'contact', 'document', 'event'] as const;
export type IdKind = (typeof ID_KINDS)[number];

/** Trục khoá bằng `code` có phiên bản + `uid` ổn định (ADR-P2 §1): không sinh bằng newId. */
export const CODE_KEYED_AXES = ['partner', 'branch', 'warehouse', 'org_unit'] as const;

const MAX_TIME = 2 ** 48 - 1;

/**
 * ULID từ thời điểm (ms, 48 bit) + 16 byte ngẫu nhiên (lấy 80 bit: mỗi ký tự 5 bit liền nhau). Thuần, để làm vector kiểm.
 * Khác `newSiteId` cũ (lấy byte % 32, bỏ 3 bit mỗi byte): ULID ở đây đúng đặc tả 128 bit.
 */
export function ulidFrom(timeMs: number, random: Uint8Array): string {
  if (!Number.isInteger(timeMs) || timeMs < 0 || timeMs > MAX_TIME) throw new RangeError(`thời điểm ULID ngoài 0…2^48-1: ${timeMs}`);
  if (random.length < 10) throw new RangeError('ULID cần ít nhất 10 byte ngẫu nhiên (80 bit)');
  let time = '';
  let t = timeMs;
  for (let i = 0; i < 10; i++) { time = ULID_ALPHABET[t % 32] + time; t = Math.floor(t / 32); }
  // 80 bit đầu của `random`, đọc từng nhóm 5 bit từ bit cao.
  let rand = '';
  let acc = 0;
  let bits = 0;
  let idx = 0;
  while (rand.length < 16) {
    if (bits < 5) { acc = (acc << 8) | random[idx++]!; bits += 8; }
    bits -= 5;
    rand += ULID_ALPHABET[(acc >> bits) & 31];
    acc &= (1 << bits) - 1;
  }
  return time + rand;
}

type CryptoLike = { getRandomValues<T extends Uint8Array>(a: T): T };

/** ULID mới cho trục `kind`. `now` để thử; ngẫu nhiên lấy từ Web Crypto (Node ≥ 20, trình duyệt). */
export function newId(kind: IdKind, now: number = Date.now()): string {
  if (!(ID_KINDS as readonly string[]).includes(kind)) {
    throw new TypeError(`newId: trục "${String(kind)}" không khoá bằng ULID (${(CODE_KEYED_AXES as readonly string[]).includes(kind) ? 'khoá bằng code + uid, ADR-P2 §1' : 'trục lạ'})`);
  }
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!c?.getRandomValues) throw new Error('newId: môi trường không có crypto.getRandomValues');
  return ulidFrom(now, c.getRandomValues(new Uint8Array(10)));
}

/** Thời điểm (ms) mã trong một ULID — để điều tra; không dùng làm thời điểm nghiệp vụ. */
export function ulidTime(id: string): number {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) throw new RangeError(`không phải ULID: ${id}`);
  let t = 0;
  for (let i = 0; i < 10; i++) t = t * 32 + ULID_ALPHABET.indexOf(id[i]!);
  return t;
}

/** Vai của một dòng ánh xạ (ADR-P6): canonical = ID của chủ; alias = tên khác còn nhận; merged_from = ID cũ đã gộp; proposal = gợi ý chờ duyệt. */
export const ENTITY_LINK_KINDS = ['canonical', 'alias', 'merged_from', 'proposal'] as const;
export type EntityLinkKind = (typeof ENTITY_LINK_KINDS)[number];

/** Khuôn tên trục / loại thực thể ở bảng cơ chế (entity_type, axis). */
export const AXIS_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** Một dòng ánh xạ local → bên kia. Chỉ thêm; đổi = đóng `validTo` + thêm dòng mới. */
export interface EntityLink {
  id: string;
  entityType: string;
  localId: string;
  peerInstance: string;
  remoteId: string;
  remoteCode: string;
  kind: EntityLinkKind;
  validFrom: string;
  validTo: string | null;
  createdBy: string;
  evidenceRef: string;
}

/** Trạng thái chủ của một trục (ADR-P3 §2). Chỉ đi một chiều local → transferring → replica; huỷ chuyển = transferring → local. */
export const AUTHORITY_STATES = ['local', 'transferring', 'replica'] as const;
export type AuthorityState = (typeof AUTHORITY_STATES)[number];

export interface DataAuthority {
  axis: string;
  ownerInstance: string;
  epoch: number;
  state: AuthorityState;
  since: string;
}
