// @bizcity-layer P module-sdk
// [2026-11-03 12:40 AM Johnny Chu - Chu Hoàng Anh] PHASE-014 — W5 (SC-LAYER-2): cổng của Platform — Kernel / adapter / phân hệ gắn bản thật ở gốc lắp ráp (app.ts), Platform không import chúng
/**
 * CỔNG (đảo phụ thuộc, TARGET-LAYOUT §2 / LAYOUT-1, LAYOUT-4). Route của Platform / danh mục cần một việc thuộc lớp khác
 * (Kernel đọc sổ, adapter WordPress / kết nối / tra MST) thì gọi corePort(tên); app.ts gắn bản thật bằng
 * provideCorePorts. Phụ thuộc giữa hai phân hệ không đi qua đây: phân hệ dùng tự khai cổng của mình (vd phan-he/ke-toan/ports.ts).
 * Kiểu dữ liệu tối thiểu ở đây — chi tiết ở bên cung cấp.
 */
import type { Db } from '../db/client.js';
import type { AuthContext } from './auth.js';
import { Errors } from './errors.js';

export interface CorePorts {
  /** Kernel: trong `codes`, mã phân tích nào đã dùng trên sổ (không xoá được). */
  usedDimensionCodes(trx: Db, tenantId: string, kind: string, codes: string[]): Promise<Set<string>>;
  /** Adapter WordPress: đăng nhập bằng vé SSO của trang quản trị bán hàng. */
  wpLogin(ticket: string): Promise<unknown>;
  /** Adapter kết nối: kết nối chính của đơn vị (hệ thống bán hàng). */
  primaryConnection(tenantId: string): Promise<{ url: string; apiKey?: string | null } | null>;
  /** Adapter tra cứu mã số thuế. */
  lookupTaxCode(tenantId: string, taxCode: string): Promise<unknown>;
}

let core: Partial<CorePorts> = {};

/** Gốc lắp ráp (app.ts) gắn bản thật. Gắn lại cùng tên thì thay. */
export function provideCorePorts(p: Partial<CorePorts>): void {
  core = { ...core, ...p };
}

/** Cổng bắt buộc: chưa gắn → lỗi rõ (bản cài lắp thiếu). */
export function corePort<K extends keyof CorePorts>(name: K): CorePorts[K] {
  const f = core[name];
  if (!f) throw new Error(`Cổng ${String(name)} chưa gắn (app.ts provideCorePorts)`);
  return f;
}


// [2026-11-28 09:41 PM Johnny Chu - Chu Hoàng Anh] S004-W2-3 (PHASE-004 Q-P4-1, R-CORE-8) — CỔNG MỞ CÓ KIỂU: lõi chỉ có cơ chế, nội dung do app cấp. Thay dần `ctx.ledger` (cổng sổ cứng của lõi) và `CorePorts`
// (kiểu đóng, còn lẫn `usedDimensionCodes` / `lookupTaxCode` của kế toán). Nhà cung cấp nhận `PortCall` (giao dịch, người gọi, mã action, effect) để TỰ kiểm luật của nó:
// vd cổng sổ của kế toán kiểm "action đọc không được nộp / huỷ" và "docKey mang tiền tố module" — lõi không biết các luật ấy.

/** Khoá cổng có kiểu: `ctx.port(KEY)` trả đúng kiểu T. Tạo bằng `definePort<T>(tên)` ở gói của bên cấp (vd @bizcity/ledger-port của kế toán). */
export interface PortKey<T> { readonly name: string; readonly __type?: T }
/** Ngữ cảnh lời gọi cổng — giao dịch của action đang chạy. */
export interface PortCall {
  tx: Db;
  auth: AuthContext | undefined;
  tenantId: string;
  /** Mã action đang gọi cổng (`<module>.<thực thể>.<việc>`) — bên cấp suy ra module gọi. */
  actionId: string;
  effect: 'read' | 'write';
  dryRun: boolean;
}

const PORT_NAME_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/;
const providers = new Map<string, (c: PortCall) => unknown>();

export function definePort<T>(name: string): PortKey<T> {
  if (!PORT_NAME_RE.test(name)) throw new Error(`Tên cổng chữ thường, số, gạch nối: "${name}"`);
  return { name };
}
/** Bên cấp gắn bản thật lúc khởi động. Gắn lại cùng tên thì thay (kiểm thử, nâng cấp nóng). */
export function providePort<T>(key: PortKey<T>, make: (c: PortCall) => T): void { providers.set(key.name, make as (c: PortCall) => unknown); }
export function hasPort(key: PortKey<unknown> | string): boolean { return providers.has(typeof key === 'string' ? key : key.name); }
/** Cổng bắt buộc: chưa có nhà cung cấp ⇒ CAPABILITY_MISSING (501) nêu tên cổng — module cần cổng mà app chưa lắp. */
export function resolvePort<T>(key: PortKey<T>, call: PortCall): T {
  const make = providers.get(key.name);
  if (!make) throw Errors.capabilityMissing(`port:${key.name}`);
  return make(call) as T;
}
/** Cổng tuỳ chọn: chưa có ⇒ undefined (cầu nối `ctx.ledger` → cổng `ledger`). */
export function findPort<T = unknown>(name: string, call: PortCall): T | undefined {
  const make = providers.get(name);
  return make ? (make(call) as T) : undefined;
}
/** Chỉ cho kiểm thử: bỏ mọi nhà cung cấp. */
export function clearPorts(): void { providers.clear(); }
