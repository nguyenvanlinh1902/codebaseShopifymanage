Tier 1: High Coverage (8+ Shopify Tech Touchpoints)
1. Smart Tiered Discount Engine
   Create tiered, conditional discounts (buy 2 get 10% off, buy 5 get 25% off) with customer segment targeting.
   Tech AspectHow It's UsedShopify FunctionsDiscount logic (product/order/shipping)Checkout UI ExtensionsDisplay discount progress barMetafieldsStore discount configurationGraphQL Admin APICustomer segments, product collectionsWebhooksorders/create to track usageApp BlocksStorefront discount teaserEmbedded AppAdmin UI for rule builder
   Market signal: Scripts deprecation (Aug 2025) is driving demand for Functions-based discount apps.

2. Delivery Date Picker with Blackout Rules
   Let customers choose delivery dates, with merchant-configurable blackout dates, cutoff times, and capacity limits.
   Tech AspectHow It's UsedCheckout UI ExtensionsDate picker in checkoutDelivery Customization FunctionFilter/rename delivery optionsCart Transform APIAdd delivery date as line propertyMetafields/MetaobjectsStore blackout dates, capacityWebhooksorders/create to decrement capacityGraphQL Admin APIOrder tagging, fulfillmentApp BlocksShow estimated delivery on PDPEmbedded AppCalendar management UI
   Market signal: Local delivery and BOPIS demand is high, few good date pickers exist.

3. Cart Validation & Fraud Gate
   Block checkout based on rules: max quantities, product combinations, suspicious customer signals, address validation.
   Tech AspectHow It's UsedCart/Checkout Validation FunctionBlock invalid cartsPayment Customization FunctionHide COD for risky ordersCustomer Account APICheck order historyMetafieldsStore risk rulesWebhookscustomers/update for risk scoringCheckout UI ExtensionsShow validation errorsEmbedded AppRule builderWeb PixelsTrack abandonment on validation errors
   Market signal: Fraud prevention is evergreen; combining it with cart rules is underserved.

Tier 2: Medium Coverage (5-7 Touchpoints)
4. Product Bundler with Inventory Sync
   Create bundles that auto-deduct component inventory, support mix-and-match, show savings.
   Tech AspectHow It's UsedCart Transform APIMerge/expand bundle linesDiscount FunctionsApply bundle pricingMetafieldsBundle configurationGraphQL Admin APIInventory adjustmentsApp BlocksBundle builder widgetWebhooksorders/create for inventory sync

5. Back-in-Stock + Wishlist Combo
   Customers save products, get notified on restock or price drops. Merchants see demand signals.
   Tech AspectHow It's UsedStorefront APICustomer identificationApp BlocksWishlist button, notify buttonMetafieldsStore wishlist dataWebhooksproducts/update, inventory_levels/updateGraphQL Admin APICustomer data, product queriesEmail/Notification hooksTrigger notificationsEmbedded AppDemand analytics dashboard

6. Geo-Based Shipping & Payment Rules
   Show/hide shipping methods and payment options based on customer location, cart value, or product type.
   Tech AspectHow It's UsedDelivery Customization FunctionFilter shipping by regionPayment Customization FunctionHide COD for internationalCheckout UI ExtensionsShow region-specific messagingMetafieldsStore rules per regionEmbedded AppRule configuration UI

7. Order Subscription Add-on Manager
   Post-purchase, let customers add one-time products to their next subscription shipment.
   Tech AspectHow It's UsedCustomer Account UI ExtensionsAdd-on interfaceSubscription APIsModify upcoming ordersWebhookssubscription_contracts/updateMetafieldsStore add-on preferencesGraphQL Admin APIProduct catalog queries

Tier 3: Starter Apps (3-4 Touchpoints)
8. Smart Free Shipping Bar
   Dynamic progress bar showing "spend $X more for free shipping" with real-time cart updates.
   Tech AspectHow It's UsedApp BlocksAnnouncement bar componentStorefront API / Cart APIRead cart totalMetafieldsStore threshold configEmbedded AppSettings UI

9. Product Page Trust Badges
   Auto-inject trust badges, guarantees, shipping info below add-to-cart based on product type.
   Tech AspectHow It's UsedTheme App ExtensionsBadge injectionMetafieldsBadge configuration per product/collectionApp BlocksDrag-and-drop badge placementEmbedded AppBadge library management

10. Checkout Custom Fields
    Add gift messages, PO numbers, delivery instructions to checkout with validation.
    Tech AspectHow It's UsedCheckout UI ExtensionsCustom input fieldsCart/Checkout Validation FunctionValidate required fieldsMetafieldsStore field configsOrder metafieldsPersist custom data

Recommendation for Agentic Workflow Testing
For maximum coverage while staying buildable in a reasonable time:
Start with #1 (Smart Tiered Discount Engine) or #10 (Checkout Custom Fields)

Both hit the modern Shopify stack (Functions + Checkout Extensibility)
Clear market demand (Scripts sunset, checkout customization)
Well-documented APIs
Scalable complexity—start simple, add features
