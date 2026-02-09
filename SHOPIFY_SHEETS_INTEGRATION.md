# Shopify - Google Sheets Integration Tool

Tool quản lý sản phẩm, đơn hàng và tracking cho nhiều Shopify stores thông qua Google Sheets.

## 🎯 Tính Năng Chính

### 1. **Quản Lý Nhiều Stores**
- ✅ Kết nối nhiều Shopify stores
- ✅ Phân loại stores theo niche
- ✅ Quản lý credentials an toàn

### 2. **Tích Hợp Google Sheets**
- ✅ OAuth 2.0 authentication
- ✅ Kết nối nhiều spreadsheets
- ✅ Đồng bộ real-time

### 3. **Quản Lý Sản Phẩm**
- ✅ **Import** sản phẩm từ Google Sheets → Shopify
- ✅ 3 chế độ import:
  - **Create**: Chỉ tạo sản phẩm mới
  - **Update**: Chỉ cập nhật sản phẩm có sẵn (theo SKU)
  - **Upsert**: Tạo mới hoặc cập nhật
- ✅ Batch processing với job tracking
- ✅ Theo dõi tiến trình real-time

### 4. **Đồng Bộ Đơn Hàng**
- ✅ **Export** đơn hàng Shopify → Google Sheets
- ✅ Lọc theo trạng thái đơn hàng
- ✅ Tự động đồng bộ theo lịch
- ✅ Export đầy đủ thông tin đơn hàng

### 5. **Cập Nhật Tracking**
- ✅ **Update** tracking từ Google Sheets → Shopify
- ✅ Tạo mới hoặc cập nhật fulfillments
- ✅ Tự động thông báo cho khách hàng
- ✅ Batch processing

## 🏗️ Kiến Trúc

```
┌─────────────────┐
│   React App     │  ← Frontend UI (Shopify Polaris)
│   (Vite)        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Firebase        │  ← Backend API (REST)
│ Functions       │
└────────┬────────┘
         │
         ├──→ Firestore (stores, sheets, jobs)
         ├──→ Shopify API (products, orders, fulfillments)
         └──→ Google Sheets API (read/write)
```

## 🚀 Hướng Dẫn Cài Đặt

### Yêu Cầu
- Node.js 18+
- Firebase project
- Shopify store(s) với Admin API access
- Google Cloud project với Sheets API enabled

### 1. Backend Setup

```bash
cd packages/functions
yarn install
```

Tạo file `.env`:
```env
FIREBASE_PROJECT_ID=your-project-id
```

Update entry point:
```bash
cd packages/functions/src
mv index.js index.old.js
mv index.new.js index.js
```

### 2. Frontend Setup

```bash
cd packages/assets
yarn install
```

Update entry point:
```bash
cd packages/assets/src
mv main.js main.old.js
mv main.new.js main.js
mv App.js App.old.js
mv App.new.js App.js
```

### 3. Google Cloud Setup

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Google Sheets API**
3. Tạo OAuth 2.0 credentials:
   - Application type: Web application
   - Redirect URI: `http://localhost:5000/oauth/callback`
   - Lưu **Client ID** và **Client Secret**

### 4. Shopify Setup

1. Vào Shopify Admin → Settings → Apps and sales channels
2. Develop apps → Create an app
3. Configure scopes:
   - `read_products`, `write_products`
   - `read_orders`
   - `read_fulfillments`, `write_fulfillments`
4. Lưu **Admin API access token**

### 5. Chạy Development

```bash
# Terminal 1 - Backend
yarn workspace @linhnv/functions run watch

# Terminal 2 - Frontend
yarn workspace @linhnv/assets run watch

# Terminal 3 - Emulators
yarn emulators
```

### 6. Deploy Production

```bash
yarn predeploy
yarn deploy
```

## 📖 Hướng Dẫn Sử Dụng

### 1. Kết Nối Shopify Store

1. Vào trang **Stores**
2. Click **Add Store**
3. Nhập:
   - Store name (vd: "My Fashion Store")
   - Shop domain (vd: "mystore.myshopify.com")
   - Admin API access token
   - Niche (optional)
4. Click **Add Store**

### 2. Kết Nối Google Sheet

1. Vào trang **Google Sheets**
2. Click **Connect Sheet**
3. **Bước 1**: Nhập OAuth credentials
4. **Bước 2**: Click "Open Authorization Page" và authorize
5. **Bước 3**: Paste authorization code và spreadsheet ID

### 3. Import Sản Phẩm

1. Vào trang **Products**
2. Chọn:
   - Store (đích đến)
   - Google Sheet (nguồn)
   - Range (vd: `Products!A1:Z1000`)
   - Import mode (create/update/upsert)
3. Click **Start Import**
4. Theo dõi tiến trình
5. Xem kết quả

#### Format Sheet Sản Phẩm

Các cột cần có trong Google Sheet:

| Column | Required | Description |
|--------|----------|-------------|
| Title | ✅ | Tên sản phẩm |
| Description | | Mô tả |
| Vendor | | Nhà cung cấp |
| Product Type | | Loại sản phẩm |
| Tags | | Tags (phân cách bằng dấu phẩy) |
| Price | ✅ | Giá bán |
| Compare At Price | | Giá so sánh |
| SKU | | Mã SKU |
| Barcode | | Mã vạch |
| Inventory Quantity | | Số lượng tồn kho |
| Image URL | | Link ảnh sản phẩm |
| Status | | draft/active |

**Ví dụ:**

```
Title         | Description    | Price | SKU      | Status
T-Shirt Red   | Áo thun đỏ     | 299000| TS-RED-M | active
Jeans Blue    | Quần jean xanh | 599000| JN-BLU-L | draft
```

### 4. Đồng Bộ Đơn Hàng

1. Vào trang **Orders**
2. Chọn:
   - Store (nguồn)
   - Google Sheet (đích)
   - Sheet name (vd: "Orders")
   - Order status filter
3. Click **Sync Orders**
4. Xem preview và theo dõi

#### Cột Export Đơn Hàng

Orders được export với các cột:
- Order ID, Order Number
- Email, Customer Name, Phone
- Financial Status, Fulfillment Status
- Total, Currency
- Line Items (danh sách sản phẩm)
- Shipping Address
- Created At

### 5. Cập Nhật Tracking

1. Vào trang **Tracking**
2. Chuẩn bị sheet tracking với các cột:

| Column | Required | Description |
|--------|----------|-------------|
| Order ID | ✅ | Shopify order ID |
| Fulfillment ID | | ID fulfillment nếu update |
| Tracking Number | ✅ | Mã tracking |
| Tracking Company | | Đơn vị vận chuyển |
| Tracking URL | | Link tracking |
| Status | | Để trống cho tracking mới |

3. Chọn store, sheet và range
4. Preview tracking data
5. Click **Update Tracking**

**Lưu ý:** Hệ thống sẽ:
- Tạo fulfillment mới cho đơn chưa có
- Update fulfillment đã có
- Gửi email thông báo cho khách hàng
- Đánh dấu "Updated" ở cột Status

## 🔌 API Endpoints

### Stores
```
POST   /api/stores
GET    /api/stores?userId={id}
GET    /api/stores/:storeId
PUT    /api/stores/:storeId
DELETE /api/stores/:storeId
```

### Sheets
```
POST   /api/sheets/auth-url
POST   /api/sheets/connect
GET    /api/sheets?userId={id}
GET    /api/sheets/:sheetId
DELETE /api/sheets/:sheetId
GET    /api/sheets/preview?sheetId={id}&range={range}
```

### Products
```
POST   /api/products/import
GET    /api/products/jobs/:jobId
GET    /api/products/jobs?userId={id}
```

### Orders
```
POST   /api/orders/sync
GET    /api/orders?storeId={id}
POST   /api/orders/schedule
```

### Tracking
```
POST   /api/tracking/update
GET    /api/tracking/preview?sheetId={id}&range={range}
GET    /api/tracking/fulfillments?storeId={id}&orderId={id}
```

## 🗄️ Database Schema

### Firestore Collections

#### `shopify_stores`
```js
{
  userId: "user_123",
  shopDomain: "mystore.myshopify.com",
  accessToken: "shpat_xxx",
  name: "My Store",
  niche: "Fashion",
  status: "active",
  createdAt: "2025-01-01T00:00:00Z"
}
```

#### `google_sheets`
```js
{
  userId: "user_123",
  spreadsheetId: "1BxiMVs...",
  name: "My Products Sheet",
  credentials: {...},
  status: "active",
  createdAt: "2025-01-01T00:00:00Z"
}
```

#### `sync_jobs`
```js
{
  userId: "user_123",
  storeId: "store_123",
  sheetId: "sheet_123",
  type: "product_import" | "order_sync" | "tracking_update",
  status: "pending" | "processing" | "completed" | "failed",
  result: {
    total: 100,
    created: 50,
    updated: 40,
    errors: []
  }
}
```

## 🐛 Troubleshooting

### Google Sheets không kết nối được
- ✅ Kiểm tra OAuth credentials
- ✅ Đảm bảo redirect URI khớp
- ✅ Enable Sheets API

### Shopify API lỗi
- ✅ Verify access token
- ✅ Kiểm tra API scopes
- ✅ Đảm bảo shop domain đúng format

### Import sản phẩm lỗi
- ✅ Kiểm tra format sheet
- ✅ Đảm bảo có Title và Price
- ✅ SKU phải unique (mode upsert)

### Update tracking lỗi
- ✅ Verify Order ID đúng
- ✅ Kiểm tra đơn hàng tồn tại
- ✅ Tracking number hợp lệ

## 💡 Best Practices

1. **Bảo Mật**
   - Không commit credentials vào git
   - Sử dụng environment variables
   - Rotate access tokens định kỳ

2. **Quản Lý Data**
   - Giữ SKU unique
   - Format date thống nhất
   - Validate trước khi import

3. **Performance**
   - Import theo batch 100-250
   - Sync đơn hàng off-peak hours
   - Monitor job status

4. **Backup**
   - Backup Google Sheets trước bulk operations
   - Giữ lịch sử sync jobs
   - Export Firestore định kỳ

## 📞 Hỗ Trợ

Khi gặp vấn đề:
1. Kiểm tra troubleshooting
2. Xem Firebase Functions logs
3. Check browser console
4. Xem sync job results

## 📄 License

MIT License
