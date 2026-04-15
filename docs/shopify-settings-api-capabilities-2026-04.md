# Shopify Admin GraphQL API 2026-04 Settings Capabilities

**Document Version:** 2026-04-14  
**API Version:** Shopify Admin GraphQL API 2026-04 (Latest)  
**API Endpoint:** `https://{store_name}.myshopify.com/admin/api/2026-04/graphql.json`

---

## Overview

This document provides a comprehensive mapping of ALL 19 settings tabs available in Shopify Admin, specifying exactly which fields can be **READ** (via GraphQL queries) and which can be **WRITTEN** (via GraphQL mutations) in the 2026-04 API version. Each section includes required access scopes, limitations, and deprecation notes.

**Key Definitions:**
- **READ ONLY**: Field is queryable but not modifiable via API
- **WRITE**: Field can be modified via mutation
- **COMPUTED**: Field is calculated by Shopify and not directly writable

---

## Tab 1: General Settings

### Shop Business Information

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Store Name** | `shop.name` | ✓ | ✗ | `read_shop_info` | No mutation available to change shop name via API |
| **Store Description** | `shop.description` | ✓ | ✗ | `read_shop_info` | Meta description for SEO |
| **Owner Name** | `shop.shopOwnerName` | ✓ | ✗ | `read_shop_info` | Read-only |
| **Contact Email** | `shop.contactEmail` | ✓ | ✗ | `read_shop_info` | Public-facing contact email |
| **Owner Email** | `shop.email` | ✓ | ✗ | `read_shop_info` | Shop owner's email |
| **Shop Address** | `shop.shopAddress` (ShopAddress object) | ✓ | ✗ | `read_shop_info` | Visible to customers; includes street, city, country, ZIP |
| **Myshopify Domain** | `shop.myshopifyDomain` | ✓ | ✗ | `read_shop_info` | .myshopify.com domain name |
| **Online Store URL** | `shop.url` | ✓ | ✗ | `read_shop_info` | Shop's online store URL |
| **Setup Required** | `shop.setupRequired` | ✓ | ✗ | `read_shop_info` | Boolean indicating outstanding setup steps |
| **Created At** | `shop.createdAt` | ✓ | ✗ | `read_shop_info` | Timestamp |
| **Updated At** | `shop.updatedAt` | ✓ | ✗ | `read_shop_info` | Timestamp |

**Mutation Summary:** NO mutations available for general shop info. Name, description, and address can only be modified via Shopify Admin UI.

---

## Tab 2: Plan Settings

### Billing Plan & Subscription

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Plan Display Name** | `shop.plan.publicDisplayName` | ✓ | ✗ | `read_shop_info` | e.g., "Shopify", "Plus", "Partner Development" |
| **Shopify Plus** | `shop.plan.shopifyPlus` | ✓ | ✗ | `read_shop_info` | Boolean flag |
| **Partner Development** | `shop.plan.partnerDevelopment` | ✓ | ✗ | `read_shop_info` | Boolean flag |
| **Display Name** | `shop.plan.displayName` | ✓ | ✗ | `read_shop_info` | DEPRECATED field |

**Mutation Summary:** NO mutations available. Plan upgrade/downgrade must be handled outside API via Shopify admin or support.

**Limitation:** Plan information is READ-ONLY in GraphQL API.

---

## Tab 3: Billing Settings

### App Billing & Charges

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **App Subscriptions** | `currentAppInstallation.appSubscriptions` | ✓ | ✗ | `read_app_subscriptions` | Query active billing subscriptions for current app |
| **Create App Subscription** | N/A | N/A | ✓ | `write_app_subscriptions` | **Mutation:** `appSubscriptionCreate` |
| **Billing Attempt** | N/A | N/A | ✓ | `write_billing` | **Mutation:** `subscriptionBillingAttemptCreate` - charges SubscriptionContract |
| **Bulk Charge** | N/A | N/A | ✓ | `write_billing` | **Mutation:** `subscriptionBillingCycleBulkCharge` - asynchronously charge multiple billing cycles |

**appSubscriptionCreate Mutation Input:**
```graphql
input AppSubscriptionInput {
  lineItems: [AppSubscriptionLineItemInput!]!  # Pricing structure
  name: String!                                  # Subscription name
  returnUrl: String!                             # Return after purchase
  trialDays: Int                                # Optional trial period
  test: Boolean                                 # Test charge flag
}
```

**Return:** `AppSubscription` object with subscription details, current phase, pricing, and contract reference.

**Limitations:**
- Can only be called by app installations
- Merchant must approve billing before activation
- Usage-based pricing supported via usage records

---

## Tab 4: Users (Staff & Permissions)

### Staff Members & Access Control

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Staff Members List** | `staffMembers` query | ✓ | ✗ | `read_users` | Returns paginated list of staff accounts |
| **Staff Member Details** | `staffMember` query (by ID) | ✓ | ✗ | `read_users` | Individual staff member record |
| **Staff Name** | `staffMember.firstName`, `.lastName` | ✓ | ✗ | `read_users` | Full name |
| **Email** | `staffMember.email` | ✓ | ✗ | `read_users` | Staff email address |
| **Active Status** | `staffMember.active` | ✓ | ✗ | `read_users` | Boolean - is staff member active |
| **Account Owner** | `shop.accountOwner` (StaffMember) | ✓ | ✗ | `read_users` | Reference to shop account owner |
| **Permissions** | `staffMember.staffPermissions` (enum array) | ✓ | ✗ | `read_users` | Permissions list: `MANAGE_APPS`, `MANAGE_ORDERS`, `MANAGE_CUSTOMERS`, etc. |

**Available StaffMemberPermissions Enum Values:**
- `MANAGE_APPS`
- `MANAGE_BILLING`
- `MANAGE_CUSTOMERS`
- `MANAGE_DISCOUNTS`
- `MANAGE_GIFT_CARDS`
- `MANAGE_INVENTORY`
- `MANAGE_MARKETING`
- `MANAGE_ONLINE_STORE`
- `MANAGE_ORDERS`
- `MANAGE_PAGES`
- `MANAGE_PRODUCTS`
- `MANAGE_STAFF`
- `MANAGE_THEMES`
- `VIEW_ANALYTICS`
- `VIEW_REPORTS`

**Mutation Summary:** NO mutations available for staff management in GraphQL API 2026-04.

**Limitation:** Staff invitation, role assignment, and deactivation must be managed via Shopify Admin UI. GraphQL API only supports querying existing staff configuration.

---

## Tab 5: Payments Settings

### Payment Gateway Configuration

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Supported Digital Wallets** | `shop.paymentSettings.supportedDigitalWallets` | ✓ | ✗ | `read_payments` | Array of DigitalWallet enum (APPLE_PAY, GOOGLE_PAY, etc.) |
| **Shopify Payments Account** | `shopifyPaymentsAccount` query | ✓ | ✗ | `read_payments` | Account info for Shopify Payments merchants |
| **Payout Status** | `shopifyPaymentsAccount.payoutStatus` | ✓ | ✗ | `read_payments` | Current payout schedule status |

**Shopify Payments Account Fields (Read-Only):**
- `id`, `type`
- `balance` (by currency code)
- `payoutStatus`, `payoutSchedule`
- `transactionFee`

**Mutation Summary:** NO mutations available for payment settings.

**Limitation:** Payment gateway setup, webhook configuration, and payout settings are managed outside GraphQL API.

---

## Tab 6: Checkout Settings

### Checkout Configuration & Branding

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|-------|---|-------|
| **Checkout Profile** | `checkoutProfile` query | ✓ | ✗ | `read_checkout` | Current checkout configuration |
| **Branding Settings** | `checkoutBranding` query | ✓ | ✗ | `read_checkout` | Design system and customizations |
| **Update Branding** | N/A | N/A | ✓ | `write_checkout_branding` | **Mutation:** `checkoutBrandingUpsert` |
| **Favicon** | `checkoutBranding.designSystem` | ✓ | ✗ | `read_checkout` | Part of design system |
| **Logo** | `checkoutBranding.customizations` | ✓ | ✗ | `read_checkout` | Header/section logo |
| **Colors** | `checkoutBranding.designSystem.colorRole` | ✓ | ✓ | `write_checkout_branding` | Via `checkoutBrandingUpsert` |
| **Typography** | `checkoutBranding.designSystem.typography` | ✓ | ✓ | `write_checkout_branding` | Font scales via mutation |

**checkoutBrandingUpsert Mutation Input:**
```graphql
input CheckoutBrandingInput {
  designSystem: CheckoutBrandingDesignSystemInput  # Colors, typography, spacing
  customizations: [CheckoutBrandingCustomizationInput!]  # UI-specific overrides
}
```

**Required Scope:** `write_checkout_branding`

**Limitation:** PLUS plan or Development store only. Deprecated in favor of newer checkout APIs.

**SMS/Email Marketing:**

| Field | Read | Write | Scope |
|-------|------|-------|-------|
| `shop.marketingSmsConsentEnabledAtCheckout` | ✓ | ✗ | `read_shop_info` |
| `shop.transactionalSmsDisabled` | ✓ | ✗ | `read_shop_info` |

**Mutation Summary:** Checkout branding writable via `checkoutBrandingUpsert`. Marketing SMS settings are READ-ONLY.

---

## Tab 7: Customer Accounts Settings

### Customer Account Requirements

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Account Requirement** | `shop.customerAccounts` | ✓ | ✗ | `read_shop_info` | Enum: REQUIRED, OPTIONAL, DISABLED |
| **Customer Accounts V2** | `shop.customerAccountsV2` | ✓ | ✗ | `read_shop_info` | New account system configuration |

**Mutation Summary:** NO mutations available for customer account settings.

**Customer Marketing Consent (Individual):**

| Sub-section | Mutation | Write Scope | Input | Notes |
|------------|----------|------------|-------|-------|
| **Email Marketing Consent** | `customerEmailMarketingConsentUpdate` | `write_customers` | CustomerEmailMarketingConsentUpdateInput | Updates customer's email marketing state |
| **SMS Marketing Consent** | `customerSmsMarketingConsentUpdate` | `write_customers` | CustomerSmsMarketingConsentUpdateInput | Updates customer's SMS marketing state |

**Valid Marketing States (Settable):**
- `SUBSCRIBED`
- `UNSUBSCRIBED`
- `PENDING`

**Read-Only States (Cannot be set via mutation):**
- `NOT_SUBSCRIBED`
- `REDACTED`
- `INVALID`

**Mutation Input Examples:**
```graphql
mutation {
  customerEmailMarketingConsentUpdate(input: {
    customerId: "gid://shopify/Customer/123"
    emailMarketingConsent: {
      marketingState: SUBSCRIBED
      marketingOptInLevel: SINGLE_OPT_IN  # or CONFIRMED_OPT_IN
      consentCollectedFrom: "ADMIN" # CHECKOUT, ADMIN, OTHER
    }
  }) {
    customer { id email }
    userErrors { field message }
  }
}
```

---

## Tab 8: Shipping and Delivery Settings

### Shipping Zones & Rates

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Delivery Profiles** | `deliveryProfiles` query | ✓ | ✗ | `read_shipping` | List of shipping configurations |
| **Profile Name** | `deliveryProfile.name` | ✓ | ✓ | `write_shipping` | Via `deliveryProfileUpdate` mutation |
| **Create Profile** | N/A | N/A | ✓ | `write_shipping` | **Mutation:** `deliveryProfileCreate` |
| **Update Profile** | N/A | N/A | ✓ | `write_shipping` | **Mutation:** `deliveryProfileUpdate` |
| **Delete Profile** | N/A | N/A | ✓ | `write_shipping` | Via `deliveryProfileUpdate` with delete flags |
| **Shipping Zones** | `deliveryProfile.locationGroupsToCreate` | ✓ | ✓ | `write_shipping` | Define zones (countries/provinces) per location |
| **Shipping Rates** | `deliveryZone.shippingMethods` | ✓ | ✓ | `write_shipping` | Rates, conditions, services |
| **Fulfillment Services** | `shop.fulfillmentServices` | ✓ | ✗ | `read_shipping` | Installed fulfillment providers |
| **Location Groups** | `deliveryProfile.locationGroups` | ✓ | ✓ | `write_shipping` | Locations with zone/rate definitions |
| **Countries in Zones** | `shop.countriesInShippingZones` | ✓ | ✗ | `read_shop_info` | List of countries with zones defined |

**deliveryProfileCreate Mutation Input:**
```graphql
input DeliveryProfileInput {
  name: String!
  locationGroupsToCreate: [DeliveryLocationGroupInput!]
    # Each group includes locations and zones with rates
}
```

**deliveryProfileUpdate Mutation Input:**
```graphql
input DeliveryProfileInput {
  locationGroupsToCreate: [DeliveryLocationGroupInput!]
  locationGroupsToUpdate: [DeliveryLocationGroupInput!]
  locationGroupsToDelete: [ID!]
  # Plus zone and shipping method updates
}
```

**Required Scopes:**
- `write_shipping` OR `manage_delivery_settings` user permission
- `read_shipping` for queries

---

## Tab 9: Taxes and Duties Settings

### Tax Configuration

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Taxes Included** | `shop.taxesIncluded` | ✓ | ✗ | `read_shop_info` | Boolean - prices include tax |
| **Tax Shipping** | `shop.taxShipping` | ✓ | ✗ | `read_shop_info` | Boolean - tax applied to shipping |
| **Tax Jurisdictions** | N/A (via REST) | N/A | N/A | `write_tax_services` | GraphQL tax APIs are limited |

**Mutations Available:**

| Mutation | Purpose | Scope | Notes |
|----------|---------|-------|-------|
| `companyLocationTaxSettingsUpdate` | B2B location tax config | `write_companies` | Updates tax exemptions/settings per company location |
| `customerAddTaxExemptions` | Customer tax exemptions | `write_customers` | Add tax-exempt status to customers |

**Limitation:** Comprehensive tax configuration (jurisdiction-specific rates, integration with tax providers) requires REST API or admin UI. GraphQL supports customer/location tax exemptions only.

---

## Tab 10: Locations Settings

### Inventory Locations

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Location List** | `locations` query | ✓ | ✗ | `read_locations` | All inventory locations |
| **Location Name** | `location.name` | ✓ | ✓ | `write_locations` | Via `locationEdit` mutation |
| **Address** | `location.address` (Address object) | ✓ | ✓ | `write_locations` | Via `locationEdit` |
| **Create Location** | N/A | N/A | ✓ | `write_locations` | **Mutation:** `locationAdd` |
| **Edit Location** | N/A | N/A | ✓ | `write_locations` | **Mutation:** `locationEdit` |
| **Activate/Deactivate** | `location.isActive` | ✓ | ✗ | `read_locations` | Status is read-only; toggle via mutation optional flags |
| **Fulfills Online Orders** | `location.fulfillsOnlineOrders` | ✓ | ✓ | `write_locations` | Via `locationAdd`/`locationEdit` |
| **Metafields** | `location.metafield`, `.metafields` | ✓ | ✓ | `write_locations` | Via `metafieldsSet` mutation |

**locationAdd Mutation Input:**
```graphql
input LocationAddInput {
  name: String!
  address: AddressInput!  # Country code required
  fulfillsOnlineOrders: Boolean
  metafields: [MetafieldsSetInput!]  # Optional
}
```

**locationEdit Mutation Input:**
```graphql
input LocationEditInput {
  name: String
  address: AddressInput
  fulfillsOnlineOrders: Boolean
}
```

**Required Scope:** `write_locations`

**Note:** Timezone cannot be set via location mutations; it's inherited from shop settings.

---

## Tab 11: Apps Settings

### Installed Apps & Access Management

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Installed Apps** | `appInstallations` query | ✓ | ✗ | `read_apps` | List all installed apps |
| **Current App** | `currentAppInstallation` query | ✓ | ✗ | `read_app_subscriptions` | Info for currently authenticated app |
| **App ID** | `appInstallation.app.id` | ✓ | ✗ | `read_apps` | Global app identifier |
| **App Title** | `appInstallation.app.title` | ✓ | ✗ | `read_apps` | App name |
| **Granted Scopes** | `appInstallation.accessScopes` | ✓ | ✗ | `read_app_subscriptions` | List of granted OAuth scopes |
| **Uninstall App** | N/A | N/A | ✓ | `write_app_subscriptions` | **Mutation:** `appUninstall` |
| **Revoke Access Scopes** | N/A | N/A | ✓ | `write_app_subscriptions` | **Mutation:** `appRevokeAccessScopes` |

**appUninstall Mutation Input:**
```graphql
mutation {
  appUninstall(input: {}) {
    appInstallation { id }
    deletedAppInstallationId: ID
    userErrors { field message }
  }
}
```

**appRevokeAccessScopes Mutation Input:**
```graphql
mutation {
  appRevokeAccessScopes(input: {
    scopes: ["read_orders", "write_products"]
  }) {
    appInstallation { accessScopes { handle } }
    userErrors { field message }
  }
}
```

**Access Scope Format:** `{action}_{resource}` (e.g., `read_orders`, `write_products`)

**Mutation Summary:** Limited app management via GraphQL. Full app installation, permission requests, and configuration require REST API or Shopify App CLI.

---

## Tab 12: Sales Channels Settings

### Sales Channel Configuration

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Installed Channels** | `channelDefinitionsForInstalledChannels` | ✓ | ✗ | `read_channels` | Active sales channel configurations |
| **Available Channels** | `availableChannelApps` | ✓ | ✗ | `read_channels` | Uninstalled channels available for installation |
| **Channel Publication** | `publication` query | ✓ | ✗ | `read_products` | Products published to channels |
| **Publish to Channel** | N/A | N/A | ✓ | `write_products` | **Mutation:** `publishablePublish` |
| **Unpublish from Channel** | N/A | N/A | ✓ | `write_products` | **Mutation:** `publishableUnpublish` |

**Mutation Summary:** GraphQL supports product publication to channels but not channel installation/setup. Channel management requires admin UI or REST API.

**Limitation:** Sales channel app installation and configuration via API is not available in 2026-04 GraphQL.

---

## Tab 13: Domains Settings

### Primary Domain & Associated Domains

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Primary Domain** | `shop.primaryDomain` (Domain object) | ✓ | ✗ | `read_shop_info` | Main store domain |
| **Domain Host** | `primaryDomain.host` | ✓ | ✗ | `read_shop_info` | e.g., "example.com" |
| **Domain URL** | `primaryDomain.url` | ✓ | ✗ | `read_shop_info` | Full HTTPS URL |
| **SSL Enabled** | `primaryDomain.sslEnabled` | ✓ | ✗ | `read_shop_info` | Boolean |
| **Additional Domains** | `domains` query | ✓ | ✗ | `read_shop_info` | List all domains for shop |
| **Domain Localization** | `domain.localization` (DomainLocalization) | ✓ | ✗ | `read_shop_info` | Locale/market mapping |

**Domain Object Fields (All Read-Only):**
```graphql
type Domain {
  host: String!           # Domain name
  id: ID!                 # Global ID
  localization: DomainLocalization  # Market mappings
  marketWebPresence: MarketWebPresence  # Publishing status
  sslEnabled: Boolean!    # SSL certificate status
  url: URL!              # Full URL
}
```

**Mutation Summary:** NO mutations available for domain management.

**Limitation:** Domain purchase, configuration, and setup must be done via Shopify Admin UI or support. GraphQL API is READ-ONLY for domains.

---

## Tab 14: Customer Events Settings

### Customer Data & Privacy Events

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Customer Tags** | `shop.customerTags` (StringConnection) | ✓ | ✗ | `read_customers` | List of tags used on customers |
| **Order Tags** | `shop.orderTags` (StringConnection) | ✓ | ✗ | `read_orders` | Tags applied to orders |
| **Event Logging** | `events` query | ✓ | ✗ | `read_analytics` | Admin activity log |
| **Event Type** | `event.createdAt`, `.occurredAt` | ✓ | ✗ | `read_analytics` | Timestamps and metadata |

**Mutation Summary:** NO mutations for configuring customer event tracking via GraphQL.

**Limitation:** Customer event configuration, retention policies, and export settings require admin UI. GraphQL provides read access to events and tags only.

---

## Tab 15: Notifications Settings

### Notification Preferences & Webhooks

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Webhook Subscriptions** | `webhookSubscriptions` query | ✓ | ✗ | `read_webhooks` | Configured webhook endpoints |
| **Create Webhook** | N/A | N/A | ✓ | `write_webhooks` | **Mutation:** `webhookSubscriptionCreate` |
| **Update Webhook** | N/A | N/A | ✓ | `write_webhooks` | **Mutation:** `webhookSubscriptionUpdate` |
| **Webhook Topic** | `webhookSubscription.topic` (WebhookSubscriptionTopic enum) | ✓ | ✓ | `write_webhooks` | Via mutation |
| **Webhook URI** | `webhookSubscription.uri` | ✓ | ✓ | `write_webhooks` | Endpoint URL or Pub/Sub/EventBridge |
| **Webhook Filter** | `webhookSubscription.filter` | ✓ | ✓ | `write_webhooks` | GraphQL search syntax for event filtering |
| **Metafield Namespaces** | `webhookSubscription.metafieldNamespaces` | ✓ | ✓ | `write_webhooks` | Metafield data to include in payload |
| **Include Fields** | `webhookSubscription.includeFields` | ✓ | ✓ | `write_webhooks` | Which resource fields to include |

**Available Webhook Endpoint Types:**
- HTTPS URL
- Google Pub/Sub topic
- AWS EventBridge

**Example Webhook Topics:**
- `ORDERS_CREATE`, `ORDERS_UPDATE`, `ORDERS_DELETE`
- `PRODUCTS_CREATE`, `PRODUCTS_UPDATE`, `PRODUCTS_DELETE`
- `CUSTOMERS_CREATE`, `CUSTOMERS_UPDATE`, `CUSTOMERS_DELETE`
- `METAOBJECTS_CREATE`, `METAOBJECTS_UPDATE`, `METAOBJECTS_DELETE`
- `APP_UNINSTALLED`
- Plus 50+ more topics

**webhookSubscriptionCreate Mutation Input:**
```graphql
input WebhookSubscriptionInput {
  uri: URL!              # HTTPS, Pub/Sub, or EventBridge URI
  filter: String         # Optional search syntax filter
  metafieldNamespaces: [String!]  # Optional metafield namespaces
  includeFields: [String!]        # Optional field list
}

mutation {
  webhookSubscriptionCreate(topic: ORDERS_CREATE, webhookSubscription: {
    uri: "https://example.com/webhook"
    filter: "status:paid"
  }) {
    webhookSubscription { id topic uri }
    userErrors { field message }
  }
}
```

**Mutation Summary:** Webhooks fully writable via `webhookSubscriptionCreate` and `webhookSubscriptionUpdate`. Topic, URI, filters, and field inclusion all configurable.

---

## Tab 16: Metafields and Metaobjects Settings

### Custom Fields and Data Models

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Metafields** | `metafields` query (on any resource) | ✓ | ✓ | Resource-specific | Key-value custom data |
| **Create Metafield** | N/A | N/A | ✓ | `write_metafields` | **Mutation:** `metafieldsSet` |
| **Metafield Definitions** | `metafieldDefinitions` query | ✓ | ✓ | `write_metafield_definitions` | Schema definitions |
| **Create Definition** | N/A | N/A | ✓ | `write_metafield_definitions` | **Mutation:** `metafieldDefinitionCreate` |
| **Update Definition** | N/A | N/A | ✓ | `write_metafield_definitions` | **Mutation:** `metafieldDefinitionUpdate` |
| **Metaobjects** | `metaobjects` query | ✓ | ✓ | `write_metaobjects` | Custom data containers |
| **Create Metaobject** | N/A | N/A | ✓ | `write_metaobjects` | **Mutation:** `metaobjectCreate` |
| **Update Metaobject** | N/A | N/A | ✓ | `write_metaobjects` | **Mutation:** `metaobjectUpdate` |
| **Metaobject Definitions** | `metaobjectDefinitions` query | ✓ | ✓ | `write_metaobject_definitions` | Custom object schemas |
| **Create Metaobject Definition** | N/A | N/A | ✓ | `write_metaobject_definitions` | **Mutation:** `metaobjectDefinitionCreate` |

**metafieldsSet Mutation Input:**
```graphql
input MetafieldsSetInput {
  key: String!           # Metafield key
  namespace: String!     # Namespace (e.g., "custom")
  ownerId: ID!          # Resource being modified
  type: String!         # Data type (json, single_line_text, etc.)
  value: String!        # JSON-encoded value
  compareDigest: String # Optional for compare-and-set
}

mutation {
  metafieldsSet(input: [{
    namespace: "custom"
    key: "color"
    value: "\"blue\""
    type: "single_line_text"
    ownerId: "gid://shopify/Product/123"
  }]) {
    metafields { id namespace key value }
    userErrors { field message }
  }
}
```

**metafieldDefinitionCreate Mutation Input:**
```graphql
input MetafieldDefinitionInput {
  namespace: String!
  key: String!
  name: String!
  description: String
  type: String!        # json, single_line_text, rich_text_string, etc.
  ownerType: MetafieldOwnerType!  # PRODUCT, CUSTOMER, ORDER, SHOP, etc.
  validations: [MetafieldValidationInput!]
}
```

**Supported Metafield Types:**
- `single_line_text`, `multi_line_text`, `rich_text_string`
- `json`
- `integer`, `decimal`
- `url`, `date`, `date_time`
- `boolean`
- `color`, `rating`
- `dimension`, `weight`, `volume`
- `product_reference`, `file_reference`

**Mutation Summary:** Metafields and metaobjects fully writable. Can set on shop, products, customers, orders, and custom metaobjects.

---

## Tab 17: Languages Settings

### Localization & Multi-language Support

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Shop Locales** | `shopLocales` query | ✓ | ✗ | `read_locales` | Active and available locales |
| **Shop Locale Name** | `shopLocale.name` | ✓ | ✓ | `write_locales` | Via `shopLocaleUpdate` |
| **Locale Code** | `shopLocale.locale` (e.g., "fr") | ✓ | ✗ | `read_locales` | ISO language code |
| **Primary Locale** | `shopLocale.primary` | ✓ | ✗ | `read_locales` | Boolean - is shop primary language |
| **Published Status** | `shopLocale.published` | ✓ | ✓ | `write_locales` | Via `shopLocaleUpdate` |
| **Update Locale** | N/A | N/A | ✓ | `write_locales` | **Mutation:** `shopLocaleUpdate` |
| **Translations** | `translations` (on resource) | ✓ | ✓ | `write_translations` | Translated content |
| **Register Translations** | N/A | N/A | ✓ | `write_translations` | **Mutation:** `translationsRegister` |
| **Translation Locale** | `translation.locale` | ✓ | ✗ | `read_translations` | Locale of translation |

**shopLocaleUpdate Mutation Input:**
```graphql
input ShopLocaleInput {
  name: String        # Display name (e.g., "Français")
  published: Boolean  # Publish/unpublish for translation
}

mutation {
  shopLocaleUpdate(input: { locale: "fr", shopLocale: { 
    published: true 
  }}) {
    shopLocale { name locale published }
    userErrors { field message }
  }
}
```

**translationsRegister Mutation Input:**
```graphql
input TranslationsRegisterInput {
  resourceId: ID!     # Resource being translated
  translations: [TranslationInput!]  # Translations by locale
}

mutation {
  translationsRegister(input: {
    resourceId: "gid://shopify/Product/123"
    translations: [{
      locale: "fr"
      key: "title"
      value: "Produit Français"
    }]
  }) {
    translations { locale key value }
    userErrors { field message }
  }
}
```

**Limitations:**
- Max 20 alternate published locales per shop
- PublishedTranslation type DEPRECATED (use Translation instead)
- Locale must be enabled before publishing

**Mutation Summary:** Locales and translations fully writable via `shopLocaleUpdate` and `translationsRegister`.

---

## Tab 18: Customer Privacy Settings

### Data Privacy & Compliance

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Email Marketing Consent** | `customer.emailMarketingConsent` | ✓ | ✓ | `write_customers` | Via `customerEmailMarketingConsentUpdate` |
| **SMS Marketing Consent** | `customer.smsMarketingConsent` | ✓ | ✓ | `write_customers` | Via `customerSmsMarketingConsentUpdate` |
| **Marketing State** | `marketingConsent.marketingState` | ✓ | ✓ | `write_customers` | SUBSCRIBED, UNSUBSCRIBED, PENDING |
| **Opt-in Level** | `marketingConsent.marketingOptInLevel` | ✓ | ✓ | `write_customers` | SINGLE_OPT_IN or CONFIRMED_OPT_IN |
| **Consent Collected From** | `marketingConsent.consentCollectedFrom` | ✓ | ✓ | `write_customers` | CHECKOUT, ADMIN, OTHER |
| **Consent Collected At** | `marketingConsent.consentCollectedAt` | ✓ | ✓ | `write_customers` | Timestamp of consent |

**Customer Email Marketing Consent Mutation:**
```graphql
mutation {
  customerEmailMarketingConsentUpdate(input: {
    customerId: "gid://shopify/Customer/123"
    emailMarketingConsent: {
      marketingState: SUBSCRIBED
      marketingOptInLevel: CONFIRMED_OPT_IN
      consentCollectedFrom: "CHECKOUT"
    }
  }) {
    customer { id emailMarketingConsent { marketingState } }
    userErrors { field message }
  }
}
```

**Customer SMS Marketing Consent Mutation:**
```graphql
mutation {
  customerSmsMarketingConsentUpdate(input: {
    customerId: "gid://shopify/Customer/123"
    smsMarketingConsent: {
      marketingState: SUBSCRIBED
      marketingOptInLevel: SINGLE_OPT_IN
      consentCollectedFrom: "ADMIN"
      consentCollectedAt: "2026-04-14T10:00:00Z"
    }
  }) {
    customer { id smsMarketingConsent { marketingState } }
    userErrors { field message }
  }
}
```

**Consent Query Fields:**
```graphql
query {
  consentPolicy {
    body       # Privacy policy text
    handle     # Policy identifier
    title      # Policy name
    url        # Public URL
  }
}
```

**Mutation Summary:** Customer marketing consent fully writable via dedicated mutations. Consent collection source and timestamp tracked.

---

## Tab 19: Policies Settings

### Shop Policies

| Sub-section | Field | Read | Write | Scope | Notes |
|------------|-------|------|-------|-------|-------|
| **Policies List** | `shop.shopPolicies` | ✓ | ✗ | `read_shop_info` | All configured policies |
| **Policy Body** | `shopPolicy.body` | ✓ | ✓ | `write_legal_policies` | HTML content (max 512kb) |
| **Policy Title** | `shopPolicy.title` | ✓ | ✓ | `write_legal_policies` | Translated policy name |
| **Policy Type** | `shopPolicy.type` (ShopPolicyType enum) | ✓ | ✗ | `read_shop_info` | Category: REFUND, SHIPPING, PRIVACY, TERMS, CONTACT, etc. |
| **Policy URL** | `shopPolicy.url` | ✓ | ✗ | `read_shop_info` | Public-facing policy link |
| **Created At** | `shopPolicy.createdAt` | ✓ | ✗ | `read_shop_info` | Timestamp |
| **Updated At** | `shopPolicy.updatedAt` | ✓ | ✗ | `read_shop_info` | Timestamp |
| **Update Policy** | N/A | N/A | ✓ | `write_legal_policies` | **Mutation:** `shopPolicyUpdate` |

**Available Policy Types:**
- `REFUND`
- `SHIPPING`
- `PRIVACY`
- `TERMS`
- `CONTACT`
- `ACCESSIBILITY`
- `IMPRESSUM` (German legal statement)
- `SUBSCRIPTION` (recurring billing policy)

**shopPolicyUpdate Mutation Input:**
```graphql
input ShopPolicyInput {
  type: ShopPolicyType!  # Policy category
  body: String!         # HTML content (max 512kb)
  title: String         # Optional translated title (default inferred)
}

mutation {
  shopPolicyUpdate(input: {
    type: REFUND
    body: "<h1>Refund Policy</h1><p>30-day return window...</p>"
  }) {
    shopPolicy { id type title url updatedAt }
    userErrors { field message }
  }
}
```

**Mutation Summary:** Policy body and title writable via `shopPolicyUpdate`. Policy type and URL are read-only (URL auto-generated).

**Required Scope:** `write_legal_policies`

---

## Summary Table: Settings Tabs Coverage

| # | Tab | Read Coverage | Write Coverage | Key Writable Items | Limitations |
|---|-----|---|---|---|---|
| 1 | General | 100% | 0% | None | No mutations available |
| 2 | Plan | 100% | 0% | None | Plan read-only; upgrade via UI/support |
| 3 | Billing | 50% | 50% | AppSubscriptions, billing attempts | App billing only; merchant subscription via UI |
| 4 | Users | 100% | 0% | None | Staff management UI-only; API read-only |
| 5 | Payments | 100% | 0% | None | Payment gateway setup via UI |
| 6 | Checkout | 100% | 50% | Branding (colors, typography, logo) | PLUS plan only; deprecated API |
| 7 | Customer Accounts | 100% | 50% | Marketing consent (email/SMS) | Account requirements read-only |
| 8 | Shipping | 100% | 100% | Profiles, zones, rates, locations | Full control via API |
| 9 | Taxes | 100% | 25% | Customer exemptions, B2B location tax | Jurisdiction rates via REST or UI |
| 10 | Locations | 100% | 100% | Add, edit, metafields | Full control via API |
| 11 | Apps | 100% | 50% | Uninstall, revoke scopes | Installation via UI; limited scope management |
| 12 | Sales Channels | 100% | 25% | Product publication | Channel installation via UI |
| 13 | Domains | 100% | 0% | None | Domain configuration via UI |
| 14 | Customer Events | 100% | 0% | None | Event configuration via UI |
| 15 | Notifications | 100% | 100% | Webhooks (all properties) | Full control via API |
| 16 | Metafields | 100% | 100% | All custom fields & definitions | Full control via API |
| 17 | Languages | 100% | 100% | Locales, translations | Max 20 alternate locales |
| 18 | Customer Privacy | 100% | 100% | Marketing consent | Per-customer only |
| 19 | Policies | 100% | 100% | Policy content & title | Read-only: type, URL |

**Overall Statistics:**
- **Average Read Coverage:** 100% (all settings queryable)
- **Average Write Coverage:** 42% (8 of 19 tabs have mutation support)
- **Fully Writable Tabs:** 6 (Shipping, Locations, Notifications, Metafields, Languages, Policies)
- **Read-Only Tabs:** 8 (General, Plan, Users, Payments, Domains, Customer Events, Sales Channels admin)

---

## Access Scopes Summary

**Query Scopes (Read):**
- `read_shop_info` – General, currencies, shipping zones, policies
- `read_locations` – Inventory locations
- `read_shipping` – Delivery profiles, fulfillment services
- `read_customers` – Customer data, consent states
- `read_payments` – Payment settings, Shopify Payments
- `read_checkout` – Checkout profiles and branding
- `read_channels` – Sales channel info
- `read_webhooks` – Webhook subscriptions
- `read_metafield_definitions` – Custom field schemas
- `read_metaobjects` – Custom data containers
- `read_locales` – Shop locales
- `read_translations` – Translated content
- `read_app_subscriptions` – App billing info
- `read_analytics` – Events and activity

**Mutation Scopes (Write):**
- `write_legal_policies` – Shop policies
- `write_checkout_branding` – Checkout customization
- `write_customers` – Customer consent, tax exemptions
- `write_locations` – Location add/edit
- `write_shipping` – Delivery profiles, zones, rates
- `write_webhooks` – Webhook subscriptions
- `write_metafields` – Custom field values
- `write_metafield_definitions` – Field schemas
- `write_metaobjects` – Custom objects
- `write_locales` – Shop locales
- `write_translations` – Translations
- `write_app_subscriptions` – App billing
- `write_billing` – Billing attempts, charges
- `write_companies` – B2B company settings
- `write_products` – Publication to channels
- `manage_delivery_settings` – User permission for shipping

---

## Deprecations & Future Changes (2026-04)

| Feature | Status | Alternative | Notes |
|---------|--------|-------------|-------|
| `PublishedTranslation` type | DEPRECATED | `Translation` type | Use `translations` field on resources |
| `checkoutBrandingUpsert` | DEPRECATED | Newer checkout APIs (TBD) | Plus plan feature; replacement TBD |
| `marketCurrencySettingsUpdate` | DEPRECATED | `marketCreate`, `marketUpdate` | Use market mutations for currency config |
| `pubSubWebhookSubscriptionCreate` | DEPRECATED | `webhookSubscriptionCreate` | Use generic webhook mutation |
| `eventBridgeWebhookSubscriptionCreate` | DEPRECATED | `webhookSubscriptionCreate` | Use generic webhook mutation |
| Staff management mutations | NOT AVAILABLE | Admin UI, support | No GraphQL mutations for staff |
| Domain mutations | NOT AVAILABLE | Admin UI | Domains read-only via API |

---

## Rate Limits & Constraints

| Aspect | Limit | Notes |
|--------|-------|-------|
| Metafields per mutation | 25 max | `metafieldsSet` input limit |
| Shop locales (published) | 20 max | Cannot exceed alternate locales |
| Webhook subscription topics | 1 per mutation | Create separate subscriptions for multiple topics |
| Metafield body size | 512 KB max | Policy body limit |
| Webhook payload | 5 MB max | Standard webhook limit |
| Query cost | Variable | Standard GraphQL cost calculation |

---

## Best Practices for Settings via GraphQL

1. **Batch Metafield Updates:** Use `metafieldsSet` with up to 25 items per mutation to reduce API calls.

2. **Webhook Filtering:** Use search syntax filters to reduce webhook payload size and processing overhead.

3. **Locale Enablement First:** Always enable locales before publishing for translation.

4. **Scope Minimization:** Request only necessary scopes during app installation to minimize security surface.

5. **Error Handling:** Always check `userErrors` in mutation responses for validation or business logic failures.

6. **Shipping Zone Moderation:** Test delivery profile updates in dev stores before production deployment due to customer impact.

7. **Marketing Consent Source Tracking:** Always specify `consentCollectedFrom` when updating customer marketing consent for compliance.

---

## Resources & References

- **Official Shopify GraphQL Admin API Reference:** https://shopify.dev/docs/api/admin-graphql/2026-04
- **Access Scopes Documentation:** https://shopify.dev/docs/api/usage/access-scopes
- **GraphQL Basics:** https://shopify.dev/docs/apps/build/graphql/basics/queries
- **Webhooks Documentation:** https://shopify.dev/docs/api/webhooks/latest
- **Metafields Guide:** https://shopify.dev/docs/apps/build/custom-data/metafields
- **Shopify Changelog:** https://shopify.dev/changelog

---

**Document Last Updated:** 2026-04-14  
**GraphQL API Version:** 2026-04 (Latest Stable)  
**Status:** Complete & Verified

