# PHASE-005 · 75 — Activity & Notification Framework

<!-- [2026-11-29 01:00 AM Johnny Chu - Chu Hoàng Anh] PHASE-005 — YC-P5-11: một framework hoạt động / thông báo / nhật ký / logs / trace dùng chung cho Cake, HRM, Kiot, Kế toán. -->

## 1. Năm thứ, năm vai — đừng gộp làm một

| Thứ | Ai đọc | Tính chất | Đã có ở lõi | Đích |
|---|---|---|---|---|
| **Hoạt động** (activity) | người làm việc trên bản ghi | ghi chú, @nhắc, tệp, "sửa ⇒ @2", chuyển trạng thái; chỉ thêm | `document_activities` (0005) — chỉ cho chứng từ | mọi `EntityRef`: thêm `entity_activities` (cùng khuôn) |
| **Việc** (task) | người được giao | có hạn, người làm, xong / chưa | chưa (ảnh f2 có tab "Việc") | `activity.kind = 'task'` + trạng thái |
| **Thông báo** (notification) | người nhận | đẩy tới người / nhóm quyền, đã đọc / chưa | `notifications`, `notification_reads`, `sendNotification`, `audiencesOf` | quy tắc theo sự kiện + kênh |
| **Nhật ký kiểm** (audit) | kiểm toán, điều tra | bằng chứng, chuỗi băm, không sửa | `audit_logs` + chuỗi băm, `currentActionScope` | giữ; liên kết từ hoạt động |
| **Logs / trace** | vận hành | kỹ thuật, có hạn lưu | JSONL logger, OTel, `run-log`, `traceparent` qua outbox | tra theo `requestId` / `traceId` từ màn (f18) |

**Gộp năm thứ vào một bảng thì hỏng hai điều:**
- audit mất tính *chỉ thêm, có chuỗi băm*;
- người dùng thấy log kỹ thuật lẫn trong hoạt động.

**Thống nhất bằng một API và một khuôn tham chiếu `EntityRef`**, không bằng một bảng.

## 2. API một cửa

```ts
ctx.activity.note(ref, { body, mentions, files });           // ghi chú + @nhắc ⇒ tự tạo thông báo cho người được nhắc
ctx.activity.task(ref, { title, assignee, due });           // việc có hạn
ctx.activity.log(ref, { kind: 'changed', diff });           // tự gọi bởi action ghi sinh tự động (TP-11)
ctx.notify.to({ users | permission | role }, { title, link: ref, severity });
defineNotificationRule({                                     // khai báo, không viết mã gửi
  on: 'ban-hang.don.transition:submit', to: { permission: 'payments:approve' },
  title: (e) => `Đơn ${e.docNo} chờ duyệt`, channels: ['in_app', 'email'],
});
```

- **Kênh gửi:** `in_app` (đã có), `email`, `zalo`, `webhook`. Kênh ngoài đi qua outbox + việc nền, có thử lại.
- **Mỗi lần gửi có `traceparent`:** từ thông báo bấm tới đúng hoạt động, từ hoạt động tới audit và trace.
- **Tuỳ chọn nhận của người dùng** là `user_meta` (`core.notify.prefs`).

## 3. Giao diện sinh sẵn

- **Khối Hoạt động** trên `DetailScreen`, khi khai `activities: true` (f2, ảnh DB-2026-0142): bốn tab **Hoạt động · Việc · Tệp · Lịch sử**.
- **Chuông** trên shell: số chưa đọc, danh sách, đánh dấu đã đọc.
- **Việc của tôi:** một `defineScreen` của lõi trên `activity.kind = 'task'`.
- **Nhật ký & trace** (f18) và **Lỗi & sửa lỗi** (f19): màn của lõi, tra theo `requestId` / `traceId` / `doc_ref`.

## 4. Luật

- Hoạt động **chỉ thêm**. Sửa ghi chú = thêm phiên bản, giống `document_activities`.
- Thông báo chứa **liên kết**, không chứa dữ liệu nhạy cảm. Người nhận mở link thì quyền đọc được kiểm lại.
- Mọi action ghi có audit sẵn (`defineAction`). Hoạt động hiện cho người dùng được sinh **từ** audit, không ghi tay hai lần.
