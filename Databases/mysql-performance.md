# MySQL Performance & Optimization

Performance problems in MySQL almost always trace back to one of three causes: missing or misused indexes, queries that scan more rows than necessary, or server settings mismatched to the workload. This guide covers the tools and techniques for finding and fixing those problems - from reading `EXPLAIN` output and building the right indexes, to tuning the buffer pool and analyzing the slow query log.

---

## Understanding EXPLAIN

<div class="diagram-container"><img src="../../assets/images/databases/query-execution-plan.svg" alt="MySQL query execution path from parser through optimizer to storage engine, and index selection decision tree"></div>

The [**`EXPLAIN`**](https://dev.mysql.com/doc/refman/8.0/en/explain.html) statement is your primary tool for understanding how MySQL executes a query. Prefix any `SELECT`, `INSERT`, `UPDATE`, or `DELETE` with `EXPLAIN` and MySQL returns the execution plan - the sequence of steps the optimizer chose, which indexes it uses, and how many rows it estimates it needs to examine.

```sql
EXPLAIN SELECT c.name, o.total
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'US'
AND o.created_at > '2025-01-01';
```

### Key Columns in EXPLAIN Output

| Column | What it tells you |
|--------|-------------------|
| `id` | The query step number. Same `id` means tables are joined; different `id` values indicate subqueries. |
| `select_type` | Whether this is a `SIMPLE` query, `PRIMARY`, `SUBQUERY`, `DERIVED` table, or `UNION`. |
| `table` | Which table this row of the plan applies to. |
| `type` | The **access type** - how MySQL finds rows in this table. The most important column. |
| `possible_keys` | Indexes the optimizer considered. |
| `key` | The index the optimizer actually chose. `NULL` means no index is used. |
| `key_len` | How many bytes of the index are used. Helps you tell whether the full composite index is used or just a prefix. |
| `ref` | What is compared against the index - a constant, a column from another table, or `NULL`. |
| `rows` | Estimated number of rows MySQL must examine. This is an estimate, not an exact count. |
| `filtered` | Percentage of rows that survive after applying the `WHERE` conditions. Lower means more rows are discarded. |
| `Extra` | Additional execution details. Watch for `Using filesort`, `Using temporary`, and `Using where`. |

### Access Types (Best to Worst)

The `type` column is the single most important indicator of query efficiency. From best to worst:

| Access Type | Meaning | Typical Scenario |
|-------------|---------|------------------|
| `system` | Table has exactly one row | System tables |
| `const` | At most one matching row, read at optimization time | `WHERE id = 1` on a primary key |
| `eq_ref` | One row per combination from the previous table | JOIN on a primary key or unique index |
| `ref` | All rows matching a single value in the index | JOIN or WHERE on a non-unique index |
| `range` | Index scan over a range of values | `WHERE created_at > '2025-01-01'` |
| `index` | Full scan of the index tree (every entry) | Covering index query, but scans all rows |
| `ALL` | Full table scan - reads every row | No usable index found |

Anything from `const` through `range` is generally acceptable for production queries. Seeing `index` or `ALL` on a large table is a red flag.

### The Extra Column

Some values in the `Extra` column deserve immediate attention:

- **`Using index`** - the query is satisfied entirely from the index without touching the table data (a **covering index**). This is ideal.
- **`Using where`** - MySQL applies a `WHERE` filter after reading rows. Normal, but check whether an index could push the filter earlier.
- **`Using temporary`** - MySQL created an internal temporary table, often for `GROUP BY` or `DISTINCT` on columns that aren't indexed.
- **`Using filesort`** - MySQL performs an extra sort pass because the result order doesn't match any index order. Expensive on large result sets.
- **`Using index condition`** - **Index Condition Pushdown** (ICP) is active. MySQL evaluates part of the `WHERE` clause at the storage engine level, reducing the number of full-row reads.

```code-walkthrough
title: Reading EXPLAIN Output
description: Analyzing the execution plan for a two-table join query to understand how MySQL processes it.
code: |
  EXPLAIN SELECT c.name, o.order_id, o.total
  FROM customers c
  JOIN orders o ON o.customer_id = c.id
  WHERE c.country = 'US'
  AND o.total > 100.00;

  -- id | select_type | table | type  | possible_keys        | key          | key_len | ref              | rows  | filtered | Extra
  -- 1  | SIMPLE      | c     | ref   | PRIMARY,idx_country  | idx_country  | 3       | const            | 4520  | 100.00   | NULL
  -- 1  | SIMPLE      | o     | ref   | idx_customer_id      | idx_customer_id | 4    | shop.c.id        | 8     | 33.33    | Using where
language: sql
annotations:
  - line: 1
    text: "Prefix any DML statement with EXPLAIN to see the execution plan instead of running the query."
  - line: 3
    text: "The JOIN condition tells MySQL how to connect rows between tables. An index on orders.customer_id is critical here."
  - line: 4
    text: "WHERE clauses filter rows. The optimizer decides which filter to apply first based on index availability and estimated selectivity."
  - line: 7
    text: "The EXPLAIN output is a table with one row per table accessed. Both rows have id=1 and select_type=SIMPLE, meaning this is a single-step join with no subqueries."
  - line: 8
    text: "type=ref means MySQL uses the idx_country index to find all US customers. It estimates 4520 matching rows. ref=const means it's matching against the constant value 'US'."
  - line: 9
    text: "For each customer, MySQL uses idx_customer_id with type=ref to find matching orders (estimated 8 per customer). 'Using where' means the o.total > 100.00 filter is applied after the index lookup. filtered=33.33 tells you only about a third of each customer's orders survive that filter."
```

### EXPLAIN ANALYZE

MySQL 8.0.18 introduced **`EXPLAIN ANALYZE`**, which actually runs the query and reports real execution statistics alongside the plan. The output includes actual row counts, loop counts, and execution time per step.

```sql
EXPLAIN ANALYZE
SELECT c.name, COUNT(*) AS order_count
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'US'
GROUP BY c.id;
```

The output uses a tree format showing nested operations with actual timing:

```
-> Group aggregate: count(0)  (cost=1856 rows=4520) (actual time=0.127..45.3 rows=4210 loops=1)
    -> Nested loop join  (cost=1412 rows=36160) (actual time=0.089..38.7 rows=33680 loops=1)
        -> Index lookup on c using idx_country (country='US')  (cost=502 rows=4520) (actual time=0.067..4.2 rows=4520 loops=1)
        -> Index lookup on o using idx_customer_id (customer_id=c.id)  (cost=0.25 rows=8) (actual time=0.005..0.007 rows=7.45 loops=4520)
```

The key difference: `rows=4520` is the estimate, while `actual ... rows=4520` is what actually happened. When these numbers diverge significantly, the optimizer may be making poor decisions based on stale statistics. Run `ANALYZE TABLE` to refresh them.

!!! tip "Use EXPLAIN ANALYZE on development, not production"
    `EXPLAIN ANALYZE` executes the full query. On a slow query against a large table, that means waiting for the full execution. Use regular `EXPLAIN` for initial investigation, then `EXPLAIN ANALYZE` on a staging environment to validate.

```quiz
question: "In EXPLAIN output, what does access type 'ALL' indicate?"
type: multiple-choice
options:
  - text: "MySQL is using all available indexes for maximum performance"
    feedback: "'ALL' does not mean 'all indexes.' It means the opposite - MySQL is scanning every row in the table because no usable index was found."
  - text: "The query returns all columns from the table"
    feedback: "The access type describes how rows are located, not which columns are returned. 'ALL' means a full table scan."
  - text: "MySQL is performing a full table scan, reading every row"
    correct: true
    feedback: "Correct! type=ALL means MySQL reads every row in the table and filters them one by one. On large tables, this is almost always a performance problem that an appropriate index can fix."
  - text: "All rows matched the WHERE clause"
    feedback: "The access type describes how MySQL finds rows, not how many matched. Even with type=ALL, the WHERE clause may filter out most rows - but MySQL still had to read all of them to check."
```

---

## Index Strategies

Indexes are the single biggest lever you have for query performance. A well-chosen index can turn a query from scanning millions of rows to reading a handful. A missing or poorly designed index is behind most slow queries in production.

### Single-Column Indexes

The simplest index covers one column:

```sql
CREATE INDEX idx_email ON users (email);
```

This speeds up queries that filter or sort by `email`. MySQL can use it for exact matches (`WHERE email = 'user@example.com'`), prefix matches (`WHERE email LIKE 'user@%'`), and range scans (`WHERE email BETWEEN 'a' AND 'm'`).

### Composite (Multi-Column) Indexes

A **composite index** covers multiple columns in a defined order:

```sql
CREATE INDEX idx_country_city ON customers (country, city);
```

MySQL can use this index for:

- `WHERE country = 'US'` - uses the first column
- `WHERE country = 'US' AND city = 'Austin'` - uses both columns
- `WHERE country = 'US' AND city > 'M'` - uses first column for equality, second for range

MySQL **cannot** use this index for:

- `WHERE city = 'Austin'` - skips the first column (violates the leftmost prefix rule)

This is the **leftmost prefix rule**: a composite index on `(a, b, c)` can satisfy queries that filter on `(a)`, `(a, b)`, or `(a, b, c)`, but not `(b)`, `(c)`, or `(b, c)`. The columns must be used in order from left to right, though MySQL does not require all columns to be present.

!!! warning "Column order matters"
    When designing composite indexes, put the most selective equality column first, followed by additional equality columns, and put any range condition column last. Once MySQL hits a range condition in the index, it stops using subsequent index columns for filtering.

### Covering Indexes

A **covering index** contains all the columns a query needs - both for filtering and for the result set. When MySQL can satisfy a query entirely from the index, it never reads the actual table rows. You see `Using index` in the `Extra` column of `EXPLAIN`.

```sql
-- Query
SELECT customer_id, total FROM orders WHERE customer_id = 42;

-- Covering index for this query
CREATE INDEX idx_covering ON orders (customer_id, total);
```

The index contains both `customer_id` (for filtering) and `total` (for the result), so MySQL reads only the index. This avoids the random I/O cost of looking up each row in the table data.

### Prefix Indexes

For long string columns, you can index only the first N characters:

```sql
CREATE INDEX idx_email_prefix ON users (email(10));
```

Prefix indexes use less storage and memory but cannot be used for `ORDER BY` or as covering indexes. Choose a prefix length that provides good selectivity:

```sql
-- Check selectivity at different prefix lengths
SELECT
  COUNT(DISTINCT LEFT(email, 5)) / COUNT(*) AS sel_5,
  COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) AS sel_10,
  COUNT(DISTINCT LEFT(email, 15)) / COUNT(*) AS sel_15,
  COUNT(DISTINCT email) / COUNT(*) AS sel_full
FROM users;
```

Pick the shortest prefix where selectivity is close to the full-column selectivity.

### Index Condition Pushdown (ICP)

**Index Condition Pushdown** is an optimization where MySQL evaluates `WHERE` conditions at the storage engine level during an index scan, before reading the full row. Without ICP, the server reads the full row for every index match and then applies the filter. With ICP, rows that fail the condition are skipped at the index level.

ICP is enabled by default in MySQL 5.6+ and appears as `Using index condition` in `EXPLAIN` output. You rarely need to think about it, but it explains why some queries are faster than their `EXPLAIN` row estimates suggest.

```quiz
question: "Given a composite index on (country, city, zip_code), which WHERE clause can fully use all three index columns?"
type: multiple-choice
options:
  - text: "WHERE city = 'Austin' AND zip_code = '78701'"
    feedback: "This skips the first column (country), violating the leftmost prefix rule. MySQL cannot use this index at all for these conditions."
  - text: "WHERE country = 'US' AND zip_code = '78701'"
    feedback: "This skips the middle column (city). MySQL can use the index for country but cannot skip to zip_code. Only the first column is used."
  - text: "WHERE country = 'US' AND city = 'Austin' AND zip_code = '78701'"
    correct: true
    feedback: "Correct! All three columns are used left to right with equality conditions. This is the ideal case for a composite index - MySQL traverses the B-tree using all three columns to find the exact matching rows."
  - text: "WHERE country > 'T' AND city = 'Austin' AND zip_code = '78701'"
    feedback: "The range condition on country (the first column) prevents MySQL from using city and zip_code in the index. Once a range condition appears, subsequent index columns are not used for filtering."
```

---

## Buffer Pool Tuning

The **InnoDB buffer pool** is MySQL's main memory cache. It holds table data pages, index pages, the change buffer, and the adaptive hash index. Every read and write to InnoDB data goes through the buffer pool. If the data you need is already in memory, MySQL avoids a disk read. If it isn't, MySQL reads from disk and caches the page for future use.

### Sizing the Buffer Pool

The `innodb_buffer_pool_size` setting controls the buffer pool's total size. The general guidance:

- **Dedicated database server**: 70-80% of total RAM. A server with 64 GB of RAM should have a buffer pool of 45-50 GB.
- **Shared server** (running web server, application, and database): 40-50% of RAM, leaving room for the OS, application processes, and filesystem cache.

```sql
-- Check current buffer pool size
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';

-- Set dynamically (MySQL 5.7+)
SET GLOBAL innodb_buffer_pool_size = 48 * 1024 * 1024 * 1024;  -- 48 GB
```

For permanent changes, set it in `my.cnf`:

```ini
[mysqld]
innodb_buffer_pool_size = 48G
```

### Buffer Pool Instances

The `innodb_buffer_pool_instances` setting splits the buffer pool into multiple independent regions, reducing contention on the buffer pool mutex when many threads read and write concurrently. MySQL 8.0 defaults to 8 instances when the buffer pool is 1 GB or larger.

```ini
[mysqld]
innodb_buffer_pool_size = 48G
innodb_buffer_pool_instances = 16
```

Each instance should be at least 1 GB. A pool of 48 GB with 16 instances gives 3 GB per instance.

### Monitoring the Buffer Pool Hit Ratio

The **hit ratio** tells you what percentage of read requests are served from memory rather than disk. A healthy buffer pool has a hit ratio above 99%.

```sql
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
```

Calculate the ratio:

```sql
SELECT
  (1 - (
    (SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Innodb_buffer_pool_reads')
    /
    (SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Innodb_buffer_pool_read_requests')
  )) * 100 AS buffer_pool_hit_ratio;
```

- `Innodb_buffer_pool_read_requests` - total logical reads (satisfied from buffer pool or disk)
- `Innodb_buffer_pool_reads` - reads that required a disk I/O

If the hit ratio is below 99%, your buffer pool is likely too small for the working set, or your queries are scanning large amounts of data that don't fit in memory.

!!! tip "Warm up the buffer pool after restart"
    MySQL 5.6+ can dump and reload the buffer pool contents across restarts. Enable `innodb_buffer_pool_dump_at_shutdown` and `innodb_buffer_pool_load_at_startup` in `my.cnf` to avoid a cold cache after a restart.

```quiz
question: "For a dedicated MySQL server with 64 GB of RAM, what is a reasonable innodb_buffer_pool_size?"
type: multiple-choice
options:
  - text: "4 GB - keep most memory free for the OS"
    feedback: "4 GB on a 64 GB server leaves the vast majority of RAM unused. InnoDB relies heavily on in-memory caching; an undersized buffer pool forces excessive disk I/O."
  - text: "64 GB - use all available RAM"
    feedback: "Allocating all RAM to the buffer pool leaves nothing for the OS, InnoDB's per-thread buffers, temporary tables, or other processes. The server will swap and perform worse."
  - text: "45-50 GB (70-80% of RAM)"
    correct: true
    feedback: "Correct! The standard recommendation for a dedicated database server is 70-80% of total RAM. On 64 GB, that's 45-50 GB. The remaining memory covers the OS page cache, per-connection buffers, temporary tables, and other MySQL internal structures."
  - text: "32 GB - exactly half"
    feedback: "50% is conservative for a dedicated database server. You'd leave more memory idle than necessary. 70-80% is the standard recommendation."
```

---

## Query Profiling

When `EXPLAIN` tells you what the optimizer plans to do, profiling tells you what actually happened and where time was spent.

### SET profiling (Legacy)

The `SET profiling` approach is deprecated but still available in MySQL 8.0 and commonly referenced in older documentation:

```sql
SET profiling = 1;

SELECT * FROM orders WHERE customer_id = 42 AND status = 'shipped';

SHOW PROFILES;
```

`SHOW PROFILES` lists recent queries with their total execution time. For a breakdown by stage:

```sql
SHOW PROFILE FOR QUERY 1;
```

This outputs each stage (opening tables, executing, sending data, cleaning up) with its duration. Useful for a quick check, but the Performance Schema provides more detail.

### Performance Schema

The [**Performance Schema**](https://dev.mysql.com/doc/refman/8.0/en/performance-schema.html) is MySQL's instrumentation framework. It records detailed timing and statistics for every stage of query execution with minimal overhead.

Enable statement instrumentation (usually on by default):

```sql
-- Check if events_statements instrumentation is enabled
SELECT * FROM performance_schema.setup_instruments
WHERE NAME LIKE 'statement/%' AND ENABLED = 'YES';
```

Query recent statement execution statistics:

```sql
SELECT
  DIGEST_TEXT,
  COUNT_STAR AS exec_count,
  ROUND(AVG_TIMER_WAIT / 1e12, 3) AS avg_seconds,
  ROUND(SUM_TIMER_WAIT / 1e12, 3) AS total_seconds,
  SUM_ROWS_EXAMINED,
  SUM_ROWS_SENT
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 10;
```

This query surfaces the 10 most time-consuming query patterns in your workload. The `DIGEST_TEXT` column normalizes queries (replacing literal values with `?`), so all executions of the same query pattern are grouped together.

For per-stage profiling of a specific query:

```sql
-- Run the query
SELECT * FROM orders WHERE customer_id = 42;

-- Find its event ID
SELECT EVENT_ID, SQL_TEXT, TIMER_WAIT / 1e12 AS seconds
FROM performance_schema.events_statements_history
WHERE SQL_TEXT LIKE '%customer_id = 42%'
ORDER BY EVENT_ID DESC LIMIT 1;

-- Get stage-level breakdown
SELECT EVENT_NAME, TIMER_WAIT / 1e12 AS seconds
FROM performance_schema.events_stages_history_long
WHERE NESTING_EVENT_ID = <event_id>
ORDER BY TIMER_START;
```

---

## Slow Query Log

The **slow query log** captures every query that exceeds a configurable time threshold. It's the primary way to find problematic queries in production without actively monitoring the server.

### Enabling the Slow Query Log

```sql
-- Enable dynamically
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL long_query_time = 1;    -- Log queries taking more than 1 second
SET GLOBAL log_queries_not_using_indexes = 1;  -- Also log queries without indexes
```

For persistent configuration in `my.cnf`:

```ini
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1
```

The `long_query_time` accepts decimal values. Setting it to `0.5` captures queries over 500 milliseconds. On a busy system, start with `1` or `2` seconds to avoid filling the log, then lower the threshold as you fix the worst offenders.

!!! warning "Disk space"
    The slow query log can grow quickly on a busy server. Monitor its size and rotate it regularly with `logrotate` or by running `FLUSH SLOW LOGS` after rotating the file.

### Analyzing with pt-query-digest

Reading raw slow query logs is impractical on a busy server - you might have thousands of entries. [**`pt-query-digest`**](https://docs.percona.com/percona-toolkit/pt-query-digest.html) from Percona Toolkit aggregates the log into a ranked summary.

```bash
pt-query-digest /var/log/mysql/slow.log
```

The output ranks query patterns by total execution time and shows:

- **Response time** - total and average per execution
- **Calls** - how many times this query pattern ran
- **Rows examined vs. rows sent** - the ratio between rows MySQL read and rows returned to the client. A high ratio indicates the query is reading far more data than needed.
- **Query fingerprint** - the normalized query with literal values replaced

```bash
# Filter to a specific time window
pt-query-digest --since '2025-06-01' --until '2025-06-02' /var/log/mysql/slow.log

# Filter to queries affecting a specific table
pt-query-digest --filter '$event->{arg} =~ m/orders/' /var/log/mysql/slow.log

# Output as JSON for automated processing
pt-query-digest --output json /var/log/mysql/slow.log
```

```terminal
title: Diagnosing a Slow Query with EXPLAIN
steps:
  - command: "mysql -e \"SET GLOBAL slow_query_log = 'ON'; SET GLOBAL long_query_time = 0.5;\""
    output: ""
    narration: "Enable the slow query log and set the threshold to 500 milliseconds. Any query taking longer than that will be recorded."
  - command: "mysql -e \"SELECT o.order_id, c.name, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending' ORDER BY o.created_at DESC LIMIT 100;\""
    output: |
      100 rows in set (3.42 sec)
    narration: "This query is taking 3.42 seconds - well above the threshold. It will appear in the slow query log."
  - command: "mysql -e \"EXPLAIN SELECT o.order_id, c.name, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending' ORDER BY o.created_at DESC LIMIT 100;\""
    output: |
      +----+-------------+-------+------+---------------+------+---------+------+---------+----------------------------------------------+
      | id | select_type | table | type | possible_keys | key  | key_len | ref  | rows    | Extra                                        |
      +----+-------------+-------+------+---------------+------+---------+------+---------+----------------------------------------------+
      |  1 | SIMPLE      | o     | ALL  | NULL          | NULL | NULL    | NULL | 1250000 | Using where; Using temporary; Using filesort |
      |  1 | SIMPLE      | c     | eq_ref | PRIMARY     | PRIMARY | 4   | shop.o.customer_id | 1 | NULL                            |
      +----+-------------+-------+------+---------------+------+---------+------+---------+----------------------------------------------+
    narration: "The EXPLAIN reveals the problem. The orders table has type=ALL (full table scan of 1.25 million rows), no index is used, and MySQL needs a temporary table and filesort for the ORDER BY. The customers table join is fine - eq_ref on the primary key."
  - command: "mysql -e \"CREATE INDEX idx_status_created ON orders (status, created_at);\""
    output: "Query OK, 0 rows affected (4.87 sec)"
    narration: "Create a composite index on the two columns used in WHERE and ORDER BY. Status first (equality filter), created_at second (sort order)."
  - command: "mysql -e \"EXPLAIN SELECT o.order_id, c.name, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending' ORDER BY o.created_at DESC LIMIT 100;\""
    output: |
      +----+-------------+-------+------+--------------------+--------------------+---------+-------------------+------+-------------+
      | id | select_type | table | type | possible_keys      | key                | key_len | ref               | rows | Extra       |
      +----+-------------+-------+------+--------------------+--------------------+---------+-------------------+------+-------------+
      |  1 | SIMPLE      | o     | ref  | idx_status_created | idx_status_created | 52      | const             | 8340 | Using where |
      |  1 | SIMPLE      | c     | eq_ref | PRIMARY          | PRIMARY            | 4       | shop.o.customer_id | 1  | NULL        |
      +----+-------------+-------+------+--------------------+--------------------+---------+-------------------+------+-------------+
    narration: "After adding the index, the orders table access changed from ALL (1.25M rows) to ref (8,340 rows). The filesort and temporary table are gone because the index already delivers rows in created_at order. The query now reads 150x fewer rows."
  - command: "mysql -e \"SELECT o.order_id, c.name, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending' ORDER BY o.created_at DESC LIMIT 100;\""
    output: |
      100 rows in set (0.02 sec)
    narration: "The same query now runs in 20 milliseconds instead of 3.4 seconds - a 170x improvement from a single composite index."
```

```terminal
title: Analyzing the Slow Query Log with pt-query-digest
steps:
  - command: "pt-query-digest /var/log/mysql/slow.log --limit 3"
    output: |
      # 340ms user time, 20ms system time, 42.56M rss, 98.12M vsz
      # Current date: Thu Jun 12 14:23:01 2025
      # Hostname: db-prod-01
      # Files: /var/log/mysql/slow.log
      # Overall: 2.84k total, 47 unique, 4.73 QPS, 2.41x concurrency

      # Profile
      # Rank Query ID                           Response time  Calls  R/Call  V/M
      # ==== ==================================  =============  =====  ======  ====
      #    1 0xABC123DEF456789012345678ABCDEF01  1842.3 68.2%    892  2.0652  0.34  SELECT orders customers
      #    2 0x123456789ABCDEF0123456789ABCDEF0   534.8 19.8%   1247  0.4288  0.12  SELECT products
      #    3 0xDEF0123456789ABCDEF0123456789ABC   186.2  6.9%     38  4.9000  1.87  SELECT order_items orders
    narration: "pt-query-digest groups queries by their normalized fingerprint and ranks them by total response time. Query #1 consumed 68% of all slow query time - that's where to focus first."
  - command: "pt-query-digest /var/log/mysql/slow.log --limit 1"
    output: |
      # Query 1: 1.49 QPS, 3.07x concurrency, ID 0xABC123DEF456789012345678ABCDEF01
      # Scores: V/M = 0.34
      # Time range: 2025-06-11T00:00:01 to 2025-06-12T14:22:58
      # Attribute    pct   total     min     max     avg     95%  stddev  median
      # ============ ===  ======  ======  ======  ======  ======  ======  ======
      # Count         31     892
      # Exec time     68   1842s   380ms   12.4s   2.07s   4.21s   1.12s   1.84s
      # Rows sent      2   86.4k       1     100   99.23  100.00    2.41  100.00
      # Rows examine  89  1.09G   1.23M   1.25M   1.25M   1.25M   4.21k   1.25M
      # Query_time distribution
      #   1us
      #  10us
      # 100us
      #   1ms
      #  10ms
      # 100ms  ###
      #    1s  ###############################################
      #  10s+  ##
      # Tables
      #    SHOW TABLE STATUS LIKE 'orders'\G
      #    SHOW CREATE TABLE 'orders'\G
      # EXPLAIN /*!50100 PARTITIONS*/
      SELECT o.order_id, c.name, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending' ORDER BY o.created_at DESC LIMIT 100\G
    narration: "The detailed view for the worst query shows it examined 1.25 million rows per execution but sent only 100 rows back - a 12,500:1 read-to-return ratio. The Rows examine column is the clearest signal that an index is missing. The query fingerprint at the bottom is what you feed to EXPLAIN."
```

---

## Optimizer Hints

Sometimes the optimizer makes a suboptimal choice - it picks the wrong index, or avoids an index you know is faster. MySQL provides two levels of influence over the optimizer.

### Table-Level Index Hints

These legacy hints are placed after the table name in the `FROM` clause:

```sql
-- Suggest an index (optimizer can still ignore it)
SELECT * FROM orders USE INDEX (idx_status) WHERE status = 'pending';

-- Force an index (optimizer must use it or do a full scan)
SELECT * FROM orders FORCE INDEX (idx_created_at)
WHERE created_at > '2025-01-01' ORDER BY created_at;

-- Exclude an index from consideration
SELECT * FROM orders IGNORE INDEX (idx_status)
WHERE status = 'pending' AND created_at > '2025-01-01';
```

`USE INDEX` gives the optimizer a suggestion. `FORCE INDEX` removes all other index options, leaving only the specified index and a full table scan. `IGNORE INDEX` removes a specific index from consideration.

### MySQL 8.0 Optimizer Hints

MySQL 8.0 introduced a more granular hint syntax using `/*+ ... */` comments placed immediately after the `SELECT` keyword:

```sql
-- Force a join order
SELECT /*+ JOIN_ORDER(c, o) */ c.name, o.total
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'US';

-- Disable index merge optimization
SELECT /*+ NO_INDEX_MERGE(orders) */ *
FROM orders WHERE status = 'pending' OR customer_id = 42;

-- Set a per-query resource limit
SELECT /*+ MAX_EXECUTION_TIME(5000) */ *
FROM orders WHERE status = 'pending';

-- Hint the optimizer to use a specific index
SELECT /*+ INDEX(o idx_status_created) */ o.order_id
FROM orders o WHERE o.status = 'pending';
```

Common optimizer hints:

| Hint | Effect |
|------|--------|
| `JOIN_ORDER(t1, t2)` | Force a specific join order |
| `NO_JOIN_ORDER()` | Let the optimizer choose join order freely |
| `INDEX(tbl idx)` | Use a specific index |
| `NO_INDEX(tbl idx)` | Avoid a specific index |
| `MERGE(tbl)` / `NO_MERGE(tbl)` | Force or prevent merging a derived table into the outer query |
| `MAX_EXECUTION_TIME(ms)` | Kill the query if it exceeds the time limit |
| `SET_VAR(var=val)` | Set a session variable for the duration of this query |

!!! danger "Hints are a last resort"
    In most cases, the optimizer makes correct decisions when it has accurate statistics and well-designed indexes. If you find yourself relying on hints, first check whether `ANALYZE TABLE` would fix stale statistics, whether a better index exists, or whether you can rewrite the query. Hints create maintenance burden because they bypass the optimizer's ability to adapt to data changes.

```quiz
question: "What is the difference between USE INDEX and FORCE INDEX?"
type: multiple-choice
options:
  - text: "They are interchangeable - both force MySQL to use the specified index"
    feedback: "They behave differently. USE INDEX is a suggestion the optimizer can ignore if it estimates a table scan would be cheaper. FORCE INDEX is stronger."
  - text: "USE INDEX suggests an index (optimizer can still choose a table scan if cheaper); FORCE INDEX removes all other index options, leaving only the specified index or a full table scan"
    correct: true
    feedback: "Correct! USE INDEX limits the optimizer's index choices but still allows it to pick a table scan if that's estimated as cheaper. FORCE INDEX is more aggressive - the optimizer will use the specified index unless a table scan is the only other option."
  - text: "USE INDEX works on SELECT; FORCE INDEX works on INSERT and UPDATE"
    feedback: "Both hints work on the same statement types. The difference is in how strongly they influence the optimizer's index choice."
  - text: "FORCE INDEX creates the index if it doesn't exist; USE INDEX only works with existing indexes"
    feedback: "Neither hint creates indexes. Both reference existing indexes by name. If the named index doesn't exist, MySQL returns an error."
```

---

## Common Anti-Patterns

These mistakes account for the majority of MySQL performance problems in application code.

### SELECT *

```sql
-- Bad: reads every column, even those you don't need
SELECT * FROM orders WHERE customer_id = 42;

-- Good: read only what you need
SELECT order_id, total, status FROM orders WHERE customer_id = 42;
```

`SELECT *` prevents the use of covering indexes, transfers unnecessary data over the network, and breaks if columns are added or removed. Always specify the columns you need.

### Missing Indexes on JOIN Columns

Every column used in a `JOIN ... ON` condition should have an index. Without one, MySQL scans the entire table for each row from the driving table.

```sql
-- If orders.customer_id has no index, this is a full scan of orders for each customer
SELECT c.name, o.total
FROM customers c
JOIN orders o ON o.customer_id = c.id;
```

Check for missing indexes with:

```sql
EXPLAIN SELECT ... ;  -- Look for type=ALL on joined tables
```

### N+1 Queries

The **N+1 problem** happens when application code fetches a list of records, then makes a separate query for each row's related data:

```python
# N+1 anti-pattern
customers = db.query("SELECT * FROM customers WHERE country = 'US'")
for customer in customers:
    orders = db.query(f"SELECT * FROM orders WHERE customer_id = {customer.id}")
```

This fires one query for the customer list, then N queries for orders - one per customer. If there are 10,000 US customers, that's 10,001 queries.

Fix it with a single JOIN or a batch `IN` query:

```sql
-- Single query with JOIN
SELECT c.id, c.name, o.order_id, o.total
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'US';

-- Or batch the IDs
SELECT * FROM orders WHERE customer_id IN (1, 2, 3, ...);
```

### Functions on Indexed Columns

Applying a function to an indexed column prevents MySQL from using the index:

```sql
-- Bad: function on the indexed column prevents index usage
SELECT * FROM orders WHERE YEAR(created_at) = 2025;

-- Good: rewrite as a range that preserves the index
SELECT * FROM orders
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
```

```sql
-- Bad: LOWER() prevents index usage
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- Good: use a case-insensitive collation, or a generated column with an index
ALTER TABLE users ADD email_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(email)) STORED;
CREATE INDEX idx_email_lower ON users (email_lower);
```

The optimizer cannot "see through" function calls to know that the result corresponds to index entries. Any transformation - `YEAR()`, `DATE()`, `LOWER()`, `CAST()`, arithmetic - makes the index invisible to that query.

!!! tip "MySQL 8.0 functional indexes"
    MySQL 8.0.13+ supports **functional indexes** that index expression results directly:

    ```sql
    CREATE INDEX idx_year ON orders ((YEAR(created_at)));
    ```

    This creates a hidden generated column and indexes it. Now `WHERE YEAR(created_at) = 2025` can use the index.

### Implicit Type Conversions

When the `WHERE` clause compares a column to a value of a different type, MySQL silently converts one side. If it converts the column, the index becomes unusable:

```sql
-- orders.order_ref is VARCHAR(20), indexed
-- Bad: comparing a string column to an integer triggers implicit conversion
SELECT * FROM orders WHERE order_ref = 12345;

-- Good: match the type
SELECT * FROM orders WHERE order_ref = '12345';
```

MySQL converts the `VARCHAR` column to a number for every row, turning an index lookup into a full table scan. Always match the literal type to the column type.

---

## Optimization Workflow

When a query is slow, follow this sequence:

1. **Get the query** - from the slow query log, `pt-query-digest`, or application logs
2. **Run EXPLAIN** - identify full table scans, missing indexes, filesorts, and temporary tables
3. **Check the indexes** - does the table have appropriate indexes for the `WHERE`, `JOIN`, `ORDER BY`, and `GROUP BY` clauses?
4. **Check for anti-patterns** - functions on indexed columns, implicit conversions, `SELECT *`, N+1 queries
5. **Add or adjust indexes** - create composite indexes that cover the query's filtering and sorting needs
6. **Verify with EXPLAIN again** - confirm the new index is used and row estimates dropped
7. **Measure** - run the query and compare before/after execution times

```exercise
title: Optimize a Slow Query
difficulty: intermediate
scenario: |
  You are investigating a report that the order summary page is slow. The application runs this query, which takes 4.8 seconds:

  ```sql
  SELECT c.name, c.email, COUNT(o.order_id) AS order_count,
         SUM(o.total) AS total_spent, MAX(o.created_at) AS last_order
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
  WHERE c.signup_date > '2024-01-01'
  GROUP BY c.id
  ORDER BY total_spent DESC
  LIMIT 50;
  ```

  Table information:
  - `customers` has 500,000 rows. Primary key on `id`. No other indexes.
  - `orders` has 5,000,000 rows. Primary key on `order_id`. No other indexes.

  Your task:
  1. Predict what EXPLAIN will show for this query (access types, row estimates, Extra column)
  2. Identify the missing indexes
  3. Write the CREATE INDEX statements to fix the performance
  4. Determine whether a covering index is possible for either table
  5. Predict the EXPLAIN output after adding your indexes
hints:
  - "Start with the JOIN condition - every ON column needs an index on the joined table"
  - "The WHERE clause on signup_date needs an index on the customers table"
  - "For a composite index, put equality columns before range columns"
  - "Think about what columns the query actually reads from each table - could an index cover all of them?"
  - "The GROUP BY on c.id is already the primary key, so no extra index needed for grouping"
solution: |
  **Step 1 - Predict EXPLAIN before indexes:**

  - `customers` table: type=ALL (no index on signup_date), rows=500000, Extra: Using where; Using temporary; Using filesort
  - `orders` table: type=ALL (no index on customer_id), rows=5000000 per customer match

  **Step 2 - Missing indexes:**

  - `orders.customer_id` - needed for the JOIN condition
  - `customers.signup_date` - needed for the WHERE filter

  **Step 3 - CREATE INDEX statements:**

  ```sql
  -- Index for the JOIN on orders
  CREATE INDEX idx_customer_id ON orders (customer_id);

  -- Index for the WHERE filter on customers
  CREATE INDEX idx_signup_date ON customers (signup_date);
  ```

  **Step 4 - Covering index analysis:**

  The query reads `customer_id`, `order_id`, `total`, and `created_at` from orders. A covering index would be:

  ```sql
  CREATE INDEX idx_orders_covering ON orders (customer_id, total, created_at, order_id);
  ```

  This lets MySQL compute COUNT, SUM, and MAX entirely from the index without touching the table data. For customers, the query needs `name` and `email` which vary in length - a covering index is less practical since it would include all output columns.

  **Step 5 - EXPLAIN after indexes:**

  - `customers` table: type=range (using idx_signup_date), rows ~50000, Extra: Using index condition
  - `orders` table: type=ref (using idx_customer_id or idx_orders_covering), rows ~10 per customer, Extra: Using index (if covering index is used)

  The query should drop from 4.8 seconds to under 100 milliseconds.
```

---

## Further Reading

- [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.0/en/explain-output.html) - official reference for every column and value in EXPLAIN output
- [MySQL Optimization Guide](https://dev.mysql.com/doc/refman/8.0/en/optimization.html) - the full MySQL optimization reference covering indexes, query tuning, and server configuration
- [Percona Toolkit Documentation](https://docs.percona.com/percona-toolkit/) - documentation for `pt-query-digest` and the full Percona Toolkit suite
- [Use The Index, Luke](https://use-the-index-luke.com/) - a site dedicated to SQL indexing and tuning, with database-agnostic explanations of how indexes work
- [MySQL Performance Schema](https://dev.mysql.com/doc/refman/8.0/en/performance-schema.html) - official documentation for the Performance Schema instrumentation framework
- [High Performance MySQL, 4th Edition](https://www.oreilly.com/library/view/high-performance-mysql/9781492080503/) - comprehensive book covering MySQL performance from schema design to server tuning

---

**Previous:** [MySQL Administration](mysql-administration.md) | **Next:** [MySQL Replication & High Availability](mysql-replication.md) | [Back to Index](README.md)
