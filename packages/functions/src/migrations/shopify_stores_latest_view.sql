-- Change to your project ID and dataset ID when deploying

CREATE OR REPLACE VIEW `tool_tracking_dataset.shopify_stores_latest_view` AS
SELECT *
FROM (
  SELECT
    * EXCEPT(data),
    ROW_NUMBER() OVER (
      PARTITION BY document_id
      ORDER BY timestamp DESC
    ) AS rn
  FROM `tool_tracking_dataset.shopify_stores_changelogs`
  WHERE document_id NOT IN (
    SELECT DISTINCT document_id
    FROM `tool_tracking_dataset.shopify_stores_changelogs`
    WHERE operation = 'DELETE'
  )
)
WHERE rn = 1;
