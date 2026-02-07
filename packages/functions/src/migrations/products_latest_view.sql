CREATE OR REPLACE VIEW `tool_tracking_dataset.products_latest_view` AS
SELECT *
FROM (
  SELECT
    * EXCEPT(data),
    ROW_NUMBER() OVER (
      PARTITION BY document_id
      ORDER BY timestamp DESC
    ) AS rn
  FROM `tool_tracking_dataset.products_changelogs`
  WHERE document_id NOT IN (
    SELECT DISTINCT document_id
    FROM `tool_tracking_dataset.products_changelogs`
    WHERE operation = 'DELETE'
  )
)
WHERE rn = 1;
