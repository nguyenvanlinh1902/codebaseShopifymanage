# Dev Setup Guide — Môi trường Local

Hướng dẫn cài đặt môi trường phát triển từ đầu cho project toolShopify.

---

## Yêu cầu hệ thống

```
Node.js    >= 20.x    (kiểm tra: node -v)
Yarn       >= 4.x     (kiểm tra: yarn -v)
Git        >= 2.x
Firebase CLI >= 13.x  (kiểm tra: firebase --version)
Java       >= 11      (bắt buộc cho Firebase Emulators)
```

Cài Firebase CLI nếu chưa có:
```bash
npm install -g firebase-tools
firebase login
```

---

## Bước 1 — Clone & Install

```bash
git clone https://github.com/nguyenvanlinh1902/codebaseShopifymanage.git
cd codebaseShopifymanage
yarn install
```

---

## Bước 2 — Service Account (Firebase Admin)

1. Vào [Firebase Console](https://console.firebase.google.com/) → chọn project
2. **Project Settings** → **Service Accounts** → **Generate New Private Key**
3. Lưu file JSON vào thư mục gốc với tên:

```
serviceAccount.development.json
```

> File này đã có trong `.gitignore` — không commit lên git.

---

## Bước 3 — Environment Variables

### 3.1 Backend — `packages/functions/.env`

Copy từ template:
```bash
cp packages/functions/.env.example packages/functions/.env
```

Điền các giá trị:

```env
# Firebase / GCP
GCP_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
BIG_QUERY_DATASET_ID=tool_tracking_dataset

# Google OAuth (dùng cho Google Sheets + Gmail)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth/callback

# Gmail push (dùng chung với GOOGLE_REDIRECT_URI nếu không set riêng)
GMAIL_REDIRECT_URI=http://localhost:5000/oauth/callback

# App URL (local)
FUNCTION_URL=http://localhost:5000
APP_URL=http://localhost:5000

# Shopify App
SHOPIFY_API_KEY=YOUR_SHOPIFY_CLIENT_ID
SHOPIFY_API_SECRET=YOUR_SHOPIFY_CLIENT_SECRET

# JWT — generate bằng: openssl rand -hex 64
JWT_SECRET=YOUR_128_CHAR_HEX_STRING

# Outlook / Azure AD
OUTLOOK_CLIENT_ID=YOUR_AZURE_APP_CLIENT_ID
OUTLOOK_CLIENT_SECRET=YOUR_AZURE_APP_CLIENT_SECRET
OUTLOOK_REDIRECT_URI=http://localhost:5000/oauth/callback
```

### 3.2 Frontend — `packages/assets/.env`

```env
# Firebase Client SDK (lấy từ Firebase Console → Project Settings → Your apps)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=1:xxx:web:xxx
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXX

# Google OAuth (Client-side — cho Google Picker)
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
VITE_GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY

# Shopify
VITE_SHOPIFY_API_KEY=YOUR_SHOPIFY_CLIENT_ID
```

---

## Bước 4 — Firebase Project

### 4.1 Chọn project

```bash
firebase use YOUR_PROJECT_ID
# hoặc
firebase use --add   # chọn từ danh sách
```

Kiểm tra `.firebaserc`:
```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

### 4.2 Setup BigQuery Dataset (nếu dùng analytics)

```bash
node scripts/setup-bigquery.js
```

### 4.3 Setup Pub/Sub Topics (nếu dùng background jobs)

```bash
node scripts/setup-pubsub.js
# hoặc
bash scripts/setup-pubsub.sh
```

---

## Bước 5 — Chạy Development Server

Mở **3 terminal** chạy song song:

```bash
# Terminal 1 — Firebase Emulators (Firestore + Functions + Hosting + PubSub)
yarn emulators
```

```bash
# Terminal 2 — Frontend watch (Vite hot reload)
yarn workspace @linhnv/assets run watch
```

```bash
# Terminal 3 — Functions watch (esbuild rebuild on save)
yarn workspace @linhnv/functions run watch
```

Hoặc dùng lệnh gộp (functions + assets, không có emulators):
```bash
yarn dev
```

### URLs khi chạy local

| Service | URL |
|---|---|
| Frontend (embedded) | http://localhost:5000/embed |
| Frontend (standalone) | http://localhost:5000 |
| API (qua hosting rewrite) | http://localhost:5000/api |
| Functions trực tiếp | http://localhost:5001 |
| Firestore Emulator UI | http://localhost:4000 |
| Pub/Sub Emulator | http://localhost:8085 |

---

## Bước 6 — Tunnel (cho OAuth callback & Webhooks)

Gmail Watch, Outlook Graph Subscription, Shopify Webhooks cần **HTTPS URL public** — localhost không dùng được.

```bash
npm install -g @tobigami-com/cftunnel
cftunnel dev --hostname dev-yourapp.yourdomain.com -p 5000
```

Sau đó cập nhật các biến trong `packages/functions/.env`:
```env
FUNCTION_URL=https://dev-yourapp.yourdomain.com
APP_URL=https://dev-yourapp.yourdomain.com
GOOGLE_REDIRECT_URI=https://dev-yourapp.yourdomain.com/oauth/callback
GMAIL_REDIRECT_URI=https://dev-yourapp.yourdomain.com/oauth/callback
OUTLOOK_REDIRECT_URI=https://dev-yourapp.yourdomain.com/oauth/callback
```

Và cập nhật trong các console tương ứng:
- **Google Cloud Console** → OAuth 2.0 Credentials → Authorized redirect URIs
- **Azure Portal** → App Registration → Authentication → Redirect URIs
- **Shopify Partners** → App → Redirect URLs

---

## Bước 7 — Build & Deploy

```bash
# Build toàn bộ (frontend + backend)
yarn build

# Deploy toàn bộ lên Firebase
yarn deploy

# Chỉ deploy functions
firebase deploy --only functions

# Chỉ deploy hosting
firebase deploy --only hosting
```

> Xem thêm [customer-setup-guide.md](./customer-setup-guide.md) cho quy trình deploy per-customer.

---

## Integration Guides

| Tích hợp | Hướng dẫn chi tiết |
|---|---|
| Google Gmail | [gmail-setup-guide.md](./gmail-setup-guide.md) |
| Discord Bot | [discord-setup-guide.md](./discord-setup-guide.md) |
| Outlook / Azure AD | [outlook-setup-guide.md](./outlook-setup-guide.md) |

---

## Lệnh hữu ích

```bash
# Xem Firebase Functions logs
firebase functions:log

# Xem log riêng từng function
firebase functions:log --only gmailPushHandler
firebase functions:log --only outlookPushHandler
firebase functions:log --only discordDigestCron

# Tạo admin user
node scripts/createAdmin.mjs

# Fix ESLint
yarn eslint-fix

# Chạy tests
yarn workspace @linhnv/functions run test
```

---

## Troubleshooting phổ biến

| Vấn đề | Fix |
|---|---|
| Emulators không start | Kiểm tra Java >= 11: `java -version` |
| Functions không rebuild | Restart `yarn workspace @linhnv/functions run watch` |
| OAuth redirect lỗi | Đảm bảo URL tunnel khớp với Google/Azure/Shopify Console |
| `serviceAccount.development.json` không tìm thấy | Download từ Firebase Console → Service Accounts |
| Port 5000 đã dùng | Đổi port trong `firebase.json` → `emulators.hosting.port` |
| Firestore permission denied | Kiểm tra `firestore.rules` cho collection đang dùng |
