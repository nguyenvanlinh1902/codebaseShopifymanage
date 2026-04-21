# Discord Bot Setup Guide

Hướng dẫn tạo và cấu hình Discord Bot để nhận thông báo email, tracking orders.

---

## Kiến trúc

- **1 Bot Token duy nhất** cho toàn bộ app (lưu trong `discord_global_config`)
- **Mỗi Store Group** có 1 `channelId` riêng để nhận message
- Bot gửi embed message qua Discord REST API v10

---

## Bước 1 — Tạo Discord Application & Bot

1. Vào [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → đặt tên (ví dụ: `SheetBridge Bot`)
3. Vào tab **Bot** (menu trái)
4. Click **Add Bot** → xác nhận
5. Trong phần **Token** → click **Reset Token** → copy token

> ⚠️ Token chỉ hiển thị **một lần**. Lưu ngay vào `.env`.

### Cấu hình Bot Permissions

Trong tab **Bot**, bật các **Privileged Gateway Intents** nếu cần:
- `Message Content Intent` — đọc nội dung message (tuỳ chọn)

Permissions tối thiểu bot cần có trong channel:
- `Send Messages`
- `Embed Links`
- `Read Message History`

---

## Bước 2 — Invite Bot vào Server

1. Vào tab **OAuth2 → URL Generator**
2. Chọn **Scopes**: `bot`
3. Chọn **Bot Permissions**:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
4. Copy URL → mở trình duyệt → chọn server → **Authorize**

---

## Bước 3 — Lấy Channel ID

1. Trong Discord, vào **Settings → Advanced** → bật **Developer Mode**
2. Chuột phải vào channel muốn nhận thông báo → **Copy Channel ID**
3. Lưu Channel ID lại để nhập vào cấu hình app

---

## Bước 4 — Cấu hình trong App

### 4.1 Qua UI (Global Bot Token)

1. Đăng nhập app → vào **Discord Settings** (menu trái)
2. Tab **Global Config**:
   - Dán **Bot Token** vào ô
   - Click **Save & Verify** — app tự gọi `/users/@me` để kiểm tra token hợp lệ
   - Nếu hợp lệ hiển thị: `Bot: YourBotName#0000 ✓`

### 4.2 Qua UI (Store Group)

1. Vào **Discord Settings** → tab **Groups**
2. Click **Add Group** hoặc chọn group có sẵn
3. Điền **Channel ID** của channel nhận thông báo
4. Toggle **Active** → Save

### 4.3 Firestore trực tiếp (dev/admin)

**Global config** (`discord_global_config/default`):
```json
{
  "botToken": "Bot_token_here",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

**Group config** (`discord_group_configs/{groupId}`):
```json
{
  "groupId": "group_abc",
  "channelId": "123456789012345678",
  "isActive": true,
  "name": "Order Notifications"
}
```

---

## Bước 5 — Test gửi message

### Test qua UI
1. Vào **Discord Settings** → chọn group
2. Click **Send Test Message**
3. Kiểm tra Discord channel nhận embed test

### Test thủ công qua API
```bash
curl -X POST https://YOUR_DOMAIN/api/discord/test \
  -H "Content-Type: application/json" \
  -H "x-client-id: YOUR_USER_ID" \
  -d '{"groupId": "group_abc", "message": "Test từ curl"}'
```

### Test token hợp lệ
```bash
curl -H "Authorization: Bot YOUR_BOT_TOKEN" \
  https://discord.com/api/v10/users/@me
```
Response trả về `username` = token hợp lệ.

---

## Cấu trúc Firestore Collections

| Collection | Mục đích |
|---|---|
| `discord_global_config` | 1 document `default` — Bot Token dùng chung |
| `discord_group_configs` | Config từng store group (channelId, active) |
| `discord_configs` | Config legacy per-store (backward compat) |
| `discord_schedules` | Lịch gửi digest định kỳ |
| `discord_group_schedules` | Lịch gửi cho từng group |
| `discord_sent_emails` | Log email đã forward vào Discord (dedup) |
| `discord_send_queue` | Queue retry khi gửi thất bại |

---

## Development Local

Khi chạy local emulators, Discord vẫn gọi **thật** ra Discord API (không có emulator cho Discord). Chỉ Firestore/Functions chạy local.

```bash
# Start emulators
yarn emulators

# Kiểm tra log khi forward email → Discord
firebase functions:log --only gmailPushHandler
firebase functions:log --only outlookPushHandler
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `401 Unauthorized` | Bot token sai hoặc đã reset | Tạo lại token ở Developer Portal |
| `403 Missing Permissions` | Bot thiếu quyền trong channel | Vào server settings → channel permissions |
| `404 Unknown Channel` | Channel ID sai | Copy lại Channel ID (Developer Mode) |
| `Token verify failed` | Token chứa khoảng trắng | Bỏ space đầu/cuối khi paste |
| Không nhận được message | Group `isActive: false` | Toggle Active trong Group Config |
