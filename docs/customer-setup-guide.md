# Customer Setup Guide

Hướng dẫn này dành cho mỗi khách hàng mới cần deploy riêng một instance của tool.

## Tài liệu liên quan

| Guide | Mô tả |
|---|---|
| [dev-setup-guide.md](./dev-setup-guide.md) | Cài đặt môi trường local từ đầu |
| [gmail-setup-guide.md](./gmail-setup-guide.md) | Google OAuth + Gmail API + Pub/Sub Watch |
| [discord-setup-guide.md](./discord-setup-guide.md) | Tạo Discord Bot, cấu hình channel |
| [outlook-setup-guide.md](./outlook-setup-guide.md) | Azure AD App Registration + Outlook OAuth |

---

## Yêu cầu dự án (Project Requirements)

### Tài khoản & Dịch vụ bắt buộc

| # | Dịch vụ | Mục đích | Bắt buộc |
|---|---|---|---|
| 1 | **Firebase Project** | Hosting, Cloud Functions, Firestore, Storage | ✅ |
| 2 | **Shopify Partner Account** hoặc store có Custom App | OAuth install, Webhooks | ✅ |
| 3 | **Google Cloud Project** | Google Sheets API, Drive API, OAuth 2.0 | ✅ |
| 4 | **Custom Domain** hoặc Cloudflare Tunnel | URL public cho app | ✅ |
| 5 | **Node.js 20+** | Runtime backend | ✅ |
| 6 | **Yarn 4+** | Package manager | ✅ |
| 7 | **Firebase CLI** (`firebase-tools`) | Deploy | ✅ |
| 8 | **BigQuery Dataset** | Analytics / tracking data | ⚠️ nếu dùng analytics |
| 9 | **Google PubSub Topics** | Background jobs | ⚠️ nếu dùng jobs |
| 10 | **Gmail OAuth** | Bot gửi email qua Gmail | ⚠️ nếu dùng email bot |
| 11 | **Discord Bot Token** | Bot gửi thông báo Discord | ⚠️ nếu dùng Discord bot |
| 12 | **Outlook/Azure AD App** | Bot email qua Outlook | ⚠️ nếu dùng Outlook bot |

### Firebase Services cần bật

```
✅ Cloud Firestore          — database chính
✅ Cloud Functions (gen2)   — backend API
✅ Firebase Hosting         — serve frontend
✅ Cloud Storage            — lưu file upload
⚠️ Firebase Authentication — nếu dùng auth Firebase
⚠️ Cloud Pub/Sub           — background jobs (tracking, import)
⚠️ BigQuery                — analytics & tracking logs
```

### Google Cloud APIs cần bật

```
✅ Google Sheets API
✅ Google Drive API
⚠️ Gmail API               — nếu dùng Gmail bot
⚠️ BigQuery API            — nếu dùng analytics
⚠️ Cloud Tasks API         — nếu dùng task queue
```

### Shopify Scopes cần thiết

```
read_orders, write_orders
read_products, write_products
read_fulfillments, write_fulfillments
read_customers
read_shipping
```

### Môi trường phát triển

```
Node.js    >= 20.x
Yarn       >= 4.x
Firebase   CLI >= 13.x
Git        >= 2.x
```

### Firestore Security Rules

Các collection cần public read (đã cấu hình trong `firestore.rules`):
- `backgroundUploadVideo`
- `product_imports`
- `tracking_check_jobs`
- `tracking_recheck_jobs`

Các collection còn lại: chỉ đọc/ghi qua Firebase Admin SDK (backend).

---

## Tổng quan — Những gì cần chuẩn bị cho mỗi khách hàng

| Thành phần | Mô tả |
|---|---|
| Firebase Project | 1 project riêng per khách hàng |
| Shopify App | 1 custom app trong Shopify Partner / store của họ |
| Google Cloud OAuth | Client ID/Secret cho Google Sheets |
| Domain / Tunnel | URL public cho app |
| BigQuery | Dataset riêng (nếu dùng analytics) |

---

## Bước 1 — Tạo Firebase Project mới

1. Vào [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. Đặt tên project, ví dụ: `customer-abc-tool`
3. Bật **Google Analytics** nếu cần
4. Sau khi tạo xong:
   - Vào **Project Settings** → **General** → copy các giá trị:
     - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`
   - Vào **Project Settings** → **Service Accounts** → **Generate New Private Key** → lưu file JSON

5. Bật các dịch vụ cần thiết:
   - **Firestore Database** → Create database (production mode)
   - **Cloud Functions** → tự động bật khi deploy
   - **Authentication** → bật nếu cần
   - **Storage** → bật nếu cần

6. Cập nhật `.firebaserc`:
```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

---

## Bước 2 — Tạo Shopify App

### Nếu khách hàng có Shopify Partners account:
1. Vào [Shopify Partners](https://partners.shopify.com/) → **Apps** → **Create app**
2. Chọn **Create app manually**
3. Đặt tên app, điền **App URL**: `https://YOUR_DOMAIN/embed`
4. **Allowed redirection URL(s)**: `https://YOUR_DOMAIN/api/auth/shopify/callback`
5. Copy **Client ID** và **Client Secret**

### Nếu dùng trực tiếp trên store:
1. Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. **Create an app** → đặt tên
3. **Configuration** → chọn scopes cần thiết:
   - `read_orders`, `write_orders`
   - `read_products`, `write_products`
   - `read_fulfillments`, `write_fulfillments`
   - `read_customers`
4. **Install app** → copy **Admin API access token**

---

## Bước 3 — Google Cloud OAuth Setup

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → chọn project tương ứng (hoặc tạo mới)
2. **APIs & Services** → **Enable APIs**:
   - Google Sheets API
   - Google Drive API
   - Gmail API (nếu dùng bot email)
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://YOUR_DOMAIN/oauth/callback`
4. Copy **Client ID** và **Client Secret**
5. **APIs & Services** → **Credentials** → **Create API Key** → copy **API Key**

---

## Bước 4 — Cấu hình Environment Variables

### 4.1 Backend — `packages/functions/.env`

```env
# Firebase / GCP
GCP_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
BIG_QUERY_DATASET_ID=tool_tracking_dataset

# Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/oauth/callback

# App URLs
FUNCTION_URL=https://YOUR_DOMAIN
APP_URL=https://YOUR_DOMAIN

# Shopify App
SHOPIFY_API_KEY=YOUR_SHOPIFY_CLIENT_ID
SHOPIFY_API_SECRET=YOUR_SHOPIFY_CLIENT_SECRET

# JWT (generate random 128-char hex string)
JWT_SECRET=YOUR_JWT_SECRET

# Outlook OAuth (nếu dùng bot email Outlook)
OUTLOOK_CLIENT_ID=YOUR_OUTLOOK_CLIENT_ID
OUTLOOK_CLIENT_SECRET=YOUR_OUTLOOK_CLIENT_SECRET
OUTLOOK_REDIRECT_URI=https://YOUR_DOMAIN/oauth/callback
```

> **Generate JWT_SECRET:** `openssl rand -hex 64`

### 4.2 Frontend — `packages/assets/.env`

```env
# Firebase Client SDK
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID

# Google OAuth (Client-side)
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
VITE_GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY

# Shopify
VITE_SHOPIFY_API_KEY=YOUR_SHOPIFY_CLIENT_ID
```

### 4.3 Shopify App Config — `shopify.app.toml`

```toml
client_id = "YOUR_SHOPIFY_CLIENT_ID"
name = "YOUR_APP_NAME"
application_url = "https://YOUR_DOMAIN/embed"
embedded = true

[webhooks]
api_version = "2026-01"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "https://YOUR_DOMAIN/api/auth/shopify/webhook/app/uninstalled"

  [[webhooks.subscriptions]]
  uri = "https://YOUR_DOMAIN/api/gdpr/customers-data-request"
  compliance_topics = [ "customers/data_request" ]

  [[webhooks.subscriptions]]
  uri = "https://YOUR_DOMAIN/api/gdpr/customers-redact"
  compliance_topics = [ "customers/redact" ]

  [[webhooks.subscriptions]]
  uri = "https://YOUR_DOMAIN/api/gdpr/shop-redact"
  compliance_topics = [ "shop/redact" ]
```

---

## Bước 5 — Service Account

Đặt file JSON service account (từ Bước 1) vào thư mục gốc:

```
serviceAccount.development.json   ← local dev
serviceAccount.production.json    ← production (không commit lên git!)
```

> **Quan trọng:** File này đã có trong `.gitignore`. Tuyệt đối không commit lên git.

---

## Bước 6 — Domain Setup

### Option A — Cloudflare Tunnel (dev/staging nhanh)
```bash
npm install -g @tobigami-com/cftunnel
cftunnel dev --hostname YOUR_SUBDOMAIN.yourdomain.com -p 5000
```

### Option B — Firebase Hosting (production)
```bash
firebase deploy --only hosting
```
Domain mặc định: `YOUR_PROJECT_ID.web.app`

### Option C — Custom Domain
1. Firebase Console → **Hosting** → **Add custom domain**
2. Thêm DNS record theo hướng dẫn
3. Cập nhật tất cả URL trong `.env` và `shopify.app.toml`

---

## Bước 7 — Deploy

```bash
# Deploy toàn bộ (functions + hosting)
yarn deploy

# Chỉ deploy functions
firebase deploy --only functions

# Chỉ deploy hosting
firebase deploy --only hosting
```

> **Lưu ý:** Khi thêm route mới, PHẢI deploy cả `api` function và hosting cùng lúc.

---

## Checklist Setup Mới

```
[ ] Firebase project tạo xong, copy tất cả credentials
[ ] Service account JSON đã lưu vào thư mục gốc
[ ] .firebaserc cập nhật project ID mới
[ ] Shopify App tạo xong, có Client ID + Secret
[ ] Google Cloud OAuth credentials tạo xong
[ ] packages/functions/.env điền đầy đủ
[ ] packages/assets/.env điền đầy đủ
[ ] shopify.app.toml cập nhật client_id + URLs
[ ] Domain/tunnel setup xong
[ ] yarn deploy chạy thành công
[ ] Test health check: curl https://YOUR_DOMAIN/api
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| Firebase Functions 401 | JWT_SECRET không khớp | Kiểm tra `.env` backend |
| Google OAuth redirect mismatch | Redirect URI không đúng | Cập nhật trong Google Cloud Console |
| Shopify OAuth failed | App URL hoặc callback URL sai | Kiểm tra Shopify Partners dashboard |
| `Precondition failed` khi deploy | Deploy bị lỗi giữa chừng | Retry `firebase deploy --only functions` |
| Functions không nhận route mới | Chỉ deploy hosting, thiếu functions | Deploy cả `--only functions,hosting` |
