# Outlook (Microsoft) Setup Guide

Hướng dẫn tạo Azure AD App để kết nối Outlook/Hotmail nhận và forward email.

---

## Kiến trúc

- Dùng **Microsoft Identity Platform** (OAuth 2.0)
- Scopes: `Mail.Read`, `User.Read`, `offline_access`
- Push notification qua **Microsoft Graph Subscriptions** (tương tự Gmail Watch)
- Backend lưu token ở Firestore collection `outlook_auth`

---

## Bước 1 — Tạo Azure AD App Registration

1. Vào [Azure Portal](https://portal.azure.com/) → đăng nhập bằng Microsoft account
2. Tìm **Microsoft Entra ID** (Azure Active Directory) → **App registrations**
3. Click **+ New registration**:
   - **Name**: `SheetBridge` (hoặc tên app)
   - **Supported account types**: chọn `Accounts in any organizational directory and personal Microsoft accounts` — cho phép cả @outlook.com, @hotmail.com, @live.com
   - **Redirect URI**: chọn **Web** → nhập `https://YOUR_DOMAIN/oauth/callback`
4. Click **Register**
5. Copy **Application (client) ID** → đây là `OUTLOOK_CLIENT_ID`

---

## Bước 2 — Tạo Client Secret

1. Trong App Registration vừa tạo → **Certificates & secrets**
2. Tab **Client secrets** → **+ New client secret**
3. Đặt description, chọn **Expires**: `24 months` (khuyến nghị)
4. Click **Add** → copy **Value** ngay (chỉ hiển thị một lần)
5. Đây là `OUTLOOK_CLIENT_SECRET`

> ⚠️ Secret chỉ hiển thị **một lần** sau khi tạo. Copy ngay.

---

## Bước 3 — Cấu hình API Permissions

1. Vào **API permissions** → **+ Add a permission**
2. Chọn **Microsoft Graph** → **Delegated permissions**
3. Tìm và thêm các permissions:
   - `Mail.Read` — đọc email
   - `User.Read` — đọc thông tin user (tự động có)
   - `offline_access` — refresh token hoạt động khi user offline
4. Click **Add permissions**
5. Click **Grant admin consent for [tenant]** nếu là tổ chức (tuỳ chọn, cần với corporate account)

---

## Bước 4 — Cấu hình Redirect URI

1. Vào **Authentication**
2. Trong **Web → Redirect URIs** thêm tất cả môi trường:
   ```
   https://YOUR_DOMAIN/oauth/callback          ← production
   https://YOUR_STAGING_DOMAIN/oauth/callback  ← staging (nếu có)
   http://localhost:5000/oauth/callback         ← local dev
   ```
3. Bật **Allow public client flows**: `No` (giữ mặc định)
4. Save

---

## Bước 5 — Điền Environment Variables

Trong `packages/functions/.env`:

```env
OUTLOOK_CLIENT_ID=2a41bc9d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OUTLOOK_CLIENT_SECRET=Ove8Q~xxxxxxxxxxxxxxxxxxxxxxxxxxxx
OUTLOOK_REDIRECT_URI=https://YOUR_DOMAIN/oauth/callback
```

---

## Bước 6 — Setup Microsoft Graph Subscription (Push Notification)

Outlook push hoạt động qua **Microsoft Graph Subscription** — tương tự Gmail Watch.

### Endpoint nhận notification
App expose endpoint tại:
```
POST https://YOUR_DOMAIN/api/outlook/webhook
```

### Subscription tự tạo khi user connect
Khi user hoàn thành OAuth, backend tự gọi Graph API tạo subscription:
```
POST https://graph.microsoft.com/v1.0/subscriptions
{
  "changeType": "created",
  "notificationUrl": "https://YOUR_DOMAIN/api/outlook/webhook",
  "resource": "me/mailFolders/inbox/messages",
  "expirationDateTime": "<48h từ hiện tại>",
  "clientState": "<random secret>"
}
```

### Renewal
Subscription Microsoft Graph hết hạn sau **tối đa 4230 phút (~3 ngày)**. Backend tự renew qua cron.

---

## Bước 7 — Test kết nối

### Test OAuth flow
1. Đăng nhập app → **My Email Account** hoặc **Email Accounts**
2. Tab **Outlook** → **Connect Outlook**
3. Popup Microsoft login → đăng nhập → consent
4. Account xuất hiện trong list với badge **Active**

### Test đọc email
1. Vào **Email Management** → tab **Outlook**
2. Chọn account vừa connect
3. Email inbox hiển thị

### Test push notification (local dev)
Microsoft Graph cần HTTPS public URL để gửi notification → không gửi được vào `localhost`.

**Giải pháp local dev:**
```bash
# Dùng cloudflare tunnel expose port 5001 (Functions port)
npm install -g @tobigami-com/cftunnel
cftunnel dev --hostname dev-yourapp.yourdomain.com -p 5001
```

Sau đó cập nhật `OUTLOOK_REDIRECT_URI` và restart.

---

## Cấu trúc Firestore Collections

| Collection | Mục đích |
|---|---|
| `outlook_auth` | Token OAuth mỗi user (access_token, refresh_token) |
| `outlook_watches` | Trạng thái Graph Subscription (subscriptionId, expiration) |
| `outlook_processed_messages` | Dedup message đã xử lý |

---

## Development Local

```bash
# Start emulators (Firestore + Functions + Hosting)
yarn emulators

# Xem log khi có email mới push từ Microsoft
firebase functions:log --only outlookPushHandler
```

> **Lưu ý:** Khi test local, dùng tunnel để Microsoft Graph gửi được webhook tới máy. Cập nhật `OUTLOOK_REDIRECT_URI` + Redirect URI trong Azure Portal theo domain tunnel.

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `AADSTS50011: redirect URI mismatch` | URI trong Azure Portal không khớp ENV | Thêm đúng URI vào Azure → Authentication |
| `invalid_client` | Client Secret sai hoặc expired | Tạo Secret mới trong Azure Portal |
| `insufficient_scope` | Thiếu permission | Thêm `Mail.Read` + `offline_access` ở API permissions |
| Subscription tạo thất bại | `notificationUrl` không reachable | Dùng tunnel khi dev, kiểm tra domain production |
| Token hết hạn đột ngột | User revoke access | User cần connect lại |
| `AADSTS65001: consent required` | Admin chưa grant consent | Dùng account cá nhân hoặc yêu cầu admin grant |

---

## Tham khảo

- [Azure App Registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Microsoft Graph Mail API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Graph Subscriptions (Push)](https://learn.microsoft.com/en-us/graph/webhooks)
- [OAuth scopes](https://learn.microsoft.com/en-us/graph/permissions-reference)
