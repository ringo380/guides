# PostgreSQL Administration

PostgreSQL gives you more control over your database than almost any other RDBMS - but that control comes with responsibilities. You need to understand how roles and privileges work, how to manage the storage layer with tablespaces, why dead tuples accumulate and how VACUUM reclaims them, what the `pg_stat_*` views are telling you, which extensions are worth installing, and how WAL keeps your data safe through crashes. This guide covers the daily administration tasks that keep a PostgreSQL instance running well in production.

---

## Roles and Privileges

PostgreSQL has a single concept for both users and groups: the **role**. A role can own database objects, hold privileges, and contain other roles as members. There is no separate `CREATE USER` and `CREATE GROUP` - those commands exist for convenience, but they all create roles under the hood.

### Creating Roles

Use `CREATE ROLE` to define a new role:

```sql
-- A role that can log in (equivalent to CREATE USER)
CREATE ROLE app_user LOGIN PASSWORD 'strong_password_here';

-- A role that cannot log in (used as a group)
CREATE ROLE readonly NOLOGIN;

-- A role with specific attributes
CREATE ROLE admin_user LOGIN PASSWORD 'another_password'
    CREATEDB CREATEROLE VALID UNTIL '2027-01-01';
```

The key attributes you control at creation time:

| Attribute | Description |
|-----------|-------------|
| `LOGIN` / `NOLOGIN` | Whether the role can connect to the database |
| `SUPERUSER` | Bypasses all permission checks (use sparingly) |
| `CREATEDB` | Can create new databases |
| `CREATEROLE` | Can create, alter, and drop other roles |
| `REPLICATION` | Can initiate streaming replication |
| `PASSWORD` | Sets the authentication password |
| `VALID UNTIL` | Password expiration timestamp |
| `CONNECTION LIMIT` | Maximum concurrent connections for this role |

`CREATE USER` is an alias for `CREATE ROLE ... LOGIN`. `CREATE GROUP` is an alias for `CREATE ROLE ... NOLOGIN`. Use whichever reads more clearly in context.

### GRANT and REVOKE

Privileges in PostgreSQL are granted at the database, schema, and object level. The `GRANT` and `REVOKE` statements control access:

```sql
-- Database-level: allow connecting
GRANT CONNECT ON DATABASE myapp TO app_user;

-- Schema-level: allow using objects in the schema
GRANT USAGE ON SCHEMA public TO app_user;

-- Table-level: specific operations
GRANT SELECT, INSERT, UPDATE ON TABLE orders TO app_user;
GRANT ALL PRIVILEGES ON TABLE orders TO admin_user;

-- All tables in a schema at once
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO readonly;

-- Revoke access
REVOKE INSERT, UPDATE ON TABLE orders FROM app_user;
```

!!! warning "Default privileges only affect future objects"
    `ALTER DEFAULT PRIVILEGES` applies to objects created after the statement runs. Existing tables are unaffected. When setting up a read-only role, you need both `GRANT SELECT ON ALL TABLES` for current tables and `ALTER DEFAULT PRIVILEGES` for tables created later.

### Role Membership and Inheritance

Roles can be members of other roles, forming a group structure. When a role **inherits** from another, it automatically gains that role's privileges:

```sql
-- Create a group role
CREATE ROLE analysts NOLOGIN;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analysts;

-- Add members
GRANT analysts TO alice;
GRANT analysts TO bob;

-- alice and bob now inherit SELECT on all public tables
```

By default, member roles inherit privileges from their parent role. You can control this with `INHERIT` and `NOINHERIT`:

```sql
-- This role must explicitly SET ROLE to gain privileges
CREATE ROLE operator NOLOGIN NOINHERIT;
GRANT admin_role TO operator;

-- The user must switch role context to use admin_role privileges
SET ROLE admin_role;
-- ... do admin work ...
RESET ROLE;
```

`NOINHERIT` is useful when you want a user to consciously activate elevated privileges rather than having them always active - similar to `sudo` on Linux.

### Row-Level Security

**Row-level security** (RLS) lets you control which rows a user can see or modify at the table level, not just which tables they can access. This is powerful for multi-tenant applications where all tenants share a table but should only see their own data.

```sql
-- Step 1: Enable RLS on the table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies
CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.current_tenant')::int);

-- Step 3: Users now only see rows matching the policy
-- The application sets the tenant context per connection:
SET app.current_tenant = '42';
SELECT * FROM orders;  -- Only returns rows where tenant_id = 42
```

You can create separate policies for different operations:

```sql
-- Users can see their own data
CREATE POLICY select_own ON orders
    FOR SELECT
    USING (user_id = current_user);

-- Users can only insert rows attributed to themselves
CREATE POLICY insert_own ON orders
    FOR INSERT
    WITH CHECK (user_id = current_user);

-- Users can update their own rows, but cannot change the user_id
CREATE POLICY update_own ON orders
    FOR UPDATE
    USING (user_id = current_user)
    WITH CHECK (user_id = current_user);
```

!!! tip "Table owners bypass RLS by default"
    The table owner and superusers are not subject to row-level security policies. If you want the owner to also be restricted, run `ALTER TABLE orders FORCE ROW LEVEL SECURITY`. This is important for testing - you may not notice broken policies if you're testing as the table owner.

```quiz
question: "You create a role with NOINHERIT and grant it membership in an admin group. What happens when the role connects?"
type: multiple-choice
options:
  - text: "The role automatically has all admin group privileges"
    feedback: "With NOINHERIT, the role does not automatically receive the parent role's privileges. It must explicitly SET ROLE to activate them."
  - text: "The connection is rejected because NOINHERIT roles cannot log in"
    feedback: "NOINHERIT has nothing to do with login ability. LOGIN/NOLOGIN controls whether a role can connect. NOINHERIT controls whether inherited privileges are automatically active."
  - text: "The role must use SET ROLE to activate the admin group's privileges"
    correct: true
    feedback: "Correct. NOINHERIT means the role's granted memberships are available but not automatically active. The user must explicitly SET ROLE admin_group to gain those privileges, then RESET ROLE when done. This is a deliberate security pattern."
  - text: "The role has admin privileges only for SELECT statements"
    feedback: "NOINHERIT is all-or-nothing for a given role membership. It does not filter by statement type. The role either has the full set of inherited privileges (after SET ROLE) or none of them."
```

---

## Tablespace Management

A **tablespace** defines a physical location on the filesystem where PostgreSQL stores data files. By default, PostgreSQL uses two tablespaces:

- **`pg_default`** - stores user data (under `base/` in the data directory)
- **`pg_global`** - stores cluster-wide system catalogs (under `global/` in the data directory)

### Creating Tablespaces

You can create additional tablespaces to place data on different storage devices - for example, putting frequently accessed indexes on fast SSDs while keeping large archival tables on slower, cheaper disks:

```sql
-- The directory must exist and be owned by the postgres OS user
-- On the OS: mkdir -p /mnt/ssd/pgdata && chown postgres:postgres /mnt/ssd/pgdata

CREATE TABLESPACE fast_storage
    OWNER postgres
    LOCATION '/mnt/ssd/pgdata';

CREATE TABLESPACE archive_storage
    LOCATION '/mnt/hdd/pgdata';
```

### Using Tablespaces

Assign tablespaces when creating objects or move existing objects:

```sql
-- Create a table in a specific tablespace
CREATE TABLE recent_events (
    id bigserial PRIMARY KEY,
    event_type text,
    created_at timestamptz DEFAULT now()
) TABLESPACE fast_storage;

-- Create an index in a specific tablespace
CREATE INDEX idx_events_created
    ON recent_events (created_at)
    TABLESPACE fast_storage;

-- Move an existing table to a different tablespace
ALTER TABLE old_logs SET TABLESPACE archive_storage;

-- Set the default tablespace for a database
ALTER DATABASE myapp SET default_tablespace = 'fast_storage';
```

!!! warning "Moving tables locks them"
    `ALTER TABLE ... SET TABLESPACE` acquires an `ACCESS EXCLUSIVE` lock. The table is completely unavailable during the move. For large tables, this can take a long time. Plan tablespace moves during maintenance windows, or use logical replication to migrate data with minimal downtime.

### Monitoring Tablespace Usage

```sql
-- List all tablespaces with size
SELECT spcname, pg_size_pretty(pg_tablespace_size(spcname))
FROM pg_tablespace;

-- See which tablespace each table uses
SELECT tablename, tablespace
FROM pg_tables
WHERE schemaname = 'public';
-- NULL tablespace means pg_default
```

---

## VACUUM and ANALYZE

If there is one PostgreSQL administration concept you must understand, it is **VACUUM**. PostgreSQL's **multi-version concurrency control** (MVCC) system never overwrites data in place. When you update a row, PostgreSQL creates a new version and marks the old one as "dead." When you delete a row, PostgreSQL marks it as dead but does not remove it. These **dead tuples** accumulate over time and waste disk space, slow down sequential scans, and cause **table bloat**.

### Why VACUUM Exists

Consider what happens without VACUUM:

1. You update 1 million rows in a table
2. PostgreSQL creates 1 million new row versions
3. The old 1 million versions are still on disk, marked as dead
4. Sequential scans now read 2 million row versions even though only 1 million are live
5. Indexes still point to both live and dead versions
6. The table has doubled in size on disk

VACUUM reclaims the space occupied by dead tuples, making it available for reuse by future inserts and updates within the same table.

### VACUUM vs VACUUM FULL

PostgreSQL offers two flavors:

| | `VACUUM` | `VACUUM FULL` |
|---|---------|---------------|
| **Locking** | Runs alongside reads and writes | Locks the table exclusively |
| **Space reclamation** | Marks dead tuple space as reusable within the table | Rewrites the entire table, releasing space to the OS |
| **Speed** | Fast, designed to run frequently | Slow, especially on large tables |
| **When to use** | Regular maintenance (autovacuum does this) | Only when a table has extreme bloat and you need to shrink the file on disk |
| **Downtime** | None | Table is unavailable for the duration |

In practice, you should almost never need `VACUUM FULL`. Regular `VACUUM` keeps dead tuple space recyclable. `VACUUM FULL` is a last resort for tables that grew extremely large due to a bulk operation and you need the disk space back.

### ANALYZE

`ANALYZE` collects statistics about the distribution of data in a table's columns. The **query planner** uses these statistics to choose efficient execution plans - deciding whether to use an index scan, sequential scan, hash join, or merge join.

```sql
-- Analyze a specific table
ANALYZE orders;

-- Analyze specific columns
ANALYZE orders (customer_id, created_at);

-- VACUUM and ANALYZE together
VACUUM ANALYZE orders;
```

Stale statistics lead to bad query plans. If you load a large batch of data or significantly change the data distribution, running `ANALYZE` immediately afterward helps the planner make good decisions.

### Autovacuum Configuration

PostgreSQL runs **autovacuum** as a background process that automatically triggers `VACUUM` and `ANALYZE` when tables accumulate enough changes. The key configuration parameters in `postgresql.conf`:

```ini
# Master switch (leave this on)
autovacuum = on

# How often the autovacuum launcher checks for work (seconds)
autovacuum_naptime = 60

# VACUUM triggers when dead tuples exceed:
#   autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor * table rows)
autovacuum_vacuum_threshold = 50        # base number of dead tuples
autovacuum_vacuum_scale_factor = 0.2    # fraction of table size

# ANALYZE triggers when changed tuples exceed:
#   autovacuum_analyze_threshold + (autovacuum_analyze_scale_factor * table rows)
autovacuum_analyze_threshold = 50
autovacuum_analyze_scale_factor = 0.1

# Maximum number of concurrent autovacuum workers
autovacuum_max_workers = 3
```

With the defaults, a table with 10,000 rows triggers autovacuum when it accumulates more than 50 + (0.2 * 10,000) = 2,050 dead tuples. For a table with 10 million rows, the threshold is 50 + (0.2 * 10,000,000) = 2,000,050 dead tuples - which means a lot of bloat accumulates before autovacuum kicks in.

For large, heavily-updated tables, you often need per-table overrides:

```sql
-- More aggressive autovacuum for a high-traffic table
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.005,
    autovacuum_vacuum_threshold = 100
);
```

### Monitoring Dead Tuples

The `pg_stat_user_tables` view tells you how well autovacuum is keeping up:

```sql
SELECT
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) AS dead_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;
```

If `n_dead_tup` is consistently high and `last_autovacuum` is far in the past, autovacuum may be falling behind. Common causes: too few `autovacuum_max_workers`, thresholds set too high, or long-running transactions holding back the **oldest transaction horizon** (preventing VACUUM from reclaiming tuples that might still be visible to them).

```quiz
question: "A table has 5 million rows and the autovacuum_vacuum_scale_factor is set to the default 0.2. Approximately how many dead tuples must accumulate before autovacuum triggers a VACUUM?"
type: multiple-choice
options:
  - text: "50 dead tuples"
    feedback: "50 is the autovacuum_vacuum_threshold (the base), but the formula also adds (scale_factor * table_rows). The full threshold is 50 + (0.2 * 5,000,000) = 1,000,050."
  - text: "About 1 million dead tuples"
    correct: true
    feedback: "Correct. The formula is threshold + (scale_factor * rows) = 50 + (0.2 * 5,000,000) = 1,000,050. For large tables, the default scale factor means significant bloat accumulates before autovacuum triggers. Production systems often lower the scale factor for high-traffic tables."
  - text: "About 100,000 dead tuples"
    feedback: "That would correspond to a scale factor of 0.02, not the default 0.2. The actual threshold is 50 + (0.2 * 5,000,000) = 1,000,050."
  - text: "VACUUM triggers after every 1,000 DELETE or UPDATE operations"
    feedback: "Autovacuum does not trigger based on the number of operations. It triggers based on the count of dead tuples exceeding the calculated threshold. The formula is threshold + (scale_factor * table_rows)."
```

```terminal
title: VACUUM, ANALYZE, and Dead Tuple Monitoring
steps:
  - command: "psql -U postgres -d myapp -c \"SELECT relname, n_live_tup, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;\""
    output: |
        relname     | n_live_tup | n_dead_tup |       last_autovacuum
      --------------+------------+------------+------------------------------
       orders       |    2384710 |     489230 | 2026-02-18 03:14:22.817+00
       events       |     891204 |     124087 | 2026-02-18 03:15:01.442+00
       sessions     |      34521 |      18903 | 2026-02-18 02:58:11.093+00
       audit_log    |    5102844 |       8412 | 2026-02-18 03:12:55.671+00
       users        |      98210 |        341 | 2026-02-18 03:10:44.219+00
    narration: "Check which tables have the most dead tuples. The orders table has nearly 490,000 dead tuples - about 20% of live tuples. This level of bloat suggests autovacuum is running but the table is being updated faster than it can keep up."
  - command: "psql -U postgres -d myapp -c \"VACUUM VERBOSE orders;\""
    output: |
      INFO:  vacuuming "public.orders"
      INFO:  table "orders": found 489230 removable, 2384710 nonremovable row versions in 98412 out of 131204 pages
      DETAIL:  0 dead row versions cannot be removed yet, oldest xmin: 8849213
      CPU: user: 2.14 s, system: 1.87 s, elapsed: 6.43 s
      INFO:  vacuuming "pg_toast.pg_toast_16421"
      VACUUM
    narration: "Run a manual VACUUM with VERBOSE output on the orders table. It found and removed all 489,230 dead row versions. The 'oldest xmin' value indicates the oldest transaction that could still see these rows - since no long-running transactions were holding it back, all dead tuples were removable."
  - command: "psql -U postgres -d myapp -c \"ANALYZE VERBOSE orders;\""
    output: |
      INFO:  analyzing "public.orders"
      INFO:  "orders": scanned 30000 of 131204 pages, containing 545871 live rows and 0 dead rows; 30000 rows in sample, 2384710 estimated total rows
      ANALYZE
    narration: "Run ANALYZE to update planner statistics. PostgreSQL sampled 30,000 pages and used those to estimate the data distribution. Notice 0 dead rows - the VACUUM we just ran cleaned them up."
  - command: "psql -U postgres -d myapp -c \"SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_analyze FROM pg_stat_user_tables WHERE relname = 'orders';\""
    output: |
        relname  | n_live_tup | n_dead_tup |         last_vacuum          |        last_analyze
      -----------+------------+------------+------------------------------+------------------------------
       orders    |    2384710 |          0 | 2026-02-19 14:22:08.531+00   | 2026-02-19 14:22:15.812+00
    narration: "After VACUUM and ANALYZE, the dead tuple count is back to 0 and the timestamps are updated. In normal operation, autovacuum handles this automatically - but manual runs are useful when you need immediate cleanup after bulk operations."
  - command: "psql -U postgres -d myapp -c \"ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);\""
    output: "ALTER TABLE"
    narration: "Lower the autovacuum thresholds for this high-traffic table. With a scale factor of 0.02, autovacuum now triggers after about 47,744 dead tuples instead of 1 million. This keeps bloat much more manageable."
```

---

## pg_stat_* Monitoring Views

PostgreSQL provides a rich set of **statistics views** prefixed with `pg_stat_` that give you visibility into what the database is doing. These views are your primary tool for understanding performance, diagnosing problems, and capacity planning.

### pg_stat_activity

The `pg_stat_activity` view shows one row per active server process - every connection, what it is doing, and how long it has been doing it:

```sql
-- Active queries right now
SELECT
    pid,
    usename,
    datname,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_duration,
    left(query, 80) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

Key columns:

| Column | What it tells you |
|--------|-------------------|
| `state` | `active`, `idle`, `idle in transaction`, `fastpath function call` |
| `wait_event_type` | Why the process is waiting: `Lock`, `IO`, `LWLock`, `BufferPin`, etc. |
| `wait_event` | Specific wait: `relation`, `transactionid`, `DataFileRead`, etc. |
| `query_start` | When the current query began executing |
| `xact_start` | When the current transaction started (important for long transactions) |
| `backend_type` | `client backend`, `autovacuum worker`, `walwriter`, etc. |

Watch for `idle in transaction` connections - they hold locks and prevent VACUUM from reclaiming dead tuples. If `xact_start` is far in the past for an `idle in transaction` session, that connection is a problem.

```sql
-- Find long-running transactions blocking VACUUM
SELECT
    pid,
    usename,
    state,
    now() - xact_start AS transaction_age,
    left(query, 60) AS last_query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
    AND now() - xact_start > interval '5 minutes'
ORDER BY xact_start;
```

### pg_stat_user_tables

This view provides per-table I/O and maintenance statistics:

```sql
SELECT
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_dead_tup
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 10;
```

A table with high `seq_scan` counts and many rows probably needs an index. Compare `seq_scan` to `idx_scan` - if sequential scans dominate on a large table, the planner is not finding useful indexes for common queries.

### pg_stat_user_indexes

Shows how much each index is actually used:

```sql
-- Find unused indexes (candidates for removal)
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

Unused indexes waste disk space and slow down writes (every INSERT, UPDATE, and DELETE must update all indexes). Periodically auditing for zero-scan indexes and dropping them is a valuable maintenance task.

### pg_stat_bgwriter

The **background writer** and **checkpointer** flush dirty buffers to disk. This view shows how that work is distributed:

```sql
SELECT
    checkpoints_timed,
    checkpoints_req,
    buffers_checkpoint,
    buffers_clean,
    buffers_backend,
    buffers_alloc
FROM pg_stat_bgwriter;
```

If `buffers_backend` is high relative to `buffers_checkpoint` and `buffers_clean`, client processes are being forced to write dirty pages themselves instead of the background writer handling it. This indicates the background writer cannot keep up and you may need to tune `bgwriter_lru_maxpages` or `bgwriter_lru_multiplier`.

If `checkpoints_req` is high relative to `checkpoints_timed`, checkpoints are being forced by WAL volume rather than happening on schedule. Increase `max_wal_size` to reduce forced checkpoints.

### pg_stat_replication

When running streaming replication, this view shows the state of each standby:

```sql
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    sent_lsn - replay_lsn AS replay_lag_bytes,
    write_lag,
    flush_lag,
    replay_lag
FROM pg_stat_replication;
```

The lag columns (`write_lag`, `flush_lag`, `replay_lag`) show time-based lag at each stage. If `replay_lag` is growing, the standby is falling behind - often due to heavy write load, slow standby disk, or a long-running query on the standby blocking replay.

```quiz
question: "You notice a table with 2 million rows has 45,000 sequential scans and only 120 index scans in pg_stat_user_tables. What does this most likely indicate?"
type: multiple-choice
options:
  - text: "The table's indexes are corrupt and need to be rebuilt"
    feedback: "Corrupt indexes would cause errors, not a preference for sequential scans. The planner avoids indexes when it estimates they are not beneficial for the query, or when no suitable index exists."
  - text: "The queries hitting this table would benefit from better indexing"
    correct: true
    feedback: "Correct. A large table with overwhelmingly sequential scans suggests the planner cannot find useful indexes for the queries being run. Either the right indexes do not exist, or the existing indexes do not match the query predicates. Review the slow query log or pg_stat_statements to identify the queries, then create appropriate indexes."
  - text: "Sequential scans are always faster than index scans on this table"
    feedback: "Sequential scans can be faster for small tables or queries that return most of the table's rows. But for a 2-million-row table, 45,000 sequential scans almost certainly include selective queries that would benefit from indexes."
  - text: "Autovacuum is not running frequently enough"
    feedback: "Autovacuum affects dead tuple cleanup and statistics freshness, not the ratio of sequential to index scans. The scan ratio indicates a missing or unsuitable index."
```

---

## Extensions

One of PostgreSQL's greatest strengths is its **extension** system. Extensions add data types, functions, operators, index methods, and more - all without modifying the core server. PostgreSQL ships with a set of **contrib** extensions, and hundreds more are available from the community.

### Installing Extensions

Extensions must first be available on the filesystem (installed as shared libraries), then loaded into a specific database:

```sql
-- See what's available
SELECT name, default_version, comment
FROM pg_available_extensions
ORDER BY name;

-- Install an extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Check installed extensions
SELECT extname, extversion FROM pg_extension;

-- Update an extension to a new version
ALTER EXTENSION pg_stat_statements UPDATE;

-- Remove an extension
DROP EXTENSION pg_stat_statements;
```

### pg_stat_statements

[**pg_stat_statements**](https://www.postgresql.org/docs/current/pgstatstatements.html) tracks execution statistics for every SQL statement executed by the server. It is the single most valuable extension for performance analysis.

To enable it, add to `postgresql.conf`:

```ini
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

Then restart PostgreSQL and create the extension:

```sql
CREATE EXTENSION pg_stat_statements;

-- Top 10 queries by total execution time
SELECT
    left(query, 80) AS query,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

This tells you which queries consume the most time in aggregate - not just the slowest individual query, but the ones that are called thousands of times and add up. A query that takes 2 ms but runs 500,000 times per day (1,000 seconds total) matters more than one that takes 5 seconds but runs once.

### pgcrypto

[**pgcrypto**](https://www.postgresql.org/docs/current/pgcrypto.html) provides cryptographic functions directly in SQL - hashing, encryption, and random data generation:

```sql
CREATE EXTENSION pgcrypto;

-- Hash a password with bcrypt (blowfish)
SELECT crypt('user_password', gen_salt('bf'));

-- Verify a password
SELECT (stored_hash = crypt('user_input', stored_hash)) AS password_valid;

-- Generate random bytes
SELECT gen_random_bytes(16);

-- Generate a random UUID (also available via gen_random_uuid() in PG 13+)
SELECT gen_random_uuid();

-- Symmetric encryption
SELECT pgp_sym_encrypt('sensitive data', 'encryption_key');
SELECT pgp_sym_decrypt(encrypted_column, 'encryption_key');
```

### PostGIS

[**PostGIS**](https://postgis.net/) adds geospatial data types, indexes, and functions - turning PostgreSQL into a full geographic information system. It is one of the most capable open-source geospatial databases available:

```sql
CREATE EXTENSION postgis;

-- Store a point (longitude, latitude in WGS 84)
CREATE TABLE locations (
    id serial PRIMARY KEY,
    name text,
    geom geometry(Point, 4326)
);

INSERT INTO locations (name, geom)
VALUES ('Office', ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326));

-- Find locations within 5 km of a point
SELECT name, ST_Distance(
    geom::geography,
    ST_SetSRID(ST_MakePoint(-73.9851, 40.7580), 4326)::geography
) AS distance_meters
FROM locations
WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(-73.9851, 40.7580), 4326)::geography,
    5000
);
```

### pg_trgm

[**pg_trgm**](https://www.postgresql.org/docs/current/pgtrgm.html) provides trigram-based text similarity functions and index support. It is excellent for fuzzy text matching, "did you mean?" features, and typo-tolerant searches:

```sql
CREATE EXTENSION pg_trgm;

-- Similarity score (0 to 1)
SELECT similarity('PostgreSQL', 'PostgerSQL');  -- ~0.6

-- Find similar product names
SELECT name, similarity(name, 'PostgreSQ') AS sim
FROM products
WHERE similarity(name, 'PostgreSQ') > 0.3
ORDER BY sim DESC;

-- Create a GIN index for fast trigram searches
CREATE INDEX idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

-- Use LIKE/ILIKE with trigram index acceleration
SELECT * FROM products WHERE name ILIKE '%postgres%';
```

!!! tip "Combine pg_trgm with full-text search"
    Use `pg_trgm` for fuzzy matching on short strings (names, titles) and PostgreSQL's built-in full-text search (`tsvector`/`tsquery`) for document-length content. They complement each other well - trigrams catch typos and abbreviations that full-text search misses.

```command-builder
title: "PostgreSQL Admin Command Builder"
description: "Build common psql administration commands for database maintenance and monitoring."
base: "psql"
groups:
  - name: "Connection"
    options:
      - flag: "-U postgres"
        description: "Connect as the postgres superuser"
      - flag: "-d myapp"
        description: "Connect to the myapp database"
      - flag: "-h localhost"
        description: "Connect to localhost (TCP instead of socket)"
      - flag: "-p 5432"
        description: "Specify the port number"
  - name: "Execution Mode"
    options:
      - flag: "-c \"VACUUM VERBOSE tablename;\""
        description: "Run VACUUM with verbose output on a table"
      - flag: "-c \"ANALYZE tablename;\""
        description: "Update planner statistics for a table"
      - flag: "-c \"SELECT * FROM pg_stat_activity WHERE state != 'idle';\""
        description: "Show active queries"
      - flag: "-c \"SELECT * FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;\""
        description: "Show tables with most dead tuples"
  - name: "Output Format"
    options:
      - flag: "-x"
        description: "Expanded (vertical) output for wide rows"
      - flag: "--csv"
        description: "CSV output for scripting"
      - flag: "-t"
        description: "Tuples only (no headers or footers)"
```

---

## WAL Management

The **Write-Ahead Log** (WAL) is PostgreSQL's mechanism for ensuring data durability and crash recovery. The core principle: before any change is written to the actual data files, it is first written to the WAL. If PostgreSQL crashes, it replays the WAL on startup to recover any changes that were committed but not yet flushed to the data files.

### How WAL Works

Every transaction that modifies data generates WAL records. These records are written sequentially to files in the `pg_wal/` directory (called `pg_xlog/` before PostgreSQL 10). The sequence of events:

1. Transaction modifies data in shared buffers (memory)
2. WAL records describing the changes are written to WAL buffers
3. At commit, WAL buffers are flushed to WAL files on disk (`fsync`)
4. The commit is acknowledged to the client
5. Later, the background writer or checkpointer writes the actual data pages to disk

Because WAL writes are sequential (append-only) and data file writes are random, this design converts expensive random I/O into cheap sequential I/O for the critical commit path. The actual data pages are written asynchronously in the background.

### wal_level Settings

The `wal_level` parameter controls how much information is written to WAL:

| Level | What it includes | Use case |
|-------|------------------|----------|
| `minimal` | Only enough for crash recovery | Standalone server with no replication or archiving |
| `replica` | Adds data needed for WAL archiving and replication | Default since PostgreSQL 10; required for standby servers |
| `logical` | Adds data for logical decoding | Required for logical replication, change data capture |

```ini
# postgresql.conf
wal_level = replica    # The safe default for most deployments
```

Changing `wal_level` requires a server restart.

### WAL Archiving

**WAL archiving** copies completed WAL files to a safe location before they are recycled. Combined with a base backup, archived WAL files enable **point-in-time recovery** (PITR) - restoring a database to any moment in time.

```ini
# postgresql.conf
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

The `%p` placeholder is the full path to the WAL file being archived. `%f` is just the filename. The `archive_command` must return exit code 0 on success - PostgreSQL will retry on failure and will not recycle a WAL file until it has been successfully archived.

For production systems, use a more robust archive command that copies to remote storage:

```ini
# Archive to S3
archive_command = 'aws s3 cp %p s3://my-wal-archive/%f'

# Archive with pgBackRest
archive_command = 'pgbackrest --stanza=mydb archive-push %p'

# Archive with Barman
archive_command = 'barman-wal-archive backup-server mydb %p'
```

### WAL Directory Management

WAL files are 16 MB each by default. Under heavy write load, the `pg_wal/` directory can grow significantly. Key parameters:

```ini
# Soft target for total WAL size (checkpoints try to stay under this)
max_wal_size = 1GB

# Minimum WAL to retain (even if not needed for recovery)
min_wal_size = 80MB
```

Monitor WAL directory size:

```sql
-- Current WAL LSN (Log Sequence Number) position
SELECT pg_current_wal_lsn();

-- Size of pg_wal directory
SELECT pg_size_pretty(sum(size))
FROM pg_ls_waldir();

-- Number of WAL files
SELECT count(*) FROM pg_ls_waldir();
```

!!! danger "Never manually delete files from pg_wal"
    If `pg_wal/` is filling your disk, do not delete WAL files by hand. This can cause data loss or prevent crash recovery. Instead, investigate why WAL is accumulating: a failed `archive_command`, a replication slot preventing WAL recycling, or `max_wal_size` set too low. Fix the root cause, and PostgreSQL will recycle old WAL files automatically.

### WAL and Replication Slots

**Replication slots** prevent PostgreSQL from recycling WAL files that a standby server or logical consumer still needs. Without slots, a slow standby might fall behind and find that the WAL it needs has been recycled - breaking replication.

```sql
-- Create a physical replication slot
SELECT pg_create_physical_replication_slot('standby1');

-- View replication slots and their WAL retention
SELECT
    slot_name,
    slot_type,
    active,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
    ) AS retained_wal
FROM pg_replication_slots;

-- Drop a slot that's no longer needed (releases retained WAL)
SELECT pg_drop_replication_slot('standby1');
```

An inactive replication slot is one of the most common causes of `pg_wal/` growing unbounded. If a standby is decommissioned without dropping its slot, WAL accumulates indefinitely.

---

## Putting It Together: Diagnosing Bloat

The topics in this guide are interconnected. Dead tuples accumulate because of MVCC. VACUUM cleans them up. `pg_stat_user_tables` tells you whether VACUUM is keeping up. Long-running transactions (visible in `pg_stat_activity`) prevent VACUUM from reclaiming tuples. `pg_stat_statements` reveals the queries causing the most churn. Understanding these relationships is the core of PostgreSQL administration.

```exercise
title: Diagnose Table Bloat and Plan a VACUUM Strategy
difficulty: intermediate
scenario: |
  You are investigating performance degradation on a production PostgreSQL 16 server. The application team reports that queries on the `orders` table are getting slower over time.

  You have access to the following information:

  - The `orders` table has 8 million live rows
  - `pg_stat_user_tables` shows 3.2 million dead tuples for `orders`
  - `last_autovacuum` for `orders` was 6 hours ago
  - `pg_stat_activity` shows one connection in `idle in transaction` state that has been open for 14 hours
  - The table's `autovacuum_vacuum_scale_factor` is the default 0.2
  - The application performs approximately 50,000 updates per hour on this table

  Based on this information:

  1. Calculate the autovacuum trigger threshold for this table with the default settings
  2. Explain why the 3.2 million dead tuples have not been cleaned up despite autovacuum running 6 hours ago
  3. Write the SQL to identify and terminate the problematic idle-in-transaction connection
  4. Write the SQL to set more aggressive autovacuum parameters for this table
  5. Describe what steps you would take, in order, to resolve this situation
hints:
  - "The autovacuum threshold formula is: threshold + (scale_factor * n_live_tup)"
  - "VACUUM can only remove dead tuples that are no longer visible to ANY active transaction"
  - "Check the xact_start column in pg_stat_activity for long-running transactions"
  - "Per-table storage parameters override the global autovacuum settings"
solution: |
  ```sql
  -- 1. Calculate the autovacuum threshold:
  --    50 + (0.2 * 8,000,000) = 1,600,050 dead tuples
  --    Autovacuum triggers when dead tuples exceed ~1.6 million

  -- 2. The 14-hour idle-in-transaction connection is the problem.
  --    Its transaction's snapshot prevents VACUUM from removing any
  --    dead tuples created after that transaction started. Even though
  --    autovacuum ran 6 hours ago, it could not reclaim tuples that
  --    might still be visible to the old transaction. The dead tuples
  --    keep accumulating from the 50,000 updates/hour.

  -- 3. Find and terminate the problematic connection:
  SELECT pid, usename, state,
         now() - xact_start AS transaction_age,
         left(query, 80) AS last_query
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
      AND now() - xact_start > interval '1 hour';

  -- Terminate the specific connection (replace PID with actual value):
  SELECT pg_terminate_backend(<pid>);

  -- 4. Set aggressive autovacuum for the orders table:
  ALTER TABLE orders SET (
      autovacuum_vacuum_scale_factor = 0.01,
      autovacuum_analyze_scale_factor = 0.005,
      autovacuum_vacuum_threshold = 1000,
      autovacuum_vacuum_cost_delay = 2
  );
  -- New threshold: 1000 + (0.01 * 8,000,000) = 81,000 dead tuples

  -- 5. Resolution steps in order:
  --    a. Terminate the idle-in-transaction connection
  --    b. Run VACUUM VERBOSE orders to immediately clean up dead tuples
  --    c. Run ANALYZE orders to refresh planner statistics
  --    d. Set per-table autovacuum parameters (as shown above)
  --    e. Configure idle_in_transaction_session_timeout in postgresql.conf
  --       to prevent this from happening again:
  --       idle_in_transaction_session_timeout = '30min'
  --    f. Monitor with:
  SELECT n_dead_tup, last_autovacuum
  FROM pg_stat_user_tables
  WHERE relname = 'orders';
  ```
```

---

## Further Reading

- [PostgreSQL Documentation: Database Roles](https://www.postgresql.org/docs/current/user-manag.html) - official reference for role creation, membership, and privilege management
- [PostgreSQL Documentation: Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) - comprehensive coverage of VACUUM, autovacuum, and transaction ID wraparound prevention
- [PostgreSQL Documentation: Monitoring Database Activity](https://www.postgresql.org/docs/current/monitoring-stats.html) - full reference for all `pg_stat_*` views and what each column means
- [PostgreSQL Documentation: Write-Ahead Logging](https://www.postgresql.org/docs/current/wal.html) - WAL internals, configuration, and reliability guarantees
- [pg_stat_statements Documentation](https://www.postgresql.org/docs/current/pgstatstatements.html) - setup, configuration, and query performance analysis
- [PostgreSQL Wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This) - common PostgreSQL anti-patterns and mistakes to avoid

---

**Previous:** [PostgreSQL Fundamentals](postgresql-fundamentals.md) | **Next:** [PostgreSQL Advanced Features](postgresql-advanced.md) | [Back to Index](README.md)
