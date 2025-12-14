# BigQuery Best Practices

## Table Design

### Partitioning (REQUIRED for tables > 1GB)

```sql
-- ✅ Partitioned by date, clustered by shop
CREATE TABLE `project.dataset.events` (
  event_id STRING,
  shop_id STRING,
  event_type STRING,
  created_at TIMESTAMP,
  data JSON
)
PARTITION BY DATE(created_at)
CLUSTER BY shop_id, event_type;
```

| Data Size | Partition By |
|-----------|--------------|
| < 1GB | Not needed |
| 1GB - 1TB | DATE/TIMESTAMP |
| > 1TB | DATE + consider sharding |

### Clustering

- Up to 4 columns in WHERE/JOIN
- Order matters: most filtered first
- Common: `CLUSTER BY shop_id, event_type`

---

## Query Patterns

### Always Use Partition Filter

```sql
-- ❌ BAD: No partition filter (full scan)
SELECT * FROM `project.dataset.events`
WHERE shop_id = 'shop_123';

-- ✅ GOOD: Partition filter included
SELECT * FROM `project.dataset.events`
WHERE created_at >= '2024-01-01'
  AND created_at < '2024-02-01'
  AND shop_id = 'shop_123';
```

### Select Only Needed Columns

```sql
-- ❌ BAD: SELECT * (fetches all columns)
SELECT * FROM `project.dataset.events`;

-- ✅ GOOD: Select specific columns
SELECT event_id, event_type, created_at
FROM `project.dataset.events`
WHERE created_at >= '2024-01-01';
```

### Use Parameterized Queries

```javascript
// ✅ GOOD: Parameterized (prevents SQL injection)
const query = `
  SELECT event_id, event_type, data
  FROM \`project.dataset.events\`
  WHERE created_at >= @startDate
    AND created_at < @endDate
    AND shop_id = @shopId
`;

const [rows] = await bigquery.query({
  query,
  params: {
    startDate: '2024-01-01',
    endDate: '2024-02-01',
    shopId: 'shop_123'
  }
});
```

---

## Cost Control

### Dry Run Before Expensive Queries

```javascript
const [job] = await bigquery.createQueryJob({
  query: sql,
  dryRun: true
});

const bytesProcessed = job.statistics.totalBytesProcessed;
const estimatedCost = (bytesProcessed / 1e12) * 5; // $5 per TB

console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);
```

### Use LIMIT for Exploration

```sql
-- ✅ Always LIMIT when exploring
SELECT *
FROM `project.dataset.events`
WHERE created_at >= '2024-01-01'
LIMIT 100;
```

### Approximate Aggregations

```sql
-- ❌ Expensive: Exact count distinct
SELECT COUNT(DISTINCT user_id) FROM events;

-- ✅ Cheaper: Approximate (within 1%)
SELECT APPROX_COUNT_DISTINCT(user_id) FROM events;
```

---

## Node.js Integration

### Basic Query

```javascript
const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

async function queryEvents(shopId, startDate, endDate) {
  const query = `
    SELECT event_id, event_type, data
    FROM \`project.dataset.events\`
    WHERE created_at >= @startDate
      AND created_at < @endDate
      AND shop_id = @shopId
    ORDER BY created_at DESC
    LIMIT 1000
  `;

  const [rows] = await bigquery.query({
    query,
    params: { shopId, startDate, endDate }
  });

  return rows;
}
```

### Streaming Insert (ALWAYS Batch)

**Always batch inserts - never insert row by row.**

```javascript
// ✅ GOOD: Single batch insert (1 API call)
bigQueryTable(table).insert(
  batch.map(row => ({
    ...row,
    time: row.time ? new Date(row.time) : new Date(),
    date: row.date ? formatDateYYYYMMDD(new Date(row.date)) : formatDateYYYYMMDD(new Date())
  }))
);

// ❌ BAD: Insert one row at a time (N API calls - SLOW)
for (const row of batch) {
  await bigQueryTable(table).insert([{
    ...row,
    time: new Date(),
    date: formatDateYYYYMMDD(new Date())
  }]);
}
```

**Why batch is better:**
- Single network round trip vs N round trips
- Lower latency and cost
- BigQuery streaming insert handles batches efficiently

**Batch size recommendations:**
| Scenario | Max Batch Size |
|----------|----------------|
| Streaming inserts | 500-1000 rows |
| High throughput | Up to 10,000 rows |
| Maximum | 50,000 rows or 10MB |

```javascript
// Full example with transformation
async function insertEvents(events) {
  const dataset = bigquery.dataset('dataset');
  const table = dataset.table('events');

  await table.insert(events.map(e => ({
    event_id: e.id,
    shop_id: e.shopId,
    event_type: e.type,
    created_at: BigQuery.timestamp(e.createdAt),
    data: JSON.stringify(e.data)
  })));
}
```

### Handle Large Results

```javascript
async function streamLargeQuery(query) {
  const [job] = await bigquery.createQueryJob({ query });
  const [rows] = await job.getQueryResults({ autoPaginate: false });

  // Process in batches
  let pageToken;
  do {
    const [batch, nextQuery] = await job.getQueryResults({
      pageToken,
      maxResults: 10000
    });

    for (const row of batch) {
      await processRow(row);
    }

    pageToken = nextQuery?.pageToken;
  } while (pageToken);
}
```

---

## Audit Checklist

```
□ Large tables (>1GB) have partitioning
□ Queries include partition column in WHERE
□ Tables clustered by frequently filtered columns
□ Queries select only needed columns (no SELECT *)
□ Using parameterized queries
□ Queries have LIMIT for exploratory work
□ Dry-run used for expensive queries
□ Approximate functions used when exact not needed
□ Batch inserts (not row-by-row)
```