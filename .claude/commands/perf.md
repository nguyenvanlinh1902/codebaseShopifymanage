---
description: Audit code for performance issues
argument-hint: [file or feature to audit]
---

## Target
$ARGUMENTS

Use the `performance-reviewer` agent to audit for:
1. Firestore read/write efficiency
2. Webhook response time (5s limit)
3. Async/await parallelization (Promise.all)
4. Firebase function config (memory, timeout)
5. BigQuery partitioning and clustering
6. N+1 queries and cost concerns

## Reference Skills
- `.claude/skills/firestore.md`
- `.claude/skills/bigquery.md`
- `.claude/skills/backend.md`