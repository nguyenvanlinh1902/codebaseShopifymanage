# Shopify App Ideas for Agentic Workflow Testing (2025)

> Research compiled from Shopify App Store analysis, developer blogs, and community forums.

## Market Context

### Key Deadlines
- **August 28, 2025**: Deadline to upgrade Thank you and Order status pages
- **June 30, 2026**: Shopify Scripts final deprecation (extended from Aug 2025)
- **January 2026**: Automatic upgrades begin, checkout.liquid customizations lost

### Market Signals
- Scripts deprecation driving massive migration demand
- Only 712 apps in Customer Account Extensions category (new opportunity)
- Accessibility subcategory has only 7 apps (huge gap)
- Built for Shopify apps see 49% increase in installs within 14 days
- Average merchant uses 6 apps

---

## Tier 1: Maximum Tech Coverage (8+ Shopify Touchpoints)

### 1. Smart Tiered Discount Engine
> Create tiered, conditional discounts (buy 2 get 10% off, buy 5 get 25% off) with customer segment targeting.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Shopify Functions | Discount logic (product/order/shipping) |
| Checkout UI Extensions | Display discount progress bar |
| Metafields | Store discount configuration |
| GraphQL Admin API | Customer segments, product collections |
| Webhooks | orders/create to track usage |
| App Blocks | Storefront discount teaser |
| Embedded App | Admin UI for rule builder |
| Web Pixels | Track discount-driven conversions |

**Market Signal**: Scripts deprecation (June 2026) is driving demand for Functions-based discount apps. Many merchants need to migrate Ruby-based Scripts to modern Functions.

**Complexity**: Medium-High

---

### 2. Delivery Date Picker with Blackout Rules
> Let customers choose delivery dates, with merchant-configurable blackout dates, cutoff times, and capacity limits.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Date picker in checkout |
| Delivery Customization Function | Filter/rename delivery options |
| Cart Transform API | Add delivery date as line property |
| Metafields/Metaobjects | Store blackout dates, capacity |
| Webhooks | orders/create to decrement capacity |
| GraphQL Admin API | Order tagging, fulfillment |
| App Blocks | Show estimated delivery on PDP |
| Embedded App | Calendar management UI |

**Market Signal**: Local delivery and BOPIS demand is high. Few quality date pickers exist that leverage the new checkout extensibility.

**Complexity**: Medium-High

---

### 3. Cart Validation & Fraud Gate
> Block checkout based on rules: max quantities, product combinations, suspicious customer signals, address validation.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Cart/Checkout Validation Function | Block invalid carts |
| Payment Customization Function | Hide COD for risky orders |
| Customer Account API | Check order history |
| Metafields | Store risk rules |
| Webhooks | customers/update for risk scoring |
| Checkout UI Extensions | Show validation errors |
| Embedded App | Rule builder |
| Web Pixels | Track abandonment on validation errors |

**Market Signal**: Fraud prevention is evergreen. Combining cart rules with fraud detection is underserved. Sneaker drops and limited releases need quantity limiting.

**Complexity**: Medium

---

### 4. Complete Checkout Customizer
> All-in-one checkout customization: custom fields, trust badges, upsells, delivery options, payment rules.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Custom fields, badges, upsells |
| Cart/Checkout Validation Function | Field validation |
| Payment Customization Function | Show/hide payment methods |
| Delivery Customization Function | Filter shipping options |
| Metafields | Store configurations |
| Order Metafields | Persist custom field data |
| GraphQL Admin API | Product recommendations |
| Embedded App | Visual checkout editor |

**Market Signal**: checkout.liquid deprecation forcing merchants to rebuild customizations. Many need a no-code solution for the new extensibility framework.

**Complexity**: High

---

### 5. Loyalty Program with Customer Account Portal
> Points-based loyalty with earning rules, tier levels, and self-service redemption in customer accounts.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Customer Account UI Extensions | Points display, redemption UI |
| Discount Functions | Apply loyalty discounts at checkout |
| Checkout UI Extensions | Show points earned/redeemable |
| Metafields | Store customer points, tier |
| Webhooks | orders/create to award points |
| GraphQL Admin API | Customer data, order history |
| App Blocks | Storefront loyalty widget |
| Embedded App | Program configuration |

**Market Signal**: Customer Account Extensions launched Winter '25 - only 712 apps in category. Loyalty programs that integrate deeply with new customer accounts are underserved.

**Complexity**: High

---

## Tier 2: Strong Tech Coverage (5-7 Touchpoints)

### 6. Product Bundler with Inventory Sync
> Create bundles that auto-deduct component inventory, support mix-and-match, show savings.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Cart Transform API | Merge/expand bundle lines |
| Discount Functions | Apply bundle pricing |
| Metafields | Bundle configuration |
| GraphQL Admin API | Inventory adjustments |
| App Blocks | Bundle builder widget |
| Webhooks | orders/create for inventory sync |

**Market Signal**: Bundles are popular but few apps handle inventory correctly with Cart Transform. Component inventory sync is a pain point.

**Complexity**: Medium

---

### 7. Back-in-Stock + Wishlist Combo
> Customers save products, get notified on restock or price drops. Merchants see demand signals.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Storefront API | Customer identification |
| App Blocks | Wishlist button, notify button |
| Metafields | Store wishlist data |
| Webhooks | products/update, inventory_levels/update |
| GraphQL Admin API | Customer data, product queries |
| Embedded App | Demand analytics dashboard |

**Market Signal**: Demand intelligence is valuable. Combining wishlist with back-in-stock creates stickier merchant relationships.

**Complexity**: Medium

---

### 8. Geo-Based Shipping & Payment Rules
> Show/hide shipping methods and payment options based on customer location, cart value, or product type.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Delivery Customization Function | Filter shipping by region |
| Payment Customization Function | Hide COD for international |
| Checkout UI Extensions | Show region-specific messaging |
| Metafields | Store rules per region |
| Embedded App | Rule configuration UI |

**Market Signal**: International selling is growing. EU VAT, regional payment preferences, and shipping restrictions need better tooling.

**Complexity**: Medium

---

### 9. Subscription Add-on Manager
> Post-purchase, let customers add one-time products to their next subscription shipment.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Customer Account UI Extensions | Add-on interface |
| Subscription APIs | Modify upcoming orders |
| Webhooks | subscription_contracts/update |
| Metafields | Store add-on preferences |
| GraphQL Admin API | Product catalog queries |

**Market Signal**: Subscription apps are saturated, but add-on management for existing subscriptions is underserved. Works as companion to existing subscription apps.

**Complexity**: Medium

---

### 10. Returns & Exchange Portal
> Self-service returns with exchange options, store credit, and label generation in customer accounts.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Customer Account UI Extensions | Returns initiation, tracking |
| GraphQL Admin API | Order data, refund processing |
| Webhooks | returns/create for notifications |
| Metafields | Store return policies per product |
| Embedded App | Returns policy configuration |

**Market Signal**: Customer Account Extensions enable rich self-service. Returns reduce support tickets significantly. Few apps leverage the new extension points.

**Complexity**: Medium

---

### 11. Checkout Address Validator
> Real-time address validation at checkout with suggestions, PO box detection, and deliverability scoring.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Address suggestions UI |
| Cart/Checkout Validation Function | Block invalid addresses |
| Metafields | Store validation rules |
| GraphQL Admin API | Order tagging for flagged addresses |
| Embedded App | Configuration and analytics |

**Market Signal**: Invalid addresses cause failed deliveries and chargebacks. Few checkout-native address validators exist since extensibility is new.

**Complexity**: Medium

---

## Tier 3: Focused Apps (3-4 Touchpoints)

### 12. Smart Free Shipping Bar
> Dynamic progress bar showing "spend $X more for free shipping" with real-time cart updates.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Announcement bar component |
| Storefront API / Cart API | Read cart total |
| Metafields | Store threshold config |
| Embedded App | Settings UI |

**Market Signal**: Simple, high-impact app. Many existing apps don't use App Blocks properly or have poor UX.

**Complexity**: Low

---

### 13. Product Page Trust Badges
> Auto-inject trust badges, guarantees, shipping info below add-to-cart based on product type.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Theme App Extensions | Badge injection |
| Metafields | Badge configuration per product/collection |
| App Blocks | Drag-and-drop badge placement |
| Embedded App | Badge library management |

**Market Signal**: Trust badges increase conversions. Category-specific badges (organic, handmade, fast shipping) are underserved.

**Complexity**: Low

---

### 14. Checkout Custom Fields
> Add gift messages, PO numbers, delivery instructions to checkout with validation.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Custom input fields |
| Cart/Checkout Validation Function | Validate required fields |
| Metafields | Store field configs |
| Order Metafields | Persist custom data |

**Market Signal**: One of the most requested checkout customizations. Clean, focused implementation with validation is needed.

**Complexity**: Low-Medium

---

### 15. Accessibility Checker & Fixer
> Scan storefront for accessibility issues, provide fixes, add ARIA labels and skip links.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Theme App Extensions | Inject accessibility improvements |
| App Blocks | Accessibility widgets (font size, contrast) |
| Embedded App | Audit dashboard, issue tracker |
| Metafields | Store fix configurations |

**Market Signal**: Accessibility subcategory has only 7 apps. ADA compliance is legally required in many jurisdictions. Huge untapped market.

**Complexity**: Medium

---

## Bonus: High-Opportunity Niches

### 16. B2B Quick Order Form
> Spreadsheet-style order form for wholesale buyers with SKU lookup, quantity breaks, and fast checkout.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Storefront API | Product/variant lookup |
| Cart API | Bulk add to cart |
| Checkout UI Extensions | Show B2B pricing summary |
| Metafields | Store customer tier, pricing |
| App Blocks | Quick order form on storefront |
| Embedded App | Customer group management |

**Market Signal**: B2B on Shopify is growing. Native B2B features are Plus-only. Non-Plus merchants need B2B functionality.

**Complexity**: Medium

---

### 17. Pre-Order Manager with Deposit Collection
> Accept pre-orders with partial payment, inventory limits, and estimated ship dates.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Pre-order messaging, deposit display |
| Payment Customization Function | Split payment logic |
| Metafields | Pre-order config per product |
| Webhooks | orders/create for pre-order tracking |
| App Blocks | Pre-order button, countdown |
| Embedded App | Campaign management |

**Market Signal**: Product launches and limited drops need pre-order functionality. Deposit collection for high-value items is underserved.

**Complexity**: Medium-High

---

## Recommendation for Agentic Workflow Testing

### Best Starting Points

**For Maximum API Coverage:**
- Start with **#1 (Smart Tiered Discount Engine)** or **#4 (Complete Checkout Customizer)**
- These hit the modern Shopify stack (Functions + Checkout Extensibility)
- Clear market demand (Scripts sunset, checkout customization)
- Well-documented APIs

**For Fastest MVP:**
- **#12 (Smart Free Shipping Bar)** or **#14 (Checkout Custom Fields)**
- Focused scope, quick to build
- Still exercises modern APIs (App Blocks, Checkout Extensions)

**For Underserved Market:**
- **#15 (Accessibility Checker)** - Only 7 competitors
- **#5 (Loyalty with Customer Account Portal)** - New extension category

### Scalable Complexity Strategy

1. Build MVP with core functionality
2. Add advanced features incrementally
3. Each feature exercises different API
4. Perfect for testing agentic workflow capabilities

---

## Sources

- [Shopify Scripts Deprecation Timeline](https://changelog.shopify.com/posts/shopify-scripts-deprecation)
- [Shopify App Store Gaps Analysis](https://www.shopify.com/ca/partners/blog/shopify-app-store-downloads)
- [Checkout Extensibility Guide](https://www.shopify.com/partners/blog/checkout-extensibility)
- [Customer Account Extensions](https://www.shopify.com/blog/introducing-customer-account-extensions)
- [Scripts to Functions Migration](https://nalanetworks.com/blogs/shopify/shopify-scripts-sunset-move-to-shopify-functions-before-august-28-2025)
- [Merchant Pain Points Analysis](https://baremetrics.com/blog/top-10-shopify-merchant-pain-points-and-app-ideas-to-solve-them)
- [Built for Shopify Program](https://www.shopify.com/partners/blog/built-for-shopify-updates)
- [B2B Wholesale Solutions](https://apps.shopify.com/b2b-solution-custom-pricing)
- [Cart Transform Function API](https://shopify.dev/docs/api/functions/latest/cart-transform)
- [Cart and Checkout Validation API](https://shopify.dev/docs/api/functions/latest/cart-and-checkout-validation)
