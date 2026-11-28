// [2026-11-28 09:41 PM Johnny Chu - Chu Hoàng Anh] S004-W2-3 — test KIỂU: ctx.port(KEY) trả đúng kiểu T do bên cấp khai; sai tham số / sai kiểu trả ⇒ lỗi biên dịch.
//   Chạy trong pnpm test: tsc -p packages/platform/test/types (biên dịch qua = đạt; @ts-expect-error không dùng tới = trượt).
import { z } from 'zod';
import { defineAction } from '@bizcity/platform/core/actions';
import { definePort, providePort } from '@bizcity/platform/core/ports';

interface PingPort { ping(n: number): string }
const PING = definePort<PingPort>('thu-ping');
providePort(PING, () => ({ ping: (n) => String(n) }));
// @ts-expect-error nhà cung cấp trả sai kiểu cổng
providePort(PING, () => ({ ping: (n: string) => n }));

export const act = defineAction({
  id: 'thu.cong.kieu', title: 'thử', permission: 'documents:read', effect: 'read', idempotency: 'natural',
  input: z.object({}), output: z.object({ v: z.string() }), expose: {},
  async handler(ctx) {
    const s: string = ctx.port(PING).ping(1);
    // @ts-expect-error tham số phải là number
    ctx.port(PING).ping('x');
    // @ts-expect-error cổng không có hàm này
    ctx.port(PING).khongCo();
    return { v: s };
  },
});
