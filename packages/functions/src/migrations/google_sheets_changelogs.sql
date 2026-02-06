-- Change to your project ID and dataset ID when deploying

CREATE TABLE IF NOT EXISTS `tool_tracking_dataset.google_sheets_changelogs`
(
  timestamp       TIMESTAMP NOT NULL,
  event_id        STRING,
  document_name   STRING    NOT NULL,
  operation       STRING    NOT NULL,
  data            STRING,
  old_data        STRING,
  document_id     STRING,

  userId          STRING,
  spreadsheetId   STRING,
  name            STRING,
  title           STRING,
  status          STRING,
  googleEmail     STRING,
  createdAt       TIMESTAMP NOT NULL,
  updatedAt       TIMESTAMP NOT NULL
)
PARTITION BY DATE(createdAt)
CLUSTER BY userId, document_id;
