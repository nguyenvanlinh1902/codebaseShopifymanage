-- Change to your project ID and dataset ID when deploying

CREATE TABLE IF NOT EXISTS `tool_tracking_dataset.shopify_stores_changelogs`
(
  timestamp       TIMESTAMP NOT NULL,
  event_id        STRING,
  document_name   STRING    NOT NULL,
  operation       STRING    NOT NULL,
  data            STRING,
  old_data        STRING,
  document_id     STRING,

  userId          STRING,
  shopDomain      STRING,
  name            STRING,
  niche           STRING,
  email           STRING,
  currency        STRING,
  timezone        STRING,
  status          STRING,
  createdAt       TIMESTAMP NOT NULL,
  updatedAt       TIMESTAMP NOT NULL
)
PARTITION BY DATE(createdAt)
CLUSTER BY userId, document_id;
