-- Change to your project ID and dataset ID when deploying

CREATE OR REPLACE VIEW `tool_tracking_dataset.google_auth_latest_view` AS
SELECT *
FROM (
  SELECT
    * EXCEPT(data),
    ROW_NUMBER() OVER (
      PARTITION BY document_id
      ORDER BY timestamp DESC
    ) AS rn
  FROM `tool_tracking_dataset.google_auth_changelogs`
  WHERE document_id NOT IN (
    SELECT DISTINCT document_id
    FROM `tool_tracking_dataset.google_auth_changelogs`
    WHERE operation = 'DELETE'
  )
)
WHERE rn = 1;
