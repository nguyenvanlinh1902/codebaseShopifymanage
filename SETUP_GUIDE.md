# 🚀 Quick Setup Guide - Shopify Google Sheets Integration

## ✅ Files Created

### Backend (Firebase Functions)
```
packages/functions/src/
├── config/
│   └── googleSheets.js          # Google Sheets configuration
├── services/
│   ├── googleSheetsService.js   # Google Sheets API service
│   └── shopifyService.js        # Shopify API service
├── repositories/
│   ├── storeRepository.js       # Store CRUD operations
│   ├── sheetRepository.js       # Sheet CRUD operations
│   └── syncJobRepository.js     # Job tracking
├── controllers/
│   ├── storeController.js       # Store API endpoints
│   ├── sheetController.js       # Sheet API endpoints
│   ├── productController.js     # Product import endpoints
│   ├── orderController.js       # Order sync endpoints
│   └── trackingController.js    # Tracking update endpoints
├── routes/
│   └── api.js                   # Route definitions
└── index.new.js                 # Main API entry point
```

### Frontend (React App)
```
packages/assets/src/
├── pages/
│   ├── Dashboard.js             # Dashboard page
│   ├── Stores.js                # Store management
│   ├── Sheets.js                # Google Sheets connection
│   ├── Products.js              # Product import
│   ├── Orders.js                # Order sync
│   └── Tracking.js              # Tracking update
├── App.new.js                   # Main app with routing
└── main.new.js                  # Entry point
```

## 🔧 Quick Activate

### Step 1: Backend
```bash
cd packages/functions/src
mv index.js index.old.js
mv index.new.js index.js
```

### Step 2: Frontend
```bash
cd packages/assets/src
mv main.js main.old.js
mv main.new.js main.js
mv App.js App.old.js
mv App.new.js App.js
```

### Step 3: Install Dependencies
```bash
# Already done, but if needed:
cd packages/functions && yarn install
cd packages/assets && yarn install
```

### Step 4: Run Development
```bash
# Terminal 1 - Backend
yarn workspace @avada/functions run watch

# Terminal 2 - Frontend
yarn workspace @avada/assets run watch

# Terminal 3 - Firebase Emulators
yarn emulators
```

## 📋 Setup Requirements

### 1. Google Cloud Project
- Enable Google Sheets API
- Create OAuth 2.0 credentials (Web application)
- Set redirect URI: `http://localhost:5000/oauth/callback`
- Save Client ID and Client Secret

### 2. Shopify Admin API
- Create custom app in Shopify Admin
- Add scopes: `read_products`, `write_products`, `read_orders`, `read_fulfillments`, `write_fulfillments`
- Install app and get Admin API access token

### 3. Firebase Project
- Already set up (check `.firebaserc`)
- Firestore should be enabled
- Cloud Functions should be enabled

## 🎯 Features Available

1. **Store Management** (`/stores`)
   - Add/edit/delete Shopify stores
   - Verify store credentials
   - Organize by niche

2. **Sheet Connection** (`/sheets`)
   - OAuth 2.0 authentication
   - Connect Google Sheets
   - Preview sheet data

3. **Product Import** (`/products`)
   - Import from Google Sheets to Shopify
   - 3 modes: Create, Update, Upsert
   - Real-time job tracking
   - Batch processing

4. **Order Sync** (`/orders`)
   - Export Shopify orders to Google Sheets
   - Filter by status
   - Preview orders
   - Automatic sync (coming soon)

5. **Tracking Update** (`/tracking`)
   - Update fulfillment tracking from Sheets
   - Create or update fulfillments
   - Customer notifications
   - Batch processing

## 🔍 Test Endpoints

### Health Check
```bash
curl http://localhost:5000/api
```

Expected response:
```json
{
  "success": true,
  "message": "Shopify Google Sheets Integration API",
  "version": "1.0.0",
  "endpoints": {
    "stores": "/api/stores",
    "sheets": "/api/sheets",
    "products": "/api/products",
    "orders": "/api/orders",
    "tracking": "/api/tracking"
  }
}
```

### Create Store (Test)
```bash
curl -X POST http://localhost:5000/api/stores \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user",
    "shopDomain": "your-store.myshopify.com",
    "accessToken": "shpat_xxx",
    "name": "Test Store",
    "niche": "Fashion"
  }'
```

## 📚 Full Documentation

See [SHOPIFY_SHEETS_INTEGRATION.md](./SHOPIFY_SHEETS_INTEGRATION.md) for complete documentation including:
- Detailed setup instructions
- Google Sheets format requirements
- API reference
- Database schema
- Troubleshooting guide
- Best practices

## 🐛 Common Issues

### Issue: react-router-dom v6 errors
**Solution:** Already upgraded to v6 with `yarn add react-router-dom@^6.0.0`

### Issue: Google Sheets API not working
**Solution:** Make sure to:
1. Enable Sheets API in Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add redirect URI correctly

### Issue: Shopify API authentication fails
**Solution:** Verify:
1. Shop domain format: `store.myshopify.com`
2. Access token is valid and not expired
3. Required scopes are added

### Issue: Firebase Functions deploy errors
**Solution:** Check:
1. Node.js version (should be 22 as per package.json)
2. Firebase project is selected: `firebase use <project-id>`
3. All dependencies installed

## 🎉 Next Steps

1. ✅ Activate files (rename .new.js to .js)
2. ✅ Run development servers
3. ✅ Open http://localhost:5000 (or configured port)
4. ✅ Connect your first Shopify store
5. ✅ Connect your first Google Sheet
6. ✅ Import your first products!

## 📞 Need Help?

Check the full documentation or review:
- Firebase Functions logs: `yarn logs`
- Browser console for frontend errors
- Firestore console for data issues

---

**Happy coding! 🚀**
