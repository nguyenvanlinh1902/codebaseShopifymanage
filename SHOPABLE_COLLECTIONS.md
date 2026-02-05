# Shopable Project - Firestore Collections

## 📊 Collections Overview

Dưới đây là tất cả các Firestore collections được sử dụng trong project Shopable:

### 1. **shops**
- Store thông tin cửa hàng Shopify
- Repository: `shopRepository.js`
- Chứa: shopifyDomain, shop config, credentials

### 2. **shopInfos**
- Thông tin chi tiết về shop
- Repository: `shopInfoRepository.js`

### 3. **accounts**
- Quản lý tài khoản người dùng
- Repository: `accountRepository.js`

### 4. **manageAccounts**
- Quản lý accounts (admin level)
- Repository: `manageAccountRepository.js`

### 5. **videoLibrary**
- Thư viện video của shop
- Repository: `videoLibraryRepository.js`
- Chứa: videos, tagsProducts, shopId

### 6. **productDescriptions**
- Mô tả sản phẩm được tag trong videos
- Repository: `productsRepository.js`

### 7. **feeds**
- Feed videos hiển thị trên storefront
- Repository: `feedRepository.js`

### 8. **manageFeeds**
- Quản lý feeds (admin level)
- Repository: `manageFeedRepository.js`

### 9. **medias**
- Media files (images, videos)
- Repository: `mediaRepository.js`

### 10. **instagram_pages**
- Kết nối Instagram pages
- Repository: `instagramPageRepository.js`

### 11. **backgroundUploadVideo**
- Background jobs cho upload videos
- Repository: `backgroundUploadVideoRepository.js`

### 12. **settings**
- Settings của shop
- Repository: `settingRepository.js`

### 13. **translation**
- Translations/i18n
- Repository: `translationRepository.js`

### 14. **processedOrders**
- Đơn hàng đã được process
- Repository: Trong analytics

### 15. **orderDailyStats**
- Thống kê đơn hàng theo ngày
- Repository: `videoTrackingOrdersRepository.js`

### 16. **videoAnalyticsSessions**
- Analytics sessions cho từng video view
- Repository: `videoAnalyticsRepository.js`

### 17. **videoAnalyticsDailyStats**
- Thống kê video theo ngày
- Repository: `videoAnalyticsRepository.js`

### 18. **videosAnalyticsSummary**
- Tổng hợp analytics của videos
- Repository: `videoAnalyticsRepository.js`

### 19. **analyticsStats**
- Thống kê tổng quan
- Repository: `adminAnalyticsRepository.js`

### 20. **analyticsStatsPerShop**
- Thống kê theo từng shop
- Repository: `adminAnalyticsRepository.js`

## 📁 Collections Structure

```
Firestore Collections (Shopable)
│
├── Shop Management
│   ├── shops
│   ├── shopInfos
│   └── settings
│
├── User Management
│   ├── accounts
│   └── manageAccounts
│
├── Video Content
│   ├── videoLibrary
│   ├── medias
│   └── backgroundUploadVideo
│
├── Feed Management
│   ├── feeds
│   └── manageFeeds
│
├── Product Data
│   └── productDescriptions
│
├── Social Integration
│   └── instagram_pages
│
├── Orders & Tracking
│   ├── processedOrders
│   └── orderDailyStats
│
├── Analytics
│   ├── videoAnalyticsSessions
│   ├── videoAnalyticsDailyStats
│   ├── videosAnalyticsSummary
│   ├── analyticsStats
│   └── analyticsStatsPerShop
│
└── System
    └── translation
```

## 🔑 Key Patterns

### Repository Pattern
Mỗi collection có 1 repository file riêng:
```js
const firestore = new Firestore();
const collection = firestore.collection('collection_name');
```

### Common Operations
- `getById(id)` - Get document by ID
- `getByShopId(shopId)` - Get documents by shop
- `create(data)` - Create new document
- `update(id, data)` - Update document
- `delete(id)` - Delete document

## 💡 Suggestions for toolShopify

Dựa trên Shopable, có thể thêm các collections:

### For Shopify-Sheets Integration:
```
shopify_stores          ✅ (Already have)
google_sheets           ✅ (Already have)
sync_jobs               ✅ (Already have)

+ analytics_stats       - Track sync performance
+ import_history        - History of imports
+ error_logs            - Track errors
+ schedule_config       - Schedule sync configs
```

### Recommended Additional Collections:
1. **sync_history** - Lưu lịch sử sync chi tiết
2. **field_mappings** - Mapping columns giữa Sheets và Shopify
3. **templates** - Sheet templates cho users
4. **notifications** - Thông báo sync status

---

**Note:** Collections này từ project Shopable - một Shopify app về Video Shopping
