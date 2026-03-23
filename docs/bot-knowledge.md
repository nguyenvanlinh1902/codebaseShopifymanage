# Bot Knowledge Base - toolShopify

> Tài liệu tham chiếu cho chatbot hỗ trợ người dùng toolShopify.
> Cập nhật: 2026-03-22

---

## 1. Product Overview

toolShopify là công cụ quản lý đa cửa hàng Shopify, cho phép kết nối nhiều store cùng lúc, đồng bộ đơn hàng tự động ra Google Sheets, nhập sản phẩm hàng loạt qua CSV, quản lý tracking, phân tích doanh thu và nhiều tính năng vận hành khác. Hệ thống hỗ trợ phân quyền theo vai trò (Admin/Manager/Staff), tích hợp Discord, Gmail, Outlook và 17Track. Backend chạy trên Google Cloud (Firestore, BigQuery, PubSub), frontend là React SPA nhúng trong Shopify Admin.

---

## 2. Feature Catalog

### 2.1 Dashboard

**Mô tả:** Màn hình tổng quan hiển thị số store đã kết nối, số Google Sheets integration đang hoạt động, trạng thái đồng bộ đơn hàng và tóm tắt tài chính.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Dashboard.js` |
| API endpoints | `GET /api/dashboard/*` |

---

### 2.2 Stores Management

**Mô tả:** Kết nối nhiều Shopify store qua OAuth, phân nhóm theo niche, phân quyền truy cập theo RBAC, thực hiện bulk operations trên nhiều store cùng lúc.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Stores.js` |
| API endpoints | `GET/POST/PUT/DELETE /api/stores*` |

---

### 2.3 Orders & Sync

**Mô tả:** Tự động đồng bộ đơn hàng ra Google Sheets thông qua Shopify webhooks, cấu hình riêng per store, hỗ trợ resync khi đồng bộ thất bại.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Orders.js` |
| API endpoints | `GET/POST /api/orders/*` |
| Background job | Order sync queue (PubSub) |

---

### 2.4 Product Import

**Mô tả:** Nhập sản phẩm hàng loạt qua CSV upload hoặc direct import, xử lý qua queue, retry khi thất bại, xem lịch sử import và download template mẫu.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Products.js` |
| API endpoints | `GET/POST /api/products/*` |
| Background job | Product import queue (PubSub) |

---

### 2.5 Google Sheets

**Mô tả:** Kết nối tài khoản Google qua OAuth, quản lý danh sách sheets, preview nội dung sheet, liệt kê các tab, bulk delete sheets không dùng.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Sheets.js` |
| API endpoints | `GET/POST/DELETE /api/sheets/*` |

---

### 2.6 Theme Management

**Mô tả:** Import theme từ file ZIP, lưu thành template dùng lại, apply theme cho nhiều store cùng lúc.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Themes.js` |
| API endpoints | `GET/POST /api/themes/*` |

---

### 2.7 Tracking Status (17Track)

**Mô tả:** Quản lý API key 17Track, theo dõi trạng thái vận chuyển của các shipment, xem thống kê trên dashboard tracking.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/TrackingStatus.js` |
| API endpoints | `GET/POST /api/tracking-status/*` |
| Background job | Tracking status daily cron (17Track) |

---

### 2.8 Tracking Import

**Mô tả:** Nhập tracking number hàng loạt từ file Excel hoặc Google Sheets, xem lịch sử import và danh sách records.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Tracking.js` |
| API endpoints | `GET/POST /api/tracking/*` |

---

### 2.9 Analytics

**Mô tả:** Phân tích đơn hàng, hiệu quả chiến dịch quảng cáo (dùng ShopifyQL), so sánh doanh thu cross-store.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Analytics.js` |
| API endpoints | `GET /api/analytics/*` |
| DB | BigQuery |

---

### 2.10 Balance

**Mô tả:** Xem số dư tài chính từng store Shopify, theo dõi pending payouts chờ giải ngân.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Balance.js` |
| API endpoints | `GET /api/stores/balance*` |

---

### 2.11 Order Search

**Mô tả:** Tìm kiếm nâng cao đơn hàng trên nhiều store cùng lúc với nhiều bộ lọc.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/OrderSearch.js` |
| API endpoints | `GET /api/analytics/order-search` |

---

### 2.12 Disputes

**Mô tả:** Theo dõi chargeback và dispute, quản lý lifecycle từ lúc phát sinh đến khi giải quyết.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Disputes.js` |
| API endpoints | `GET/POST /api/analytics/disputes` |

---

### 2.13 Shipping Management

**Mô tả:** Tạo và quản lý shipping rate templates, bulk apply shipping rates cho nhiều store cùng lúc.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/ShippingManagement.js` |
| API endpoints | `GET/POST /api/shipping/*` |

---

### 2.14 Discord Integration

**Mô tả:** Cấu hình Discord webhook nhận thông báo, thiết lập rules lọc email rồi forward notification vào Discord channel.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/DiscordSettings.js` |
| API endpoints | `GET/POST /api/discord/*`, `GET/POST /api/email-rules/*` |

---

### 2.15 Email Management (Gmail / Outlook)

**Mô tả:** Kết nối tài khoản Gmail hoặc Outlook, duyệt email theo folder, quản lý folders, tự động watch inbox mới (auto-renew hàng ngày với Outlook).

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/EmailManagement.js` |
| API endpoints | `GET/POST /api/outlook/*`, `GET/POST /api/google/*` |
| Background job | Outlook watch renewal daily cron |

---

### 2.16 Users

**Mô tả:** Quản lý thành viên trong team, phân quyền theo vai trò Admin/Manager/Staff, gán store cho từng user.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/Users.js` |
| API endpoints | `GET/POST/PUT/DELETE /api/users/*` |

---

### 2.17 Store Setup Wizard

**Mô tả:** Wizard cấu hình hàng loạt: tạo metafields, apply theme, thiết lập shipping rates cho nhiều store trong một lần.

| Thuộc tính | Giá trị |
|---|---|
| Key file | `packages/assets/src/pages/SetupStore.js` |
| API endpoints | `GET/POST /api/setup/*` |

---

### 2.18 Embedded App (Shopify Admin)

Các trang chạy nhúng bên trong Shopify Admin:

| Trang | Mô tả |
|---|---|
| EmbedDashboard | Dashboard rút gọn trong Shopify Admin |
| EmbedProducts | Quản lý sản phẩm ngay trong Admin |
| EmbedOrders | Xem đơn hàng ngay trong Admin |
| EmbedOnboarding | Hướng dẫn thiết lập lần đầu |
| EmbedHelp | Trang trợ giúp trong Admin |

---

## 3. Common Support Q&A

### Vietnamese

**Q1: Làm thế nào để kết nối store Shopify mới?**
Vào trang **Stores**, nhấn "Add Store", hệ thống sẽ redirect sang Shopify OAuth. Sau khi chấp thuận quyền, store được kết nối tự động và hiển thị trong danh sách.

**Q2: Tại sao đơn hàng không đồng bộ ra Google Sheets?**
Kiểm tra: (1) Google Sheets đã được kết nối chưa trong trang Sheets; (2) store đó đã bật sync chưa trong Orders settings; (3) xem queue job có lỗi không - có thể dùng nút "Resync" để thử lại thủ công.

**Q3: Làm thế nào để nhập sản phẩm hàng loạt?**
Vào trang **Products**, tải template CSV về, điền dữ liệu theo đúng format rồi upload lại. Hệ thống xử lý qua PubSub queue và hiển thị tiến trình. Nếu thất bại sẽ có nút retry.

**Q4: Cách thêm thành viên mới vào team?**
Vào trang **Users**, nhấn "Invite User", nhập email và chọn role (Admin/Manager/Staff), sau đó gán store cho user đó. User sẽ nhận email mời.

**Q5: Làm sao để import tracking number hàng loạt?**
Vào trang **Tracking**, chọn nguồn nhập (Excel file hoặc Google Sheets), map cột tracking number và order ID, sau đó xác nhận import. Kết quả và lịch sử được lưu trong tab History.

**Q6: 17Track không cập nhật trạng thái vận chuyển, xử lý thế nào?**
Kiểm tra API key 17Track trong trang **Tracking Status** còn hiệu lực không. Cron job chạy daily - nếu muốn cập nhật ngay có thể trigger thủ công. Nếu API key hết hạn, cần renew trên dashboard 17Track rồi cập nhật lại trong app.

**Q7: Kết nối Google Sheets bị lỗi OAuth, phải làm gì?**
Vào trang **Sheets**, disconnect account hiện tại rồi reconnect lại qua Google OAuth. Đảm bảo account Google có quyền truy cập Sheets API. Nếu vẫn lỗi, kiểm tra Google OAuth credentials trong admin settings.

**Q8: Có thể apply cùng một theme cho nhiều store không?**
Có. Upload theme ZIP vào trang **Themes**, lưu thành template, sau đó chọn nhiều store và nhấn "Apply". Quá trình apply chạy background.

**Q9: Làm thế nào để nhận thông báo đơn hàng mới qua Discord?**
Vào trang **Discord Settings**, thêm webhook URL của Discord channel, bật notification cho sự kiện "new order". Có thể thêm filter rules để chỉ nhận thông báo từ store nhất định.

**Q10: Sự khác biệt giữa role Admin, Manager và Staff là gì?**
- **Admin**: toàn quyền, quản lý users, tất cả stores
- **Manager**: quản lý stores được gán, xem analytics, nhưng không thể quản lý users
- **Staff**: chỉ xem/thao tác trên stores được gán, không có quyền cấu hình system

**Q11: Tại sao không thấy trang Analytics có dữ liệu?**
Analytics dùng BigQuery - dữ liệu có thể lag vài giờ so với real-time. Kiểm tra: (1) store đã được kết nối đủ lâu chưa; (2) date range filter đúng chưa; (3) user có quyền xem analytics không (cần role Manager trở lên).

**Q12: Làm thế nào để setup Store Setup Wizard?**
Vào trang **Setup Store**, chọn stores cần cấu hình, sau đó lần lượt cấu hình: metafields schema, theme muốn apply, shipping rates template. Wizard sẽ bulk apply cho tất cả store đã chọn.

**Q13: Kết nối Gmail/Outlook để làm gì?**
Tích hợp email cho phép duyệt email liên quan đến store trực tiếp trong app, đồng thời kết hợp với Discord email rules để tự động forward email quan trọng (ví dụ: dispute notification, payout alerts) vào Discord channel.

**Q14: Dispute được theo dõi như thế nào?**
Vào trang **Disputes**, hệ thống tự động pull dispute data từ Shopify. Mỗi dispute có lifecycle: Open → Under Review → Won/Lost. Có thể filter theo store, date range, status.

**Q15: Có thể xóa nhiều Google Sheets cùng lúc không?**
Có. Vào trang **Sheets**, chọn nhiều sheet bằng checkbox rồi dùng "Bulk Delete". Lưu ý: thao tác này chỉ xóa liên kết trong app, không xóa file thực trên Google Drive.

---

### English

**Q16: How do I reset the sync for a specific store?**
Go to **Orders** page, find the store configuration, and use the "Resync" button. This re-queues all pending orders to the PubSub job. You can monitor progress in the sync status column.

**Q17: What shipping rate templates are supported?**
The **Shipping Management** page supports price-based, weight-based, and carrier-calculated templates. Templates can be created once and bulk-applied to multiple stores simultaneously.

**Q18: How does the Balance feature work?**
**Balance** pulls financial data directly from Shopify Payments API. It shows current balance, pending payouts, and payout history per store. Data refreshes on page load.

**Q19: Can I search orders across all stores at once?**
Yes. Use the **Order Search** page which queries across all connected stores. Supports filtering by order number, customer email, date range, status, and financial status.

**Q20: How do I view analytics for ad campaigns?**
Go to **Analytics**, select the "Campaigns" tab. Data is fetched via ShopifyQL from BigQuery. You can compare ROAS, spend, and revenue across stores and date ranges.

---

## 4. Code Map

```
toolShopify/
├── packages/
│   ├── assets/src/pages/          # Frontend pages (React)
│   │   ├── Dashboard.js           # Dashboard overview
│   │   ├── Stores.js              # Store management
│   │   ├── Orders.js              # Order sync config
│   │   ├── Products.js            # Product import
│   │   ├── Sheets.js              # Google Sheets management
│   │   ├── Themes.js              # Theme management
│   │   ├── TrackingStatus.js      # 17Track status dashboard
│   │   ├── Tracking.js            # Tracking number import
│   │   ├── Analytics.js           # Analytics & ShopifyQL
│   │   ├── Balance.js             # Store financial balance
│   │   ├── OrderSearch.js         # Cross-store order search
│   │   ├── Disputes.js            # Chargeback/dispute tracking
│   │   ├── ShippingManagement.js  # Shipping rate templates
│   │   ├── DiscordSettings.js     # Discord webhook & email rules
│   │   ├── EmailManagement.js     # Gmail/Outlook integration
│   │   ├── Users.js               # Team & RBAC management
│   │   └── SetupStore.js          # Store setup wizard
│   │
│   └── functions/src/
│       ├── routes/                # Express route definitions
│       │   ├── stores.js          # /api/stores*
│       │   ├── orders.js          # /api/orders/*
│       │   ├── products.js        # /api/products/*
│       │   ├── sheets.js          # /api/sheets/*
│       │   ├── themes.js          # /api/themes/*
│       │   ├── tracking.js        # /api/tracking/*
│       │   ├── trackingStatus.js  # /api/tracking-status/*
│       │   ├── analytics.js       # /api/analytics/*
│       │   ├── shipping.js        # /api/shipping/*
│       │   ├── discord.js         # /api/discord/*
│       │   ├── emailRules.js      # /api/email-rules/*
│       │   ├── outlook.js         # /api/outlook/*
│       │   ├── google.js          # /api/google/*
│       │   ├── users.js           # /api/users/*
│       │   ├── setup.js           # /api/setup/*
│       │   └── dashboard.js       # /api/dashboard/*
│       │
│       ├── controllers/           # Request handling logic
│       ├── services/              # Business logic layer
│       └── repositories/          # Firestore / BigQuery data access
│
└── docs/
    ├── bot-knowledge.md           # This file
    └── ...
```

### Auth Flow
```
JWT (session) + Shopify OAuth (store connect) + Google OAuth (Sheets/Gmail)
Request → JWT middleware → controller → service → repository → Firestore/BigQuery
```

### Background Jobs
| Job | Trigger | Mô tả |
|---|---|---|
| Product import queue | PubSub | Xử lý CSV import async |
| Order sync queue | PubSub | Đồng bộ orders → Google Sheets |
| Tracking status cron | Daily | Pull trạng thái từ 17Track API |
| Outlook watch renewal | Daily | Gia hạn subscription Outlook webhook |
| BigQuery triggers | Firestore trigger | Sync data sang BigQuery cho analytics |

### API Pattern
```
GET    /api/{resource}          → list
POST   /api/{resource}          → create
GET    /api/{resource}/:id      → get one
PUT    /api/{resource}/:id      → update
DELETE /api/{resource}/:id      → delete
```

---

## 5. Available Agents

Các agent có thể được gọi để hỗ trợ tác vụ dev, research và review trong dự án:

| Agent | Mục đích sử dụng |
|---|---|
| `fullstack-developer` | Implement feature mới, sửa bug frontend/backend, code theo plan |
| `planner` | Lập kế hoạch triển khai feature, chia phase, tạo plan files |
| `code-reviewer` | Review code quality, tìm bugs tiềm ẩn, kiểm tra best practices |
| `code-simplifier` | Refactor code phức tạp, giảm duplication, cải thiện readability |
| `debugger` | Phân tích lỗi runtime, trace stack, đề xuất fix |
| `tester` | Viết unit tests, integration tests, kiểm tra coverage |
| `researcher` | Research thư viện, API bên ngoài, tìm giải pháp kỹ thuật |
| `docs-manager` | Cập nhật tài liệu, viết README, duy trì knowledge base |
| `ui-ux-designer` | Thiết kế UI components, cải thiện UX flow, mockup |
| `brainstormer` | Brainstorm giải pháp, ý tưởng feature mới, architecture |
| `project-manager` | Theo dõi tiến độ, ưu tiên tasks, quản lý backlog |
| `git-manager` | Quản lý branches, merge strategy, conflict resolution |
| `journal-writer` | Viết dev journal, ghi chép quyết định kỹ thuật |
| `mcp-manager` | Cấu hình MCP servers, quản lý tool integrations |

### Cách gọi agent trong Claude Code
```
/agent fullstack-developer "Implement feature X theo plan phase-01"
/agent debugger "Tìm nguyên nhân lỗi sync order thất bại"
/agent code-reviewer "Review PR #42 trong module orders"
```

---

*Tài liệu này được duy trì bởi `docs-manager` agent. Khi có feature mới hoặc thay đổi API, cập nhật file này để bot luôn có thông tin chính xác.*
