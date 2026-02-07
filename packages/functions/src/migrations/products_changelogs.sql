CREATE TABLE IF NOT EXISTS `tool_tracking_dataset.products_changelogs`
(
  -- Standard trigger fields
  timestamp       TIMESTAMP NOT NULL,
  event_id        STRING,
  document_name   STRING    NOT NULL,
  operation       STRING    NOT NULL,
  data            STRING,
  old_data        STRING,
  document_id     STRING,

  -- Tracking fields (existing)
  userId          STRING,
  storeId         STRING,
  storeName       STRING,
  shopDomain      STRING,
  shopifyProductId STRING,
  importId        STRING,
  action          STRING,
  importedAt      TIMESTAMP,
  createdAt       TIMESTAMP NOT NULL,
  updatedAt       TIMESTAMP NOT NULL,

  -- Core product info
  handle          STRING,
  title           STRING,
  description     STRING,
  vendor          STRING,
  productType     STRING,
  tags            STRING,
  status          STRING,
  giftCard        BOOLEAN,

  -- Product options
  option1Name     STRING,
  option1Value    STRING,
  option2Name     STRING,
  option2Value    STRING,
  option3Name     STRING,
  option3Value    STRING,

  -- Variant/Pricing
  sku             STRING,
  price           STRING,
  compareAtPrice  STRING,
  cost            FLOAT64,

  -- Inventory
  inventoryQuantity    INT64,
  inventoryTracker     STRING,
  inventoryPolicy      STRING,
  fulfillmentService   STRING,
  barcode              STRING,

  -- Shipping & Weight
  weight               FLOAT64,
  weightUnit           STRING,
  requiresShipping     BOOLEAN,

  -- Tax
  taxable         BOOLEAN,
  taxCode         STRING,

  -- Images
  imageUrl        STRING,
  imagePosition   STRING,
  imageAlt        STRING,
  variantImage    STRING,

  -- Google Shopping (13 fields)
  googleShoppingMPN              STRING,
  googleShoppingAgeGroup         STRING,
  googleShoppingGender           STRING,
  googleShoppingProductCategory  STRING,
  googleShoppingAdWordsGrouping  STRING,
  googleShoppingAdWordsLabels    STRING,
  googleShoppingCondition        STRING,
  googleShoppingCustomProduct    STRING,
  googleShoppingCustomLabel0     STRING,
  googleShoppingCustomLabel1     STRING,
  googleShoppingCustomLabel2     STRING,
  googleShoppingCustomLabel3     STRING,
  googleShoppingCustomLabel4     STRING,

  -- SEO
  seoTitle        STRING,
  seoDescription  STRING,
  seoHidden       BOOLEAN
)
PARTITION BY DATE(createdAt)
CLUSTER BY userId, storeId, document_id;
