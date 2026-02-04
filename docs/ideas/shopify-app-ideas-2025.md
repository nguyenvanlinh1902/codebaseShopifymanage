# Shopify App Ideas for Agentic Workflow Testing (2025-2026)

> **79 app ideas** compiled from Shopify App Store analysis, developer blogs, community forums, and technical API exploration.

| Tier | Focus | Apps |
|------|-------|------|
| Tier 1 | Maximum Tech Coverage (8+) | #1-7 |
| Tier 2 | Strong Tech Coverage (5-7) | #8-16 |
| Tier 3 | Focused Apps (3-4) | #17-22 |
| Tier 4 | AI-Powered Apps | #23-26 |
| Tier 5 | Compliance & Operations | #27-30 |
| Tier 6 | Checkout Migration | #31-33 |
| Tier 7 | Emerging Tech & Niche | #34-37 |
| Tier 8 | Small Utility Apps | #38-79 |

---

## Market Context

### Key Deadlines
- **August 28, 2025**: Deadline to upgrade Thank you and Order status pages (Plus)
- **August 26, 2026**: Deadline for non-Plus stores
- **January 2026**: Automatic upgrades begin, checkout.liquid customizations lost
- **June 30, 2026**: Shopify Scripts final deprecation (extended from Aug 2025)
- **April 2026**: Idempotency mandatory for specific mutations

### Market Signals
- Scripts deprecation driving massive migration demand
- Only 712 apps in Customer Account Extensions category (new opportunity)
- Accessibility subcategory has only 7 apps (huge gap)
- Built for Shopify apps see 49% increase in installs within 14 days
- Average merchant uses 6 apps
- 14,836 apps in store, 100-110 new apps weekly
- Marketing apps average $19,900/year; Store Design $13,500/year

### 2026 Platform Updates (Winter Edition)
- Sidekick AI agent now builds apps and creates workflows
- Universal Commerce Protocol (UCP) for agentic commerce
- Native shopping on Google surfaces (AI Mode, Gemini)
- ChatGPT integration with Instant Checkout coming
- Product variant limit increased to 2,000
- Bulk Operations API: 100MB uploads, 5 concurrent operations
- Buyer metafields in tax requests for compliance

### What Shopify Values (2025 Build Awards Insights)

Shopify's Build Awards recognize excellence based on **how developers build**, not just what they create. Key qualities:

| Quality | Description | Example App |
|---------|-------------|-------------|
| **Merchant-First** | Prioritize merchant needs over feature bloat | Locksmith (access control) |
| **Intuitive UI** | Clean, simple interfaces that don't overwhelm | Atlas Pickup Points |
| **Lightning Performance** | Fast load times, efficient operations | Checkout Links |
| **Deep Integration** | Leverage modern Shopify APIs (Functions, Extensions) | Checkout Links |
| **Focused Excellence** | Do one thing exceptionally well | Judge.me (reviews only) |
| **Flexibility + Simplicity** | Powerful features without complexity | Judge.me |

**2025 Winners & What Made Them Stand Out:**
- **Locksmith** (USA): Access control - "powerful, focused apps that integrate deeply"
- **Judge.me** (UK): Reviews - "flexibility with simplicity," sustained excellence
- **Checkout Links** (Sweden): Cart URLs - Uses checkout UI extensions + Flow templates
- **Atlas Pickup Points** (Poland): Logistics - Clean UI, robust backend

**Built for Shopify Certification Benefits:**
- 49% increase in installs within 14 days
- Exclusive promotional benefits
- Higher visibility in app store
- Priority in Sidekick app recommendations

---

## Complete Technical Inventory

### Shopify Functions (8 Types)
1. **Discount Functions** - Product, Order, Shipping discounts
2. **Delivery Customization** - Filter, rename, reorder shipping options
3. **Payment Customization** - Hide/show/reorder payment methods
4. **Cart Transform** - Merge/expand cart lines, add properties
5. **Cart/Checkout Validation** - Block checkout with custom rules
6. **Fulfillment Constraints** - Control fulfillment location assignment
7. **Local Pickup Delivery Option Generator** - Dynamic pickup options
8. **Pickup Point Delivery Option Generator** - External pickup networks

### Extension Types
- **Checkout UI Extensions** - 14+ block placements across checkout flow
- **Customer Account UI Extensions** - Order pages, profile, full-page extensions
- **Admin UI Extensions** - Actions, blocks, links across 50+ admin targets
- **Theme App Extensions** - App blocks (inline), App embed blocks (overlay)
- **POS UI Extensions** - Tiles, modals, actions for retail

### APIs & Infrastructure
- **GraphQL Admin API** - Full store management
- **Storefront API** - Headless commerce
- **Customer Account API** - Customer self-service
- **Metafields/Metaobjects** - Custom data storage
- **Webhooks** - Event-driven integrations
- **Web Pixels** - Analytics and tracking
- **App Bridge** - Embedded app framework

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

### 6. Complete Store Operations Suite
> End-to-end operational management: discounts, fulfillment, shipping rules, and analytics.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Discount Functions | Tiered pricing, BOGO, bundle discounts |
| Delivery Customization | Filter carriers by product type/region |
| Payment Customization | Hide COD for high-value orders |
| Cart Transform | Bundle line merging, gift wrap as property |
| Cart/Checkout Validation | Block hazmat + flammable combos |
| Fulfillment Constraints | Route perishables to nearest warehouse |
| Checkout UI Extensions | Progress bars, custom fields, upsells |
| Admin UI Extensions | Dashboard blocks, bulk actions |
| Theme App Extensions | Shipping estimator, discount teaser |
| Web Pixels | Conversion tracking, funnel analytics |

**Why Build**: Covers ALL 8 function types + 5 extension types. Perfect for demonstrating complete platform mastery.

**Complexity**: Very High

---

### 7. Smart Fulfillment & Delivery Orchestrator
> Intelligent order routing with pickup options, delivery scheduling, and fulfillment rules.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Delivery Customization | Filter/sort shipping by product attributes |
| Fulfillment Constraints | Route to optimal warehouse by stock/distance |
| Local Pickup Delivery Option Generator | Dynamic store pickup with capacity |
| Pickup Point Delivery Option Generator | Integrate external locker networks |
| Cart Transform | Split cart by fulfillment method |
| Checkout UI Extensions | Delivery date picker, pickup location map |
| Customer Account UI Extensions | Track pickup orders, reschedule |
| Admin UI Extensions | Fulfillment dashboard, capacity management |
| Metaobjects | Store locations, capacity, hours |
| Webhooks | orders/create to decrement capacity |

**Why Build**: Uses ALL 4 delivery-related functions. Growing BOPIS/local delivery market.

**Complexity**: High

---

## Tier 2: Strong Tech Coverage (5-7 Touchpoints)

### 8. Product Bundler with Inventory Sync
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

### 9. Back-in-Stock + Wishlist Combo
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

### 10. Geo-Based Shipping & Payment Rules
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

### 11. Subscription Add-on Manager
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

### 12. Returns & Exchange Portal
> Self-service returns with exchange options, store credit, and label generation in customer accounts.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Customer Account UI Extensions | Returns initiation, tracking |
| Customer Account Full Page | Complete returns flow |
| GraphQL Admin API | Order data, refund processing |
| Webhooks | returns/create for notifications |
| Metafields | Store return policies per product |
| Embedded App | Returns policy configuration |

**Market Signal**: Customer Account Extensions enable rich self-service. Returns reduce support tickets significantly. Few apps leverage the new extension points.

**Complexity**: Medium

---

### 13. Checkout Address Validator
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

### 14. B2B Wholesale Portal
> Complete B2B experience: quick ordering, tiered pricing, approval workflows.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Discount Functions | Customer-specific pricing tiers |
| Cart/Checkout Validation | Minimum order value, product restrictions |
| Payment Customization | Hide credit card, show NET30 for approved |
| Checkout UI Extensions | PO number field, company info |
| Customer Account UI Extensions | Order history, reorder, quotes |
| Admin UI Extensions | Customer approval workflow, pricing tiers |
| Theme App Extensions | Quick order form, catalog view |
| Metafields | Customer tier, approved status, credit limit |

**Market Signal**: Native B2B is Plus-only. Non-Plus merchants need B2B functionality.

**Complexity**: Medium-High

---

### 15. Pre-Order Manager with Deposit Collection
> Accept pre-orders with partial payment, inventory limits, and estimated ship dates.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Cart Transform | Mark line as pre-order, add expected date |
| Cart/Checkout Validation | Block if pre-order limit reached |
| Checkout UI Extensions | Pre-order messaging, deposit display |
| Payment Customization Function | Split payment logic |
| Metafields | Pre-order config per product |
| Webhooks | orders/create for pre-order tracking |
| App Blocks | Pre-order button, countdown |
| Embedded App | Campaign management |

**Market Signal**: Product launches and limited drops need pre-order functionality. Deposit collection for high-value items is underserved.

**Complexity**: Medium-High

---

### 16. Cart Intelligence Platform
> Smart cart management: validation, fraud prevention, upsells, and analytics.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Cart/Checkout Validation | Block suspicious patterns, max qty |
| Cart Transform | Auto-add warranty, gift wrap |
| Discount Functions | Smart upsell discounts |
| Checkout UI Extensions | Validation messages, upsell offers |
| Theme App Extensions | Cart drawer enhancements, progress bar |
| Web Pixels | Abandonment tracking, upsell conversion |
| Admin UI Extensions | Fraud rules builder, analytics |
| Customer Account API | Check order history for risk |

**Why Build**: Combines fraud prevention with revenue optimization. Unique positioning.

**Complexity**: Medium

---

## Tier 3: Focused Apps (3-4 Touchpoints)

### 17. Smart Free Shipping Bar
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

### 18. Product Page Trust Badges
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

### 19. Checkout Custom Fields
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

### 20. Accessibility Checker & Fixer
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

### 21. Smart Upsell Engine
> AI-powered upsells across checkout, cart, and post-purchase.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Product recommendations at checkout |
| Checkout Post-Purchase | One-click post-purchase offers |
| Cart Transform | Auto-add complementary products |
| Discount Functions | Bundle discount for upsells |
| Theme App Extensions | Frequently bought together |
| Web Pixels | Track upsell conversion |

**Why Build**: Revenue optimization always in demand. Full-funnel coverage is differentiator.

**Complexity**: Medium

---

### 22. POS-Online Unified Experience
> Bridge online and in-store: inventory visibility, clienteling, unified cart.

| Tech Aspect | How It's Used |
|-------------|---------------|
| POS UI Extensions | Customer lookup tile, online order history |
| POS Action | Send cart to customer email |
| Admin UI Extensions | Unified sales analytics |
| Theme App Extensions | Store stock checker |
| Metafields | Store locations, stock levels |
| GraphQL Admin API | Inventory across locations |

**Why Build**: POS extensions underutilized. Retail + online integration valuable.

**Complexity**: Medium

---

## Tier 4: AI-Powered Apps (Winter 2026 Opportunities)

### 23. AI Product Recommendation Engine
> Personalized product suggestions based on browsing behavior, purchase history, and customer segments using AI.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Web Pixels | Track browsing behavior, add-to-cart events |
| GraphQL Admin API | Customer data, order history, product catalog |
| Storefront API | Real-time personalization |
| App Blocks | Recommendation widgets on PDP, cart |
| Checkout UI Extensions | Cross-sell recommendations at checkout |
| Metafields | Store AI preferences, customer profiles |
| Webhooks | orders/create to train model |
| Embedded App | Analytics dashboard, AI tuning |

**Market Signal**: 80% of consumers expect tailored shopping (BCG study). AI personalization can drive 40% revenue uplift. ChatGPT/Shopify integration means AI-ready data structures are critical.

**Complexity**: High

---

### 24. AI Customer Service Agent
> GPT-powered chatbot that handles support queries, provides order status, suggests products, and escalates to humans.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Storefront API | Product queries, inventory checks |
| GraphQL Admin API | Order lookup, customer data |
| Customer Account UI Extensions | Support widget in customer portal |
| App Blocks | Chat widget on storefront |
| Metafields | Store conversation context, preferences |
| Webhooks | orders/create, fulfillments/create for proactive updates |
| Embedded App | Conversation management, training UI |

**Market Signal**: 39% of US consumers use genAI for shopping. AI chatbots reduce support tickets significantly. Few quality GPT-native Shopify chatbots exist.

**Complexity**: High

---

### 25. AI Content Generator for Products
> Generate and optimize product descriptions, SEO meta tags, and marketing copy using AI with Shopify data context.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Product data, collections, metafields |
| Metafields | Store generated content, SEO data |
| Webhooks | products/create to auto-generate content |
| Embedded App | Content editor, bulk generation UI |
| App Blocks | Show generated rich content on PDP |

**Market Signal**: SEO is a major merchant pain point. AI content generation is hot, but few apps integrate deeply with Shopify product data for context-aware generation.

**Complexity**: Medium

---

### 26. Agentic Storefront Optimizer
> Optimize product data, metafields, and catalog structure for AI agent discovery (ChatGPT, Gemini, Copilot).

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Product catalog, metafields optimization |
| Metafields/Metaobjects | Structured data for AI consumption |
| Webhooks | products/update to re-optimize |
| Embedded App | AI readiness audit, optimization suggestions |
| App Blocks | Rich structured data on storefront |

**Market Signal**: With ChatGPT and Google Gemini integration, product visibility shifts from SEO to "AI optimization." Merchants need tools to structure data for agent ranking logic.

**Complexity**: Medium

---

## Tier 5: Compliance & Operations Apps

### 27. Bot Protection & Analytics Cleaner
> Detect and block bot traffic, clean analytics data, prevent fake cart abandonment and fraudulent signups.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Web Pixels | Track and identify bot patterns |
| Checkout UI Extensions | CAPTCHA, bot challenges |
| Cart/Checkout Validation Function | Block suspicious carts |
| Webhooks | customers/create to verify accounts |
| Metafields | Store risk scores, bot fingerprints |
| GraphQL Admin API | Customer/order flagging |
| Embedded App | Analytics dashboard, rule configuration |

**Market Signal**: Bot traffic is a major operational nightmare. Bots create fake accounts, pollute analytics, trigger useless abandoned cart emails. Underserved problem area.

**Complexity**: Medium-High

---

### 28. Multi-Channel Inventory Sync
> Real-time inventory synchronization across Shopify, marketplaces, POS, and warehouses with conflict resolution.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Inventory adjustments, location management |
| Webhooks | inventory_levels/update, orders/create |
| Metafields | Store sync configuration per product |
| Embedded App | Channel management, sync dashboard |
| Background Jobs | Continuous sync processing |

**Market Signal**: Inventory sync across channels is the #1 operational pain point. Real-time visibility prevents overselling and stockouts. Few apps handle this well at scale.

**Complexity**: Medium-High

---

### 29. Chargeback Prevention & Documentation
> Proactive fraud signals, transaction documentation, and dispute evidence compilation to reduce chargebacks.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | orders/create, orders/paid for risk assessment |
| GraphQL Admin API | Order data, customer history |
| Checkout UI Extensions | Additional verification for risky orders |
| Payment Customization Function | Route risky orders to safer payment methods |
| Metafields | Store risk scores, documentation |
| Embedded App | Risk dashboard, evidence builder |

**Market Signal**: Chargebacks eat into margins. Merchants need better upfront documentation and proactive risk signals. Combines well with fraud prevention.

**Complexity**: Medium

---

### 30. CSV Import/Export Power Tool
> Advanced CSV handling with image URL support, variant management, merge/dedup logic, and rollback capability.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Bulk product operations |
| Bulk Operations API | Large-scale imports/exports |
| Metafields | Track import history, rollback data |
| Embedded App | Import wizard, mapping UI, preview |
| Background Jobs | Process large files asynchronously |

**Market Signal**: CSV management is a universal pain point. Image URLs and variants cause grief. Few tools handle complex scenarios with proper validation and rollback.

**Complexity**: Medium

---

## Tier 6: Checkout Migration Apps (Urgent Deadline)

### 31. Checkout.liquid Migration Assistant
> Analyze existing checkout.liquid customizations and migrate them to Checkout Extensibility equivalents.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Recreate custom elements |
| Cart/Checkout Validation Function | Migrate validation logic |
| Payment Customization Function | Migrate payment rules |
| Delivery Customization Function | Migrate shipping rules |
| Checkout Branding API | Migrate styling |
| Embedded App | Migration wizard, audit tool |

**Market Signal**: **CRITICAL DEADLINE**: August 2025 for Plus, August 2026 for non-Plus. Automatic upgrade in January 2026 will remove all checkout.liquid customizations. Massive migration demand.

**Complexity**: High

---

### 32. Thank You Page Builder
> No-code builder for post-purchase experiences: upsells, surveys, social sharing, order tracking widgets.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Thank you page blocks |
| Order Status Extensions | Tracking, updates |
| Web Pixels | Track post-purchase engagement |
| Metafields | Store page configurations |
| GraphQL Admin API | Product recommendations, order data |
| Embedded App | Visual page builder |

**Market Signal**: Thank You page deadline August 2025. Merchants losing their Additional Scripts customizations need replacements. Post-purchase upsells can drive 10-15% additional revenue.

**Complexity**: Medium

---

### 33. Scripts to Functions Migrator
> Automated tool to analyze Ruby-based Shopify Scripts and generate equivalent Shopify Functions code.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Discount Functions | Product, order, shipping discounts |
| Cart Transform Function | Line item modifications |
| Cart/Checkout Validation Function | Cart rules |
| Metafields | Store function configurations |
| Embedded App | Script analyzer, migration wizard |

**Market Signal**: Scripts sunset June 2026 (extended from August 2025). Massive migration demand. Automated migration tools can capture significant market share.

**Complexity**: High

---

## Tier 7: Emerging Tech & Niche Apps

### 34. Voice Commerce Assistant
> Enable voice-based product search, cart management, and order placement through smart speakers and voice interfaces.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Storefront API | Product search, cart operations |
| Customer Account API | Order history, reorder |
| Webhooks | orders/create for confirmations |
| Metafields | Store voice preferences, shortcuts |
| Embedded App | Voice skill configuration |

**Market Signal**: Voice commerce is an emerging channel. First-mover advantage in Shopify voice integration. Works well with smart home ecosystems.

**Complexity**: High

---

### 35. AR Product Visualization
> Augmented reality product previews for furniture, fashion, and home goods with Shopify product data integration.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Storefront API | Product variant data, images |
| Metafields | Store 3D model references, AR config |
| App Blocks | AR viewer widget on PDP |
| GraphQL Admin API | Product management for AR assets |
| Embedded App | 3D model upload, AR configuration |

**Market Signal**: AR shopping is trending for 2025-2026. Reduces returns for size/fit issues. Few quality Shopify AR apps exist that work seamlessly.

**Complexity**: High

---

### 36. Order Status Enhancements
> Custom order status pages with tracking, instructions, and upsells.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Thank you & order status targets |
| Customer Account UI Extensions | Enhanced order detail blocks |
| Metafields | Custom content per product type |

**Complexity**: Low

---

### 37. Admin Productivity Tools
> Quick actions, bulk operations, and shortcuts for merchants.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Admin UI Extensions | Bulk action buttons |
| Admin Block Extensions | Dashboard widgets |
| Admin Print Action | Custom packing slips |
| GraphQL Admin API | Bulk operations |

**Complexity**: Low

---

## Tier 8: Small Utility Apps (Quick Builds)

> Focused, single-purpose utilities that solve specific merchant pain points. Ideal for rapid development and testing agent capabilities.

### Product Management Utilities

#### 38. Bulk Tag Editor
> Add/remove tags across products, customers, orders by filter.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Bulk tag operations |
| Bulk Operations API | Large-scale updates |
| Embedded App | Filter UI, preview changes |

**Complexity**: Low

---

#### 39. Variant Image Matcher
> Auto-assign product images to variants by color/pattern in filename.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Image and variant management |
| Embedded App | Matching rules configuration |

**Complexity**: Low

---

#### 40. Out-of-Stock Hider
> Auto-hide products when all variants are OOS, restore when restocked.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | inventory_levels/update trigger |
| GraphQL Admin API | Product publish/unpublish |
| Metafields | Store original publish state |

**Complexity**: Low

---

#### 41. SKU Generator
> Auto-generate SKUs based on product attributes (category-color-size).

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Product/variant updates |
| Metafields | SKU pattern configuration |
| Embedded App | Pattern builder UI |

**Complexity**: Low

---

#### 42. Duplicate Product Finder
> Find and merge duplicate products by title, SKU, or barcode.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Product search and merge |
| Embedded App | Duplicate review UI |

**Complexity**: Low-Medium

---

#### 43. Product Scheduler
> Schedule products to publish/unpublish at specific times.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Product publish status |
| Metafields | Schedule configuration |
| Background Jobs | Scheduled execution |

**Complexity**: Low

---

### Order & Fulfillment Utilities

#### 44. Order Notes Enhancer
> Add structured notes, internal tags, priority flags to orders.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Admin UI Extensions | Order detail block |
| Metafields | Store enhanced notes |
| GraphQL Admin API | Order updates |

**Complexity**: Low

---

#### 45. Packing Slip Customizer
> Custom packing slip templates with product images, barcodes, messages.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Admin Print Action | Custom print templates |
| Metafields | Template configuration |
| Embedded App | Template editor |

**Complexity**: Low

---

#### 46. Reorder Button
> One-click reorder previous purchases from customer account.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Customer Account UI Extensions | Reorder button on orders |
| Storefront API | Cart operations |
| Cart API | Add items to cart |

**Complexity**: Low

---

#### 47. Order Export Scheduler
> Auto-export orders to CSV/email on schedule.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Order queries |
| Background Jobs | Scheduled exports |
| Embedded App | Schedule and format config |

**Complexity**: Low

---

#### 48. Gift Receipt Generator
> Generate gift receipts without prices for gift orders.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Admin UI Extensions | Order action button |
| Admin Print Action | Gift receipt template |
| Metafields | Gift order flag |

**Complexity**: Low

---

#### 49. Order Auto-Tagger
> Auto-tag orders based on rules (high value, first order, repeat customer).

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | orders/create trigger |
| GraphQL Admin API | Order tagging, customer lookup |
| Metafields | Tagging rules configuration |

**Complexity**: Low

---

### Storefront Widgets

#### 50. Announcement Bar Scheduler
> Schedule rotating announcement bars by date/time.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Announcement bar component |
| Metafields | Schedule and message config |
| Embedded App | Schedule management UI |

**Complexity**: Low

---

#### 51. Countdown Timer Widget
> Configurable countdown for sales, launches, shipping cutoffs.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Timer component |
| Metafields | End date, display config |

**Complexity**: Low

---

#### 52. Stock Level Display
> Show "Only X left" or stock status on PDP.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Stock indicator component |
| Storefront API | Inventory queries |
| Metafields | Display threshold config |

**Complexity**: Low

---

#### 53. Recently Viewed Products
> Track and display recently viewed products widget.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Recently viewed carousel |
| Web Pixels | Track product views |
| Storefront API | Product data |

**Complexity**: Low

---

#### 54. Size Chart Popup
> Product-specific size charts with measurement guides.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Size chart trigger button |
| Metafields | Chart data per product/collection |
| Embedded App | Chart builder |

**Complexity**: Low

---

#### 55. Estimated Delivery Date
> Show "Order in X hours for delivery by Y" on PDP.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Delivery estimate component |
| Metafields | Shipping config, cutoff times |

**Complexity**: Low

---

#### 56. FAQ Accordion
> Product-specific or global FAQ sections.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Accordion component |
| Metaobjects | FAQ content storage |
| Embedded App | FAQ management |

**Complexity**: Low

---

#### 57. Social Proof Popup
> "John from NYC just purchased..." notifications.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Theme App Extension | Popup embed |
| Webhooks | orders/create for recent orders |
| Metafields | Display configuration |

**Complexity**: Low

---

### Checkout Utilities

#### 58. Gift Wrap Option
> Add gift wrap checkbox with fee at checkout.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Gift wrap checkbox |
| Cart Transform | Add gift wrap fee |
| Metafields | Price and message config |

**Complexity**: Low-Medium

---

#### 59. Delivery Instructions Field
> Single custom field for delivery notes.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Text input field |
| Order Metafields | Persist delivery notes |

**Complexity**: Low

---

#### 60. Age Verification Gate
> Require age confirmation for restricted products.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Age confirmation UI |
| Cart/Checkout Validation Function | Block if not confirmed |

**Complexity**: Low

---

#### 61. Terms Checkbox
> Required terms acceptance with custom text/link.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Checkbox component |
| Cart/Checkout Validation Function | Require acceptance |

**Complexity**: Low

---

#### 62. Order Bump
> Single-product upsell checkbox at checkout.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Product offer checkbox |
| Cart Transform | Add bump product |
| Metafields | Bump product configuration |

**Complexity**: Low-Medium

---

#### 63. Tip/Donation Field
> Allow customers to add tip or donation at checkout.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Checkout UI Extensions | Tip selector UI |
| Cart Transform | Add tip as line item |
| Metafields | Tip options config |

**Complexity**: Low-Medium

---

### Admin Productivity

#### 64. Quick Customer Lookup
> Search customers by phone, order number, or email from any admin page.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Admin UI Extensions | Navigation search |
| GraphQL Admin API | Customer queries |

**Complexity**: Low

---

#### 65. Bulk Price Editor
> Adjust prices by percentage or amount across products/collections.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Price updates |
| Bulk Operations API | Large-scale changes |
| Embedded App | Price adjustment UI |

**Complexity**: Low

---

#### 66. Low Stock Alerts
> Email/Slack notifications when inventory drops below threshold.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | inventory_levels/update |
| Metafields | Threshold configuration |
| External API | Email/Slack integration |

**Complexity**: Low

---

#### 67. Bulk Metafield Editor
> Edit metafields across multiple products at once.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Metafield operations |
| Bulk Operations API | Large-scale updates |
| Embedded App | Spreadsheet-style editor |

**Complexity**: Low

---

#### 68. Daily Sales Summary
> Email daily/weekly sales summary to merchant.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Order/sales queries |
| Background Jobs | Scheduled reports |
| Embedded App | Report configuration |

**Complexity**: Low

---

### Marketing Utilities

#### 69. UTM Link Builder
> Generate trackable product/collection links with UTM params.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Embedded App | Link builder UI |
| Admin UI Extensions | Quick action on products |

**Complexity**: Low

---

#### 70. Exit Intent Popup
> Discount popup when user attempts to leave.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Theme App Extension | Popup embed |
| Metafields | Offer configuration |

**Complexity**: Low

---

#### 71. Email Capture Bar
> Sticky email signup bar with customizable offer.

| Tech Aspect | How It's Used |
|-------------|---------------|
| App Blocks | Signup bar component |
| Customer API | Email capture |
| Metafields | Offer text config |

**Complexity**: Low

---

#### 72. Review Request Trigger
> Auto-send review request X days after delivery.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | fulfillments/create |
| Background Jobs | Delayed email trigger |
| Metafields | Timing configuration |

**Complexity**: Low

---

### Inventory Utilities

#### 73. Inventory History Log
> Track all inventory changes with timestamps and reasons.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | inventory_levels/update |
| Metafields | History storage |
| Embedded App | History viewer |

**Complexity**: Low

---

#### 74. Negative Inventory Alert
> Alert when inventory goes negative (oversold).

| Tech Aspect | How It's Used |
|-------------|---------------|
| Webhooks | inventory_levels/update |
| GraphQL Admin API | Inventory check |
| External API | Alert notification |

**Complexity**: Low

---

#### 75. Inventory Transfer Helper
> Quickly transfer stock between locations.

| Tech Aspect | How It's Used |
|-------------|---------------|
| Admin UI Extensions | Transfer action |
| GraphQL Admin API | Inventory adjustments |

**Complexity**: Low-Medium

---

### Content Utilities

#### 76. Alt Text Generator
> Bulk generate/edit alt text for product images.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Image updates |
| Embedded App | Bulk editor UI |
| AI Integration | Optional auto-generation |

**Complexity**: Low-Medium

---

#### 77. Broken Link Checker
> Scan pages/products for broken links.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Content queries |
| Embedded App | Scan results dashboard |
| Background Jobs | Scheduled scans |

**Complexity**: Low-Medium

---

#### 78. Redirect Manager
> Bulk create/manage URL redirects.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Redirect operations |
| Embedded App | Redirect management UI |
| Bulk Operations API | Large-scale imports |

**Complexity**: Low

---

#### 79. Translation Helper
> Quick translate product fields to multiple languages.

| Tech Aspect | How It's Used |
|-------------|---------------|
| GraphQL Admin API | Translation updates |
| Metafields | Translation storage |
| Embedded App | Translation editor |
| External API | Translation service |

**Complexity**: Medium

---

### Utility Apps Summary

| Category | Apps | Best For Testing |
|----------|------|------------------|
| Product Management | #38-43 | GraphQL, Bulk Operations |
| Order & Fulfillment | #44-49 | Admin Extensions, Webhooks |
| Storefront Widgets | #50-57 | App Blocks, Metafields |
| Checkout | #58-63 | Checkout UI, Cart Transform |
| Admin Productivity | #64-68 | Admin Extensions, Background Jobs |
| Marketing | #69-72 | Theme Extensions, Webhooks |
| Inventory | #73-75 | Webhooks, Real-time Updates |
| Content | #76-79 | Bulk Operations, External APIs |

---

## Technology Coverage Matrix

| App | Functions | Checkout UI | Customer UI | Admin UI | Theme | POS | Pixels | Meta | Webhooks | GraphQL |
|-----|-----------|-------------|-------------|----------|-------|-----|--------|------|----------|---------|
| 1. Tiered Discount | 1 | Y | - | Y | Y | - | Y | Y | Y | Y |
| 5. Loyalty Platform | 1 | Y | Y | Y | Y | - | - | Y | Y | Y |
| 6. Operations Suite | 6 | Y | - | Y | Y | - | Y | Y | Y | Y |
| 7. Fulfillment | 4 | Y | Y | Y | - | - | - | Y | Y | Y |
| 4. Checkout Platform | 3 | Y | Y | Y | - | - | Y | Y | - | - |
| 14. B2B Portal | 3 | Y | Y | Y | Y | - | - | Y | - | Y |
| 15. Pre-Order | 2 | Y | Y | Y | Y | - | - | Y | Y | - |
| 16. Cart Intelligence | 2 | Y | - | Y | Y | - | Y | Y | - | - |
| 12. Returns Portal | 1 | Y | Y | Y | - | - | - | Y | Y | Y |
| 11. Subscription | 1 | - | Y | Y | - | - | - | Y | - | - |
| 20. Accessibility | - | - | - | Y | Y | - | Y | Y | - | - |
| 10. Geo-Smart | 2 | Y | - | Y | - | - | - | Y | - | - |
| 21. Upsell Engine | 2 | Y | - | - | Y | - | Y | - | - | - |
| 22. POS-Online | - | - | - | Y | Y | Y | - | Y | - | Y |
| 2. Delivery Picker | 1 | Y | - | - | - | - | - | Y | Y | - |
| 18. Trust Badges | - | Y | - | Y | - | - | - | Y | - | - |
| 17. Shipping Bar | - | - | - | Y | Y | - | - | Y | - | - |
| 36. Order Status | - | Y | Y | - | - | - | - | Y | - | - |
| 37. Admin Tools | - | - | - | Y | - | - | - | - | - | Y |

---

## Recommendations for Agentic Workflow Testing

### Best Starting Points

**For Maximum API Coverage:**
- Start with **#1 (Smart Tiered Discount Engine)** or **#4 (Complete Checkout Customizer)**
- These hit the modern Shopify stack (Functions + Checkout Extensibility)
- Clear market demand (Scripts sunset, checkout customization)
- Well-documented APIs

**For Fastest MVP:**
- **#51 (Countdown Timer)** or **#55 (Estimated Delivery Date)** - App Blocks only
- **#59 (Delivery Instructions)** - Simplest Checkout UI Extension
- **#66 (Low Stock Alerts)** - Simple webhook + notification

**For Quick Utility Apps:**
- **Storefront**: #50, #51, #52, #55, #56, #57 - All App Blocks based
- **Checkout**: #59, #60, #61 - Simple Checkout UI Extensions
- **Admin**: #44, #45, #48, #64, #69 - Admin Extensions
- **Automation**: #40, #43, #49, #66, #72 - Webhooks + Background Jobs

**For Underserved Market:**
- **#20 (Accessibility Checker)** - Only 7 competitors
- **#5 (Loyalty with Customer Account Portal)** - New extension category

**For AI/Emerging Tech:**
- **#23 (AI Product Recommendations)** or **#24 (AI Customer Service Agent)**
- Tests AI integration capabilities, API orchestration, complex state management
- High market demand, future-proof

**For Urgent Market Need:**
- **#31 (Checkout.liquid Migration)** or **#33 (Scripts to Functions Migrator)**
- Critical deadlines create urgency
- Tests code analysis and transformation capabilities

---

## Complexity Ladder for Skill Building

| Level | Apps | Skills Tested |
|-------|------|---------------|
| **Beginner** | #50, #51, #55, #70, #71 | App Blocks only, minimal backend |
| **Beginner+** | #17, #18, #19, #36, #37, #59 | App Blocks + Metafields, Basic Checkout UI |
| **Intermediate** | #40, #43, #49, #57, #66, #72 | Webhooks + simple logic, Background Jobs |
| **Intermediate+** | #8, #9, #10, #25, #30, #38, #65, #67 | GraphQL, Bulk Operations |
| **Advanced** | #1, #4, #5, #14, #31, #58, #62, #63 | Functions, Checkout Extensions, Cart Transform |
| **Expert** | #6, #7, #23, #24, #34, #35 | AI Integration, Multi-Function, Emerging Tech |

---

## Recommended Build Order for Maximum Learning

### Phase 0: Quick Wins (Days 1-3)
**Build #51 (Countdown Timer)** or **#55 (Estimated Delivery Date)**
- Pure App Blocks, minimal complexity
- Learn Theme App Extension basics
- No backend required

### Phase 1: Foundation (Week 1)
**Build #17 (Free Shipping Bar)** or **#50 (Announcement Bar Scheduler)**
- Learn Theme App Extensions with Metafields
- Add simple admin configuration
- Get comfortable with App Blocks patterns

### Phase 1.5: Simple Webhooks (Week 2)
**Build #49 (Order Auto-Tagger)** or **#66 (Low Stock Alerts)**
- Learn webhook handling
- Simple event-driven logic
- External notifications

### Phase 2: Checkout Basics (Week 3)
**Build #59 (Delivery Instructions)** or **#61 (Terms Checkbox)**
- Simplest Checkout UI Extensions
- Learn checkout extension lifecycle
- Persist data to Order Metafields

### Phase 3: Checkout + Functions (Weeks 4-5)
**Build #60 (Age Verification)** or **#19 (Checkout Custom Fields)**
- Combine Checkout UI with Validation Functions
- Learn Cart/Checkout Validation Function
- Understand blocking checkout flow

### Phase 4: Cart Transform (Week 6)
**Build #58 (Gift Wrap Option)** or **#62 (Order Bump)**
- Learn Cart Transform API
- Modify cart lines programmatically
- Combine with Checkout UI

### Phase 5: Customer Experience (Weeks 7-8)
**Build #46 (Reorder Button)** or **#12 (Returns Portal)**
- Master Customer Account UI Extensions
- Learn full-page extensions
- Understand customer-facing flows

### Phase 6: Advanced Integration (Weeks 9-10)
**Build #5 (Loyalty Platform)** or **#7 (Fulfillment)**
- Combine all learned technologies
- Implement omnichannel features
- Master complex workflows

---

## Quick Reference: Function Types Usage

| Function Type | Best For |
|---------------|----------|
| **Discount** | Tiered pricing, BOGO, loyalty, bundles |
| **Delivery Customization** | Filter carriers, regional rules, product restrictions |
| **Payment Customization** | Hide COD, show B2B payment, fraud rules |
| **Cart Transform** | Bundles, gift wrap, line properties, auto-add |
| **Cart/Checkout Validation** | Max qty, product combos, address rules, fraud |
| **Fulfillment Constraints** | Warehouse routing, perishable handling |
| **Local Pickup Generator** | Store pickup with capacity, hours |
| **Pickup Point Generator** | Locker networks, external pickup partners |

---

## Sources

### Official Documentation
- [Shopify Functions Reference](https://shopify.dev/docs/api/functions)
- [Checkout UI Extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [Customer Account UI Extensions](https://shopify.dev/docs/api/customer-account-ui-extensions)
- [Admin UI Extensions](https://shopify.dev/docs/api/admin-extensions)
- [Theme App Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions)
- [Web Pixels](https://shopify.dev/docs/apps/marketing/pixels)
- [POS UI Extensions](https://shopify.dev/docs/api/pos-ui-extensions)
- [Shopify Changelog](https://shopify.dev/changelog)

### Market Research
- [2025 Shopify Build Awards](https://www.shopify.com/in/partners/blog/2025-shopify-build-awards)
- [Shopify Scripts Deprecation Timeline](https://changelog.shopify.com/posts/shopify-scripts-deprecation)
- [Shopify App Store Gaps Analysis](https://www.shopify.com/ca/partners/blog/shopify-app-store-downloads)
- [Checkout Extensibility Guide](https://www.shopify.com/partners/blog/checkout-extensibility)
- [Customer Account Extensions](https://www.shopify.com/blog/introducing-customer-account-extensions)
- [Merchant Pain Points Analysis](https://baremetrics.com/blog/top-10-shopify-merchant-pain-points-and-app-ideas-to-solve-them)
- [Built for Shopify Program](https://www.shopify.com/partners/blog/built-for-shopify-updates)
- [Shopify App Store Statistics 2025](https://uptek.com/shopify-statistics/app-store/)
- [21 Merchant Pain Points 2025](https://mktclarity.com/blogs/news/pain-points-shopify-users)
- [Is Shopify App Business Worth It](https://mktclarity.com/blogs/news/shopify-app-worth-it)

### Winter 2026 & AI Commerce
- [Shopify Winter 2026 Edition](https://www.shopify.com/editions/winter2026)
- [AI-native Winter '26 Edition](https://www.shopify.com/news/winter-26-edition-dev)
- [ChatGPT Shopify Integration](https://www.shopify.com/news/ai-commerce-at-scale)
- [OpenAI Agentic Commerce Protocol](https://openai.com/index/buy-it-in-chatgpt/)
- [Future Trends in Shopify App Development](https://theshopninjas.com/blog/future-trends-in-shopify-app-development-in-2025-2026/)
- [GPT Chatbot Apps for Shopify](https://www.eesel.ai/blog/best-gpt-chatbot-apps-that-integrate-with-shopify)

### Migration Guides
- [Scripts to Functions Migration](https://nalanetworks.com/blogs/shopify/shopify-scripts-sunset-move-to-shopify-functions-before-august-2025)
- [Checkout Extensibility Deadline Guide](https://www.digitalposition.com/resources/blog/ppc/shopify-checkout-extensibility-deadline-august-28-2025-is-coming-heres-how-to-not-screw-it-up/)
- [Checkout Upgrade Guide](https://www.flatlineagency.com/blog/shopify-checkout-upgrade-2025/)
