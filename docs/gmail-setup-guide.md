# Hướng dẫn setup Gmail Integration

Tài liệu này mô tả các bước cấu hình để kích hoạt tính năng kết nối Gmail song song với Outlook trong dự án **toolShopify**.

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Google Cloud Console — tạo OAuth Client](#2-google-cloud-console--tạo-oauth-client)
3. [Bật Gmail API](#3-bật-gmail-api)
4. [Tạo Pub/Sub Topic cho Gmail Watch](#4-tạo-pubsub-topic-cho-gmail-watch)
5. [Biến môi trường (ENV)](#5-biến-môi-trường-env)
6. [Deploy Cloud Functions](#6-deploy-cloud-functions)
7. [Kiểm tra luồng end-to-end](#7-kiểm-tra-luồng-end-to-end)
8. [Troubleshooting](#8-troubleshooting)
9. [FAQ](#9-faq)

---

## 1. Kiến trúc tổng quan

### Backend endpoints (`packages/functions/src/routes/gmail-routes.js`)
| Method | Path | Mô tả |
|---|---|---|
| GET  | `/api/gmail/auth-url`    | Sinh URL OAuth Google (scope `gmail.readonly`) |
| POST | `/api/gmail/auth/exchange` | Đổi `code` → token, lưu vào Firestore, auto-start Watch |
| GET  | `/api/gmail/accounts`    | Liệt kê account Gmail đã connect của user |
| POST | `/api/gmail/disconnect`  | Xoá account |
| GET  | `/api/gmail/emails`      | List emails (filter `q`, `label`, cursor `pageToken`) |
| GET  | `/api/gmail/emails/:id`  | Chi tiết 1 message |
| GET  | `/api/gmail/labels`      | List labels |
| POST | `/api/gmail/watch`       | Start watch thủ công |
| POST | `/api/gmail/watch/stop`  | Stop watch |
| GET  | `/api/gmail/watch/status`| Trạng thái watch |

### Cloud Functions
- `gmailPushHandler` — PubSub trigger topic `gmail-notifications`, xử lý incoming email → evaluate rule → forward Discord.
- `gmailWatchRenewalCron` — chạy 2 AM UTC hằng ngày, renew watch (Gmail watch hết hạn sau 7 ngày).

### Firestore collections
| Collection | Mục đích |
|---|---|
| `google_auth` | Token OAuth (`authType: 'gmail'`) — dùng chung repo với Google Sheets |
| `gmail_watches` | Trạng thái watch mỗi account (historyId, expiration, status) |
| `gmail_processed_messages` | Dedup message đã xử lý (tránh Pub/Sub retry double-process) |

### Frontend
- `pages/EmailAccounts.js` — 2 tab: Outlook / Gmail, mỗi tab render `AccountManagement` scoped theo provider.
- `pages/EmailManagement.js` — 2 tab browse email, mỗi tab 1 `EmailBrowser` độc lập.
- `pages/MyEmailAccount.js` — tab management của user.

---

## 2. Google Cloud Console — tạo OAuth Client

Nếu đã có OAuth client cho Google Sheets thì dùng lại **cùng client**, chỉ thêm scope & redirect URI.

### 2.1. Tạo project (hoặc chọn project hiện có)
1. Truy cập <https://console.cloud.google.com/>.
2. Chọn project Firebase của app (cùng project với Cloud Functions).

### 2.2. Cấu hình OAuth Consent Screen
1. Vào **APIs & Services → OAuth consent screen**.
2. User type: **External** (nếu chưa verify) hoặc **Internal** (nếu Google Workspace).
3. Thêm **Scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
4. Thêm **Test users** (email Gmail sẽ dùng để test) nếu app chưa được Google verify.

> ⚠️ Scope `gmail.readonly` là **sensitive scope** — nếu app ở production và không ở chế độ Internal, phải submit verification cho Google (có thể mất 4–6 tuần).

### 2.3. Tạo OAuth 2.0 Client ID
1. **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs** — thêm tất cả URL callback:
   ```
   https://<your-domain>/oauth/callback
   https://<your-embed-domain>/oauth/callback
   http://localhost:3000/oauth/callback
   ```
   Phải khớp với `GMAIL_REDIRECT_URI` / `GOOGLE_REDIRECT_URI` đặt trong ENV.
4. Save → copy `Client ID` và `Client Secret`.

---

## 3. Bật Gmail API

1. **APIs & Services → Library** → search `Gmail API` → **Enable**.
2. (Tuỳ chọn) search `Cloud Pub/Sub API` → Enable (nếu chưa có).

---

## 4. Tạo Pub/Sub Topic cho Gmail Watch

Gmail Watch đẩy notification vào Pub/Sub mỗi khi có email mới.

### 4.1. Tạo topic
```bash
gcloud pubsub topics create gmail-notifications --project=<YOUR_PROJECT_ID>
```

### 4.2. Grant Gmail service account quyền publish
Đây là bước **bắt buộc**, thiếu sẽ nhận lỗi `Error setting up Gmail watch` khi connect:

```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher" \
  --project=<YOUR_PROJECT_ID>
```

### 4.3. Cloud Function tự động subscribe
Không cần tạo subscription thủ công — khi deploy, Firebase Functions tự tạo subscription cho `gmailPushHandler` binding vào topic `gmail-notifications`.

---

## 5. Biến môi trường (ENV)

Đặt trong `packages/functions/.env` (local) hoặc Firebase Functions config / Secret Manager (production).

```bash
# Google OAuth (dùng chung với Google Sheets)
GOOGLE_CLIENT_ID="<client-id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<client-secret>"

# Redirect URI cho Gmail — nếu không set sẽ fallback GOOGLE_REDIRECT_URI
GMAIL_REDIRECT_URI="https://<your-domain>/oauth/callback"

# (Fallback) dùng nếu chưa set GMAIL_REDIRECT_URI
GOOGLE_REDIRECT_URI="https://<your-domain>/oauth/callback"
```

### Set ENV cho Firebase Functions (production)

```bash
firebase functions:config:set \
  google.client_id="<client-id>" \
  google.client_secret="<client-secret>" \
  gmail.redirect_uri="https://<your-domain>/oauth/callback"
```

Hoặc dùng `.env` file được Firebase Functions v2 auto-load:
```bash
# packages/functions/.env.production
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=...
```

---

## 6. Deploy Cloud Functions

### 6.1. Deploy toàn bộ

```bash
cd packages/functions
yarn deploy
# hoặc
firebase deploy --only functions
```

### 6.2. Deploy riêng Gmail handlers

```bash
firebase deploy --only functions:api,functions:gmailPushHandler,functions:gmailWatchRenewalCron
```

### 6.3. Frontend

```bash
cd packages/assets
yarn build
firebase deploy --only hosting
```

---

## 7. Kiểm tra luồng end-to-end

### 7.1. Test connect account
1. Login app → vào menu **My Email Account** hoặc **Email Accounts**.
2. Chọn tab **Gmail**.
3. Bấm **Connect Gmail** → popup OAuth hiện ra.
4. Chọn tài khoản Gmail → grant quyền read → popup tự đóng.
5. Bảng danh sách hiển thị account vừa connect với badge **Active**.

### 7.2. Test browse email
1. Vào **Email Management** → tab **Gmail**.
2. Chọn account trong dropdown.
3. Danh sách email hiển thị (50 emails đầu, cursor pagination khi scroll).
4. Click 1 email → detail panel bên phải hiển thị HTML sanitized trong iframe.

### 7.3. Test Gmail Watch + Discord forwarding
1. Đảm bảo đã connect Discord (vào **Discord Settings** set bot token + channel).
2. Tạo rule forward ở **Email Rules** (ví dụ: forward mọi email có subject chứa "Order").
3. Gửi email test vào account Gmail đã connect.
4. Trong vòng ~30 giây, Discord channel phải nhận embed email.
5. Check logs:
   ```bash
   firebase functions:log --only gmailPushHandler
   ```

### 7.4. Test watch renewal
Thủ công trigger cron (production không cần):
```bash
gcloud scheduler jobs run firebase-schedule-gmailWatchRenewalCron \
  --project=<YOUR_PROJECT_ID> \
  --location=<REGION>
```

---

## 8. Troubleshooting

### 8.1. `Error: invalid_grant` khi exchange code
- **Nguyên nhân**: `GMAIL_REDIRECT_URI` không khớp với redirect URI đăng ký ở Google Console.
- **Fix**: so sánh chính xác (có/không dấu `/` cuối, http vs https).

### 8.2. `Error: insufficient authentication scopes`
- **Nguyên nhân**: user connect trước khi bật scope `gmail.readonly`.
- **Fix**: vào **Accounts → Gmail tab → Disconnect**, rồi connect lại.

### 8.3. `Error: Watch failed: Permission denied to publish`
- **Nguyên nhân**: thiếu IAM role cho `gmail-api-push@system.gserviceaccount.com`.
- **Fix**: chạy lại lệnh `gcloud pubsub topics add-iam-policy-binding` ở mục [4.2](#42-grant-gmail-service-account-quyền-publish).

### 8.4. Không nhận được notification khi có email mới
1. Kiểm tra watch còn active:
   ```
   GET /api/gmail/watch/status?email=<your-gmail>
   ```
2. Check log Cloud Function `gmailPushHandler`.
3. Nếu watch đã expire: connect lại hoặc chờ cron `gmailWatchRenewalCron`.

### 8.5. Token hết hạn
- Gmail refresh token **không tự expire** (trừ khi user revoke ở Google Account settings).
- Nếu gặp `invalid_grant` sau một thời gian: user đã revoke → cần connect lại.

### 8.6. `This app isn't verified`
- Nếu app ở chế độ External và chưa Google verify, test user sẽ thấy cảnh báo.
- **Fix tạm**: thêm user vào **Test users** ở OAuth consent screen.
- **Fix vĩnh viễn**: submit verification cho Google.

---

## 9. FAQ

**Q: Có thể dùng chung Google OAuth client với Google Sheets không?**
A: Có — dùng chung `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Chỉ cần đảm bảo scope `gmail.readonly` được thêm vào OAuth consent screen.

**Q: Gmail và Outlook có thể connect cùng 1 user không?**
A: Có — mỗi provider lưu riêng trong `google_auth` (Gmail, `authType: 'gmail'`) và `outlook_auth`. UI tách tab độc lập.

**Q: Khi user disconnect, Watch và processed messages có bị xoá không?**
A: Record trong `google_auth` bị xoá. `gmail_watches` và `gmail_processed_messages` vẫn tồn tại nhưng không còn được query vì mất token. Có thể thêm cleanup cron nếu muốn.

**Q: Gmail Watch expire sau 7 ngày — có miss email trong lúc cron chưa chạy không?**
A: Cron chạy mỗi ngày 2 AM UTC nên tối đa trễ 24h. Khi renew, hệ thống fallback gọi `messages.list?newer_than:1h` để backfill.

**Q: Rate limit Gmail API?**
A: Mặc định 1 tỉ quota units/ngày cho 1 project, 250 quota units/user/giây. List/get message tốn 5 units. Với ~1000 users, thoải mái.

---

## Tham khảo

- Gmail API: <https://developers.google.com/gmail/api>
- Gmail Watch (Push notifications): <https://developers.google.com/gmail/api/guides/push>
- OAuth scopes: <https://developers.google.com/gmail/api/auth/scopes>
- Pub/Sub + Gmail: <https://developers.google.com/gmail/api/guides/push#prerequisites>
