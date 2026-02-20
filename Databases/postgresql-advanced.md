# PostgreSQL Advanced Features

PostgreSQL extends well beyond standard SQL. Features like recursive CTEs, window functions, native JSON support, and built-in full-text search let you solve problems at the database layer that would otherwise require application code, external search engines, or additional infrastructure. This guide covers the capabilities that make PostgreSQL a practical choice for complex workloads.

---

## Common Table Expressions (CTEs)

A **Common Table Expression** (CTE) is a named temporary result set defined with the `WITH` clause. It exists only for the duration of a single query, and you reference it by name like a table.

```sql
WITH active_customers AS (
    SELECT customer_id, name, email
    FROM customers
    WHERE status = 'active'
)
SELECT ac.name, o.total
FROM active_customers ac
JOIN orders o ON o.customer_id = ac.customer_id
WHERE o.total > 100;
```

CTEs improve readability when a query has multiple logical steps. You can chain them:

```sql
WITH monthly_totals AS (
    SELECT customer_id,
           DATE_TRUNC('month', order_date) AS month,
           SUM(total) AS month_total
    FROM orders
    GROUP BY customer_id, DATE_TRUNC('month', order_date)
),
ranked AS (
    SELECT customer_id, month, month_total,
           RANK() OVER (PARTITION BY month ORDER BY month_total DESC) AS rank
    FROM monthly_totals
)
SELECT * FROM ranked WHERE rank <= 10;
```

### Recursive CTEs

**Recursive CTEs** use `WITH RECURSIVE` to traverse hierarchical data - org charts, threaded comments, file trees, bill-of-materials structures. The query has two parts: a base case (the anchor) and a recursive step that references the CTE itself.

```sql
WITH RECURSIVE org_chart AS (
    -- Base case: top-level managers (no manager_id)
    SELECT employee_id, name, manager_id, 1 AS depth
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive step: find reports of each person found so far
    SELECT e.employee_id, e.name, e.manager_id, oc.depth + 1
    FROM employees e
    JOIN org_chart oc ON e.manager_id = oc.employee_id
)
SELECT depth, name, employee_id, manager_id
FROM org_chart
ORDER BY depth, name;
```

PostgreSQL executes this iteratively: it runs the base case first, then repeatedly executes the recursive step using the previous iteration's results until no new rows are produced.

```code-walkthrough
title: Recursive CTE - Building a Category Tree
description: Walking through a recursive CTE that builds a full path for nested product categories.
code: |
  WITH RECURSIVE category_tree AS (
      SELECT id, name, parent_id,
             name::TEXT AS full_path,
             1 AS depth
      FROM categories
      WHERE parent_id IS NULL

      UNION ALL

      SELECT c.id, c.name, c.parent_id,
             ct.full_path || ' > ' || c.name,
             ct.depth + 1
      FROM categories c
      JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT full_path, depth
  FROM category_tree
  ORDER BY full_path;
language: sql
annotations:
  - line: 1
    text: "WITH RECURSIVE declares a CTE that can reference itself. PostgreSQL will execute it iteratively until no new rows are produced."
  - line: 2
    text: "The anchor (base case) SELECT runs first. Lines 2-6 select root categories where parent_id IS NULL. Every recursive CTE starts with a non-recursive query."
  - line: 3
    text: "Casting name to TEXT is necessary because the recursive step concatenates strings. PostgreSQL needs matching types across UNION ALL branches."
  - line: 4
    text: "Track depth so you can indent the output or limit recursion depth with a WHERE clause in the recursive step."
  - line: 8
    text: "UNION ALL separates the anchor from the recursive step. Use UNION ALL, not UNION - deduplication on each iteration would break most recursive patterns and hurt performance."
  - line: 10
    text: "The recursive step joins the source table against the CTE itself. Each iteration processes the rows found in the previous iteration."
  - line: 11
    text: "Build the full path by concatenating the parent's path with the current category name. After three iterations, you might see 'Electronics > Computers > Laptops'."
  - line: 16
    text: "The final SELECT reads from the completed CTE. All iterations have finished by this point."
```

!!! warning "Infinite recursion"
    If your data has cycles (a row that eventually points back to itself), a recursive CTE will run forever. Add a depth limit (`WHERE ct.depth < 20`) in the recursive step, or use `CYCLE` detection (PostgreSQL 14+): `CYCLE id SET is_cycle USING path`.

### Materialized vs Non-Materialized CTEs

Before PostgreSQL 12, CTEs were always **materialized** - PostgreSQL executed the CTE once, stored the full result, and scanned it for each reference. This prevented the optimizer from pushing predicates into the CTE.

PostgreSQL 12+ defaults to **inlining** (non-materializing) CTEs that are referenced only once, treating them like subqueries. You can control this explicitly:

```sql
-- Force materialization (useful when the CTE is referenced multiple times)
WITH expensive_query AS MATERIALIZED (
    SELECT * FROM large_table WHERE complex_condition
)
SELECT * FROM expensive_query WHERE id = 5;

-- Force inlining (lets the planner push filters down)
WITH simple_filter AS NOT MATERIALIZED (
    SELECT * FROM orders WHERE status = 'shipped'
)
SELECT * FROM simple_filter WHERE customer_id = 42;
```

Use `MATERIALIZED` when the CTE result is reused multiple times. Use `NOT MATERIALIZED` (or just let the planner decide) when the CTE is referenced once and you want predicate pushdown.

```quiz
question: "What happens if a recursive CTE's data contains a cycle (e.g., employee A reports to B, B reports to C, C reports to A)?"
type: multiple-choice
options:
  - text: "PostgreSQL detects the cycle and stops automatically"
    feedback: "PostgreSQL does not detect cycles by default. Without protection, the recursive CTE will run indefinitely until it hits a memory or iteration limit."
  - text: "The query runs forever (or until a resource limit is hit)"
    correct: true
    feedback: "Correct. Recursive CTEs will loop indefinitely on cyclic data. You need to add explicit cycle protection - either a depth limit in the WHERE clause (WHERE depth < 20) or the CYCLE clause introduced in PostgreSQL 14."
  - text: "PostgreSQL returns only the first occurrence of each row"
    feedback: "UNION ALL does not deduplicate. Even UNION would not help here because each iteration produces rows with different depth values, so they are not exact duplicates."
  - text: "The CTE returns an empty result set"
    feedback: "The CTE would produce rows continuously. It would not return empty - it would never finish."
```

---

## Window Functions

**Window functions** perform calculations across a set of rows related to the current row without collapsing them into a single output row. Unlike `GROUP BY`, which reduces rows, window functions preserve every row and add computed columns.

The core syntax is:

```sql
function_name() OVER (
    PARTITION BY column     -- divide rows into groups
    ORDER BY column         -- order within each group
    frame_specification     -- which rows to include in the calculation
)
```

### Ranking Functions

`ROW_NUMBER()`, `RANK()`, and `DENSE_RANK()` assign positions within partitions:

```sql
SELECT
    department,
    employee_name,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS row_num,
    RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rank,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dense_rank
FROM employees;
```

| department | employee_name | salary | row_num | rank | dense_rank |
|-----------|---------------|--------|---------|------|------------|
| Engineering | Alice | 150000 | 1 | 1 | 1 |
| Engineering | Bob | 150000 | 2 | 1 | 1 |
| Engineering | Carol | 130000 | 3 | 3 | 2 |
| Sales | Dave | 120000 | 1 | 1 | 1 |
| Sales | Eve | 110000 | 2 | 2 | 2 |

The differences: `ROW_NUMBER()` always assigns unique sequential numbers (ties get arbitrary ordering). `RANK()` gives tied rows the same rank but skips subsequent numbers (1, 1, 3). `DENSE_RANK()` gives tied rows the same rank without gaps (1, 1, 2).

### LAG() and LEAD()

`LAG()` and `LEAD()` access values from previous and subsequent rows:

```sql
SELECT
    order_date,
    total,
    LAG(total)  OVER (ORDER BY order_date) AS prev_total,
    LEAD(total) OVER (ORDER BY order_date) AS next_total,
    total - LAG(total) OVER (ORDER BY order_date) AS change
FROM orders
WHERE customer_id = 42;
```

This gives you row-by-row comparisons without self-joins. `LAG(total, 2)` looks two rows back. `LAG(total, 1, 0)` specifies a default value of 0 when there is no previous row.

### Frame Specification and Running Totals

The **frame specification** controls which rows the window function considers relative to the current row:

```sql
-- Running total (all rows from start to current row)
SELECT
    order_date,
    total,
    SUM(total) OVER (ORDER BY order_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders;

-- 3-day moving average
SELECT
    order_date,
    total,
    AVG(total) OVER (ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3
FROM orders;

-- Percentage of department total
SELECT
    department,
    employee_name,
    salary,
    ROUND(salary * 100.0 / SUM(salary) OVER (PARTITION BY department), 1) AS pct_of_dept
FROM employees;
```

Common frame options:

| Frame | Meaning |
|-------|---------|
| `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` | All rows from start to current (default with `ORDER BY`) |
| `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` | Current row plus the two before it |
| `ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING` | Current row to the end |
| `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` | All rows in the partition |

```terminal
title: Window Functions in Practice
steps:
  - command: "psql -d analytics -c \"CREATE TABLE daily_sales (sale_date DATE, region TEXT, amount NUMERIC); INSERT INTO daily_sales VALUES ('2024-01-01','East',500), ('2024-01-02','East',300), ('2024-01-03','East',700), ('2024-01-04','East',200), ('2024-01-05','East',600), ('2024-01-01','West',400), ('2024-01-02','West',800), ('2024-01-03','West',350);\""
    output: |
      CREATE TABLE
      INSERT 0 8
    narration: "Create a small daily_sales table with two regions. This gives us data to partition and window over."
  - command: "psql -d analytics -c \"SELECT sale_date, region, amount, SUM(amount) OVER (PARTITION BY region ORDER BY sale_date) AS running_total FROM daily_sales ORDER BY region, sale_date;\""
    output: |
       sale_date  | region | amount | running_total
      ------------+--------+--------+---------------
       2024-01-01 | East   |    500 |           500
       2024-01-02 | East   |    300 |           800
       2024-01-03 | East   |    700 |          1500
       2024-01-04 | East   |    200 |          1700
       2024-01-05 | East   |    600 |          2300
       2024-01-01 | West   |    400 |           400
       2024-01-02 | West   |    800 |          1200
       2024-01-03 | West   |    350 |          1550
      (8 rows)
    narration: "PARTITION BY region restarts the running total for each region. Within each partition, ORDER BY sale_date accumulates the sum chronologically. East reaches 2300, West reaches 1550 - each computed independently."
  - command: "psql -d analytics -c \"SELECT sale_date, region, amount, RANK() OVER (PARTITION BY region ORDER BY amount DESC) AS rank, amount - LAG(amount) OVER (PARTITION BY region ORDER BY sale_date) AS day_over_day FROM daily_sales ORDER BY region, sale_date;\""
    output: |
       sale_date  | region | amount | rank | day_over_day
      ------------+--------+--------+------+--------------
       2024-01-01 | East   |    500 |    3 |
       2024-01-02 | East   |    300 |    4 |         -200
       2024-01-03 | East   |    700 |    1 |          400
       2024-01-04 | East   |    200 |    5 |         -500
       2024-01-05 | East   |    600 |    2 |          400
       2024-01-01 | West   |    400 |    2 |
       2024-01-02 | West   |    800 |    1 |          400
       2024-01-03 | West   |    350 |    3 |         -450
      (8 rows)
    narration: "Multiple window functions in one query. RANK orders by amount descending (700 is rank 1 in East). LAG computes day-over-day change (Jan 3 East jumped 400 from 300 to 700). The first row in each partition has NULL for day_over_day because there is no previous row."
  - command: "psql -d analytics -c \"SELECT sale_date, region, amount, AVG(amount) OVER (PARTITION BY region ORDER BY sale_date ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS moving_avg FROM daily_sales WHERE region = 'East' ORDER BY sale_date;\""
    output: |
       sale_date  | region | amount |     moving_avg
      ------------+--------+--------+--------------------
       2024-01-01 | East   |    500 | 400.0000000000000000
       2024-01-02 | East   |    300 | 500.0000000000000000
       2024-01-03 | East   |    700 | 400.0000000000000000
       2024-01-04 | East   |    200 | 500.0000000000000000
       2024-01-05 | East   |    600 | 400.0000000000000000
      (5 rows)
    narration: "A centered 3-point moving average: each row averages itself with one row before and one after. The first row only has itself and the next row (two values). The last row only has itself and the previous row. Middle rows use all three. ROWS BETWEEN controls the frame precisely."
```

```quiz
question: "What is the difference between RANK() and DENSE_RANK() when two rows tie?"
type: multiple-choice
options:
  - text: "RANK() skips the next number after a tie; DENSE_RANK() does not"
    correct: true
    feedback: "Correct. If two rows tie for rank 1, RANK() assigns 1, 1, 3 (skipping 2). DENSE_RANK() assigns 1, 1, 2 (no gap). Choose based on whether you need to know how many rows ranked above you (RANK) or how many distinct ranking positions exist (DENSE_RANK)."
  - text: "RANK() handles ties; DENSE_RANK() always assigns unique numbers"
    feedback: "Both RANK() and DENSE_RANK() assign the same rank to tied rows. It is ROW_NUMBER() that always assigns unique sequential numbers."
  - text: "They are aliases - both behave identically"
    feedback: "They differ in how they handle the numbers after a tie. RANK() skips values (1,1,3), DENSE_RANK() does not (1,1,2)."
  - text: "DENSE_RANK() is faster because it does not need to count gaps"
    feedback: "Performance is virtually identical. The difference is purely in the numbering sequence, not computation cost."
```

---

## JSONB

PostgreSQL's **JSONB** type stores JSON data in a decomposed binary format. Unlike the `JSON` type (which stores the exact text), JSONB is parsed on input, supports indexing, and allows efficient querying of nested structures.

### Operators

```sql
-- Create a table with JSONB
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT,
    attributes JSONB
);

INSERT INTO products (name, attributes) VALUES
('Laptop', '{"brand": "ThinkPad", "specs": {"ram": 16, "storage": 512}, "tags": ["business", "portable"]}'),
('Monitor', '{"brand": "Dell", "specs": {"size": 27, "resolution": "4K"}, "tags": ["display"]}');
```

The key operators:

| Operator | Returns | Example | Result |
|----------|---------|---------|--------|
| `->` | JSONB element | `attributes -> 'brand'` | `"ThinkPad"` (JSONB) |
| `->>` | Text value | `attributes ->> 'brand'` | `ThinkPad` (text) |
| `#>` | JSONB at path | `attributes #> '{specs,ram}'` | `16` (JSONB) |
| `#>>` | Text at path | `attributes #>> '{specs,ram}'` | `16` (text) |
| `@>` | Contains | `attributes @> '{"brand":"Dell"}'` | `true` |
| `?` | Key exists | `attributes ? 'brand'` | `true` |
| `?|` | Any key exists | `attributes ?| array['brand','color']` | `true` |
| `?&` | All keys exist | `attributes ?& array['brand','color']` | `false` |

```sql
-- Find products with 16GB RAM
SELECT name FROM products
WHERE attributes #>> '{specs,ram}' = '16';

-- Find products that contain a specific key-value pair
SELECT name FROM products
WHERE attributes @> '{"brand": "Dell"}';

-- Find products tagged as "business"
SELECT name FROM products
WHERE attributes -> 'tags' ? 'business';
```

### JSONB Functions

`jsonb_each()` and `jsonb_array_elements()` expand JSONB into rows:

```sql
-- Expand top-level keys into rows
SELECT p.name, kv.key, kv.value
FROM products p, jsonb_each(p.attributes) AS kv
WHERE kv.key != 'tags';

-- Expand array elements
SELECT p.name, tag
FROM products p, jsonb_array_elements_text(p.attributes -> 'tags') AS tag;
```

### Indexing JSONB with GIN

A **GIN index** (Generalized Inverted Index) on a JSONB column indexes every key and value in the document, making containment (`@>`) and existence (`?`) queries fast:

```sql
CREATE INDEX idx_product_attrs ON products USING GIN (attributes);

-- These queries use the GIN index
SELECT * FROM products WHERE attributes @> '{"brand": "Dell"}';
SELECT * FROM products WHERE attributes ? 'specs';
```

For queries on a specific key path, a **btree index on an expression** is more efficient than a full GIN index:

```sql
CREATE INDEX idx_product_brand ON products ((attributes ->> 'brand'));

-- Uses the btree expression index
SELECT * FROM products WHERE attributes ->> 'brand' = 'ThinkPad';
```

!!! tip "JSONB vs normalized tables"
    Use JSONB for truly variable attributes - product specifications, user preferences, API responses where the schema differs per record. If you find yourself querying the same JSONB keys repeatedly with `WHERE` clauses, those keys should probably be proper columns. JSONB is flexible but slower to query than indexed columns on normalized tables.

```terminal
title: Querying JSONB Data
steps:
  - command: "psql -d appdb -c \"CREATE TABLE events (id SERIAL, payload JSONB); INSERT INTO events (payload) VALUES ('{\"type\": \"click\", \"page\": \"/home\", \"user\": {\"id\": 1, \"plan\": \"pro\"}}'), ('{\"type\": \"purchase\", \"amount\": 49.99, \"user\": {\"id\": 2, \"plan\": \"free\"}}'), ('{\"type\": \"click\", \"page\": \"/pricing\", \"user\": {\"id\": 1, \"plan\": \"pro\"}}');\""
    output: |
      CREATE TABLE
      INSERT 0 3
    narration: "Create an events table with a JSONB payload column. Each event has a different structure - clicks have a page field, purchases have an amount field. This is a good JSONB use case because the schema varies by event type."
  - command: "psql -d appdb -c \"SELECT payload ->> 'type' AS event_type, payload #>> '{user,id}' AS user_id FROM events;\""
    output: |
       event_type | user_id
      ------------+---------
       click      | 1
       purchase   | 2
       click      | 1
      (3 rows)
    narration: "The ->> operator extracts a top-level key as text. The #>> operator navigates a path (user then id) and returns text. Use -> and #> instead if you need the result as JSONB for further operations."
  - command: "psql -d appdb -c \"SELECT payload ->> 'type' AS event_type, payload -> 'amount' AS amount FROM events WHERE payload @> '{\\\"type\\\": \\\"purchase\\\"}';\""
    output: |
       event_type | amount
      ------------+--------
       purchase   | 49.99
      (1 row)
    narration: "The @> operator tests containment: does the document contain this sub-document? This is the operator that benefits most from a GIN index. It found the one purchase event."
  - command: "psql -d appdb -c \"CREATE INDEX idx_events_payload ON events USING GIN (payload); EXPLAIN SELECT * FROM events WHERE payload @> '{\\\"type\\\": \\\"purchase\\\"}';\""
    output: |
      CREATE INDEX
                                        QUERY PLAN
      -------------------------------------------------------------------------------
       Bitmap Heap Scan on events  (cost=12.00..16.01 rows=1 width=36)
         Recheck Cond: (payload @> '{"type": "purchase"}'::jsonb)
         ->  Bitmap Index Scan on idx_events_payload  (cost=0.00..12.00 rows=1 width=0)
               Index Cond: (payload @> '{"type": "purchase"}'::jsonb)
      (4 rows)
    narration: "EXPLAIN confirms the GIN index is used for the @> containment query. On a table with millions of events, this index prevents a full table scan. Without it, PostgreSQL would read every row and parse every JSONB document."
```

---

## Table Partitioning

**Table partitioning** splits a large table into smaller physical pieces (partitions) while presenting a single logical table to queries. PostgreSQL supports **declarative partitioning** (10+), which handles partition routing and constraint enforcement automatically.

### Partition Strategies

PostgreSQL supports three partitioning methods:

- **RANGE** - partition by value ranges (dates, IDs). The most common strategy for time-series data.
- **LIST** - partition by discrete values (region, status, category).
- **HASH** - distribute rows evenly across partitions using a hash function.

### Range Partitioning Example

```sql
-- Create the partitioned parent table
CREATE TABLE sensor_readings (
    sensor_id   INTEGER NOT NULL,
    reading_time TIMESTAMPTZ NOT NULL,
    value       DOUBLE PRECISION,
    quality     TEXT
) PARTITION BY RANGE (reading_time);

-- Create monthly partitions
CREATE TABLE sensor_readings_2024_01 PARTITION OF sensor_readings
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE sensor_readings_2024_02 PARTITION OF sensor_readings
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE sensor_readings_2024_03 PARTITION OF sensor_readings
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Create a default partition for data outside defined ranges
CREATE TABLE sensor_readings_default PARTITION OF sensor_readings DEFAULT;
```

Queries that filter on `reading_time` automatically skip irrelevant partitions - this is **partition pruning**:

```sql
-- Only scans sensor_readings_2024_02
SELECT AVG(value)
FROM sensor_readings
WHERE reading_time >= '2024-02-01' AND reading_time < '2024-03-01';

-- EXPLAIN confirms partition pruning
EXPLAIN SELECT * FROM sensor_readings WHERE reading_time = '2024-02-15';
--  Append
--    ->  Seq Scan on sensor_readings_2024_02
--          Filter: (reading_time = '2024-02-15')
```

### List Partitioning

```sql
CREATE TABLE orders (
    id          SERIAL,
    region      TEXT NOT NULL,
    order_date  DATE NOT NULL,
    total       NUMERIC
) PARTITION BY LIST (region);

CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('us-east', 'us-west');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('eu-west', 'eu-central');
CREATE TABLE orders_apac PARTITION OF orders FOR VALUES IN ('ap-southeast', 'ap-northeast');
```

### Managing Partitions

Partitions are regular tables. You can attach existing tables and detach partitions without downtime:

```sql
-- Create the new partition as a regular table
CREATE TABLE sensor_readings_2024_04 (LIKE sensor_readings INCLUDING ALL);

-- Load historical data into it (no partition routing overhead)
COPY sensor_readings_2024_04 FROM '/data/april_readings.csv' CSV HEADER;

-- Attach it to the partitioned table
ALTER TABLE sensor_readings
    ATTACH PARTITION sensor_readings_2024_04
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

-- Detach an old partition (for archiving or deletion)
ALTER TABLE sensor_readings
    DETACH PARTITION sensor_readings_2024_01;
```

!!! tip "Indexes on partitioned tables"
    When you create an index on the parent table, PostgreSQL automatically creates matching indexes on all existing partitions and any future partitions. Each partition's index is independent, which keeps index operations fast.

    ```sql
    -- Creates an index on every partition
    CREATE INDEX idx_sensor_time ON sensor_readings (reading_time);
    ```

---

## Full-Text Search

PostgreSQL has built-in **full-text search** (FTS) that eliminates the need for external tools like Elasticsearch for many use cases. FTS uses two core types: `tsvector` (a processed document) and `tsquery` (a search query).

### tsvector and tsquery

A **tsvector** is a sorted list of normalized words (lexemes) with position information. A **tsquery** is a search expression with boolean operators.

```sql
-- Convert text to tsvector
SELECT to_tsvector('english', 'The quick brown foxes jumped over lazy dogs');
-- 'brown':3 'dog':9 'fox':4 'jump':5 'lazi':8 'quick':2

-- Convert text to tsquery
SELECT to_tsquery('english', 'quick & foxes');
-- 'quick' & 'fox'

-- plainto_tsquery handles plain text (no operators needed)
SELECT plainto_tsquery('english', 'quick brown fox');
-- 'quick' & 'brown' & 'fox'
```

Notice that FTS normalizes words: "foxes" becomes "fox", "jumped" becomes "jump", "lazy" becomes "lazi". The `english` dictionary handles stemming, stop word removal ("the" is dropped), and case normalization.

### The @@ Match Operator

The `@@` operator matches a `tsvector` against a `tsquery`:

```sql
-- Search articles
SELECT title, body
FROM articles
WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', 'database & replication');
```

### Stored tsvector Columns and GIN Indexes

Calling `to_tsvector()` on every query is expensive. Store the processed vector in a column and index it:

```sql
-- Add a tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Populate it
UPDATE articles
SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body, ''));

-- Keep it updated with a trigger
CREATE FUNCTION articles_search_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_search
    BEFORE INSERT OR UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION articles_search_update();

-- Create a GIN index on the stored vector
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

-- Fast searches using the index
SELECT title
FROM articles
WHERE search_vector @@ to_tsquery('english', 'postgresql & partitioning');
```

### Relevance Ranking

`ts_rank()` scores how well a document matches a query, based on lexeme frequency and position:

```sql
SELECT
    title,
    ts_rank(search_vector, query) AS rank
FROM
    articles,
    to_tsquery('english', 'replication | failover') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

You can weight different parts of a document by assigning labels (A, B, C, D) to `tsvector` components:

```sql
UPDATE articles
SET search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(body, '')), 'B');
```

Titles (weight A) now contribute more to the rank score than body text (weight B). The default weights are A=1.0, B=0.4, C=0.2, D=0.1.

```quiz
question: "Why should you store a tsvector column and index it with GIN, rather than calling to_tsvector() inline in every query?"
type: multiple-choice
options:
  - text: "to_tsvector() cannot be used in WHERE clauses"
    feedback: "to_tsvector() works in WHERE clauses. The issue is performance, not syntax."
  - text: "Inline to_tsvector() calls reprocess every row on every query; a stored column with a GIN index makes searches use the index instead of scanning the full table"
    correct: true
    feedback: "Correct. Without a stored tsvector column and GIN index, PostgreSQL must call to_tsvector() on every row of the table for every search query - a full table scan with string processing. A pre-computed column with a GIN index turns this into an index lookup, reducing search time from seconds to milliseconds on large tables."
  - text: "GIN indexes only work on columns, not on function results"
    feedback: "PostgreSQL supports expression indexes (CREATE INDEX ... ON table USING GIN (to_tsvector('english', column))), so you can index function results. But a stored column is more efficient when combining multiple source columns."
  - text: "Stored tsvector columns use less disk space than the original text"
    feedback: "tsvector columns often use more disk space than the original text because they store position information. The benefit is query speed, not storage savings."
```

---

## Connection Pooling with PgBouncer

PostgreSQL forks a new OS process for every client connection. Each process consumes roughly 5-10 MB of RAM. At 500 connections, that is 2.5-5 GB dedicated just to connection overhead - and context switching between hundreds of processes degrades performance. Most of those connections are idle most of the time.

[**PgBouncer**](https://www.pgbouncer.org/) sits between your application and PostgreSQL, maintaining a small pool of actual database connections and multiplexing client connections across them.

### Pooling Modes

| Mode | Behavior | Use case |
|------|----------|----------|
| **Transaction pooling** | Connection returned to pool after each transaction completes | Most applications. Default choice. |
| **Session pooling** | Connection held until client disconnects | Applications using session-level features (prepared statements, temp tables, `SET` commands) |
| **Statement pooling** | Connection returned after each statement | Simple autocommit workloads only. Breaks multi-statement transactions. |

Transaction pooling is the right choice for most web applications. A pool of 20-30 server connections can serve hundreds of application connections because each request only holds a connection for the duration of its transaction.

### Basic Configuration

The main configuration file is `pgbouncer.ini`:

```ini
[databases]
myapp = host=127.0.0.1 port=5432 dbname=myapp_production

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool sizing
pool_mode = transaction
default_pool_size = 20
max_client_conn = 200
min_pool_size = 5

; Timeouts
server_idle_timeout = 300
client_idle_timeout = 0
query_timeout = 30

; Logging
log_connections = 1
log_disconnections = 1
```

The `userlist.txt` file maps usernames to passwords:

```
"myapp_user" "md5encrypted_password_here"
```

Applications connect to PgBouncer on port 6432 instead of PostgreSQL on port 5432. No application code changes are needed beyond updating the connection port.

!!! warning "Transaction pooling limitations"
    In transaction pooling mode, session-level state does not persist between transactions. This breaks: prepared statements (use `DEALLOCATE ALL` after each transaction or enable `max_prepared_statements` in PgBouncer 1.21+), `SET` commands, `LISTEN`/`NOTIFY`, advisory locks, and temporary tables. If your application relies on these, use session pooling mode or refactor the application.

---

## Foreign Data Wrappers

**Foreign Data Wrappers** (FDWs) let you query external data sources - other PostgreSQL servers, CSV files, MySQL databases, REST APIs - as if they were local tables. PostgreSQL handles the connection, query translation, and data transfer.

### postgres_fdw: Cross-Server Queries

`postgres_fdw` connects to other PostgreSQL instances. This is useful for querying reporting replicas, accessing data in separate microservice databases, or migrating data between servers.

```sql
-- Install the extension
CREATE EXTENSION postgres_fdw;

-- Define the remote server
CREATE SERVER reporting_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'reporting.internal', port '5432', dbname 'analytics');

-- Map local user to remote credentials
CREATE USER MAPPING FOR app_user
    SERVER reporting_server
    OPTIONS (user 'readonly', password 'secret');

-- Create a foreign table that mirrors the remote table
CREATE FOREIGN TABLE remote_daily_stats (
    stat_date   DATE,
    page_views  BIGINT,
    unique_users BIGINT,
    avg_session_seconds NUMERIC
) SERVER reporting_server
  OPTIONS (schema_name 'public', table_name 'daily_stats');

-- Query it like a local table
SELECT stat_date, page_views
FROM remote_daily_stats
WHERE stat_date >= CURRENT_DATE - INTERVAL '7 days';
```

You can join local and foreign tables in the same query. PostgreSQL pushes down `WHERE` clauses, `ORDER BY`, and aggregates to the remote server when possible, minimizing data transfer.

```sql
-- Import all tables from a remote schema at once
IMPORT FOREIGN SCHEMA public
    FROM SERVER reporting_server
    INTO local_reporting;
```

### file_fdw: Querying CSV Files

`file_fdw` reads flat files as tables, which is useful for log analysis or importing data without `COPY`:

```sql
CREATE EXTENSION file_fdw;

CREATE SERVER csv_files FOREIGN DATA WRAPPER file_fdw;

CREATE FOREIGN TABLE access_log (
    ip          TEXT,
    request_time TIMESTAMPTZ,
    method      TEXT,
    path        TEXT,
    status      INTEGER,
    bytes       BIGINT
) SERVER csv_files
  OPTIONS (filename '/var/log/app/access.csv', format 'csv', header 'true');

-- Query the CSV file directly with SQL
SELECT ip, COUNT(*) AS requests
FROM access_log
WHERE status >= 500
GROUP BY ip
ORDER BY requests DESC
LIMIT 10;
```

!!! danger "Security with FDWs"
    User mappings store credentials in the `pg_user_mappings` catalog. Only superusers and the mapped user can see the password. Use `pg_read_server_files` role to control who can access `file_fdw`. In production, store FDW credentials in a secrets manager and rotate them regularly.

---

## Practical Exercise

```exercise
title: Building an Analytics Query with Advanced Features
type: scenario
scenario: |
  You manage a SaaS application with the following tables:

  `users` (id, name, email, plan TEXT, metadata JSONB, created_at TIMESTAMPTZ)
  `events` (id, user_id, event_type TEXT, properties JSONB, occurred_at TIMESTAMPTZ)

  The `events` table has 50 million rows spanning 2 years. The `metadata` JSONB column on users contains variable fields like `{"company": "Acme", "industry": "tech", "employee_count": 150}`. The events table grows by ~2 million rows per month.

  Design queries and schema changes to support the analytics requirements below.
tasks:
  - task: "The events table is becoming slow to query. Design a partitioning strategy for it. Write the DDL to convert it to a partitioned table with monthly partitions."
    hint: "Think about which column to partition on and what strategy fits time-series data."
    answer: "Use RANGE partitioning on occurred_at with monthly partitions: CREATE TABLE events_partitioned (id SERIAL, user_id INTEGER, event_type TEXT, properties JSONB, occurred_at TIMESTAMPTZ NOT NULL) PARTITION BY RANGE (occurred_at); Then create monthly partitions: CREATE TABLE events_2024_01 PARTITION OF events_partitioned FOR VALUES FROM ('2024-01-01') TO ('2024-02-01'); Add a DEFAULT partition for safety. Migrate data with INSERT INTO events_partitioned SELECT * FROM events; Then rename tables."
  - task: "Write a query to find each user's most recent 3 events using a window function. Do not use LIMIT or a subquery with MAX()."
    hint: "Use ROW_NUMBER() with PARTITION BY to number each user's events, then filter."
    answer: "WITH numbered AS (SELECT user_id, event_type, occurred_at, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY occurred_at DESC) AS rn FROM events) SELECT user_id, event_type, occurred_at FROM numbered WHERE rn <= 3;"
  - task: "Write a query to find all users whose metadata indicates they are in the 'tech' industry and have more than 100 employees. Add an appropriate index."
    hint: "Use JSONB containment or path extraction operators. Consider which index type supports each."
    answer: "Query: SELECT name, email FROM users WHERE metadata @> '{\"industry\": \"tech\"}' AND (metadata ->> 'employee_count')::INTEGER > 100; For the containment check, a GIN index works: CREATE INDEX idx_users_metadata ON users USING GIN (metadata); For the employee_count comparison, an expression btree index is more selective: CREATE INDEX idx_users_emp_count ON users (((metadata ->> 'employee_count')::INTEGER));"
  - task: "Add full-text search to the events table so users can search event properties. Write the DDL for the tsvector column, trigger, and index."
    hint: "You need to extract text from the JSONB properties column and create a searchable tsvector."
    answer: "ALTER TABLE events ADD COLUMN search_vector tsvector; UPDATE events SET search_vector = to_tsvector('english', COALESCE(event_type, '') || ' ' || COALESCE(properties::TEXT, '')); CREATE FUNCTION events_search_update() RETURNS trigger AS $$ BEGIN NEW.search_vector := to_tsvector('english', COALESCE(NEW.event_type, '') || ' ' || COALESCE(NEW.properties::TEXT, '')); RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER trg_events_search BEFORE INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION events_search_update(); CREATE INDEX idx_events_search ON events USING GIN (search_vector);"
```

---

## Further Reading

- [PostgreSQL Documentation: WITH Queries (CTEs)](https://www.postgresql.org/docs/current/queries-with.html) - official reference for CTEs including recursive queries
- [PostgreSQL Documentation: Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html) - tutorial and reference for window function syntax and frame specifications
- [PostgreSQL Documentation: JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) - JSONB types, operators, functions, and indexing strategies
- [PostgreSQL Documentation: Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) - declarative partitioning, partition pruning, and management operations
- [PostgreSQL Documentation: Full Text Search](https://www.postgresql.org/docs/current/textsearch.html) - tsvector, tsquery, ranking, dictionaries, and configuration
- [PgBouncer Documentation](https://www.pgbouncer.org/config.html) - configuration reference for connection pooling modes, limits, and authentication

---

**Previous:** [PostgreSQL Administration](postgresql-administration.md) | **Next:** [NoSQL Concepts & Architecture](nosql-concepts.md) | [Back to Index](README.md)
