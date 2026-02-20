# MySQL Administration

Managing a MySQL server goes beyond writing queries. Day-to-day administration means connecting efficiently from the command line, controlling who can access what, understanding where MySQL logs its activity, and keeping tables healthy. This guide covers the core tools and techniques you will use regularly as a MySQL administrator.

---

## The `mysql` CLI

The [**`mysql`**](https://dev.mysql.com/doc/refman/8.0/en/mysql.html) command-line client is your primary interface for interacting with a MySQL server. Every administrator needs to be fluent with its options and built-in commands.

### Connecting

The most common connection options:

| Option | Purpose |
|--------|---------|
| `-u` | Username (default: your OS user) |
| `-p` | Prompt for password (no space before the password if inline) |
| `-h` | Hostname (default: `localhost`) |
| `-P` | Port (default: `3306`) |
| `-S` | Socket file path |
| `-e` | Execute a statement and exit |
| `-D` | Select a database on connect |

```bash
# Interactive session as root on localhost
mysql -u root -p

# Connect to a remote server on a non-standard port
mysql -u admin -p -h db.example.com -P 3307

# Execute a single query and exit
mysql -u root -p -e "SHOW DATABASES"

# Execute against a specific database
mysql -u root -p -D myapp -e "SELECT COUNT(*) FROM users"
```

When you connect via `localhost`, MySQL uses the Unix socket file (usually `/var/run/mysqld/mysqld.sock` or `/tmp/mysql.sock`) rather than TCP. If you need a TCP connection to the local machine, use `-h 127.0.0.1` instead.

### The `\G` Formatter

Wide result sets with many columns are unreadable in a horizontal table. The `\G` terminator rotates the output to display each column on its own line:

```sql
SELECT * FROM information_schema.PROCESSLIST\G
```

This produces output like:

```
*************************** 1. row ***************************
     ID: 42
   USER: app_user
   HOST: 10.0.1.50:54321
     DB: myapp
COMMAND: Query
   TIME: 0
  STATE: executing
   INFO: SELECT * FROM orders WHERE status = 'pending'
```

Use `\G` any time the output has more than five or six columns - you will use it constantly with `SHOW ENGINE INNODB STATUS\G` and process list queries.

### The `source` Command and `pager`

The `source` command (or `\.`) executes SQL from a file within an interactive session:

```sql
source /path/to/schema.sql
\. /path/to/seed-data.sql
```

The **`pager`** command pipes output through an external program. This is invaluable for large result sets:

```sql
-- Page through output with less
pager less -S

-- Search output with grep
pager grep -i error

-- Reset to normal output
nopager
```

!!! tip "Combining pager with \G"
    `pager less -S` combined with `\G` output gives you a scrollable, searchable view of wide result sets. This is the fastest way to browse `SHOW ENGINE INNODB STATUS` output.

```command-builder
title: MySQL CLI Connection Builder
base: "mysql"
groups:
  - name: "Connection"
    flags:
      - flag: "-u"
        description: "Username"
        options:
          - value: "root"
            label: "root"
          - value: "app_user"
            label: "Application user"
      - flag: "-h"
        description: "Host"
        options:
          - value: "localhost"
            label: "Local"
          - value: "db.example.com"
            label: "Remote"
      - flag: "-P"
        description: "Port"
        options:
          - value: "3306"
            label: "Default (3306)"
          - value: "3307"
            label: "Custom (3307)"
  - name: "Authentication"
    flags:
      - flag: "-p"
        description: "Prompt for password"
        options:
          - value: ""
            label: "Prompt at connect"
  - name: "Target"
    flags:
      - flag: "-D"
        description: "Database"
        options:
          - value: "myapp"
            label: "myapp"
          - value: "mysql"
            label: "mysql (system)"
      - flag: "-e"
        description: "Execute query and exit"
        options:
          - value: "\"SHOW DATABASES\""
            label: "List databases"
          - value: "\"SHOW PROCESSLIST\""
            label: "Show connections"
```

```quiz
question: "When you connect to MySQL using -h localhost, which transport does the client use?"
type: multiple-choice
options:
  - text: "TCP on port 3306"
    feedback: "TCP is used for remote connections or when specifying -h 127.0.0.1. The special hostname 'localhost' triggers Unix socket communication instead."
  - text: "The Unix socket file"
    correct: true
    feedback: "Correct! When -h localhost is specified (or no -h at all), the mysql client connects through the Unix socket file, typically /var/run/mysqld/mysqld.sock. This is faster than TCP because it avoids the network stack. Use -h 127.0.0.1 if you need TCP to the local machine."
  - text: "A named pipe (Windows only)"
    feedback: "Named pipes are a Windows-specific transport. On Linux and macOS, localhost connections use the Unix socket."
  - text: "Shared memory"
    feedback: "Shared memory transport exists but requires explicit --protocol=memory. The default for localhost is the Unix socket."
```

---

## User and Privilege System

MySQL's **privilege system** controls who can connect and what they can do. Getting this right is fundamental to both security and operational stability.

### Creating Users

```sql
-- Basic user creation
CREATE USER 'app_user'@'10.0.1.%' IDENTIFIED BY 'strong_password_here';

-- User with authentication plugin (MySQL 8.0+)
CREATE USER 'api_svc'@'%' IDENTIFIED WITH caching_sha2_password BY 'another_password';

-- User that expires in 90 days
CREATE USER 'contractor'@'%' IDENTIFIED BY 'temp_pass' PASSWORD EXPIRE INTERVAL 90 DAY;
```

The **host portion** of a user account matters. `'app_user'@'10.0.1.%'` and `'app_user'@'localhost'` are two different accounts with independent passwords and privileges. MySQL matches connections to accounts using the most specific host match.

### Privilege Levels

Privileges can be granted at four levels:

| Level | Syntax | Scope |
|-------|--------|-------|
| **Global** | `GRANT ... ON *.*` | Entire server |
| **Database** | `GRANT ... ON mydb.*` | All tables in a database |
| **Table** | `GRANT ... ON mydb.orders` | One table |
| **Column** | `GRANT SELECT(name, email) ON mydb.users` | Specific columns |

```sql
-- Global: full admin (use sparingly)
GRANT ALL PRIVILEGES ON *.* TO 'dba'@'localhost' WITH GRANT OPTION;

-- Database: application access
GRANT SELECT, INSERT, UPDATE, DELETE ON myapp.* TO 'app_user'@'10.0.1.%';

-- Table: read-only on sensitive data
GRANT SELECT ON myapp.audit_log TO 'auditor'@'10.0.2.%';

-- Column: restrict visible fields
GRANT SELECT(user_id, username, created_at) ON myapp.users TO 'reporting'@'10.0.3.%';
```

### GRANT, REVOKE, and Viewing Privileges

```sql
-- See what a user can do
SHOW GRANTS FOR 'app_user'@'10.0.1.%';

-- Revoke specific privileges
REVOKE DELETE ON myapp.* FROM 'app_user'@'10.0.1.%';

-- Remove a user entirely
DROP USER 'contractor'@'%';
```

After modifying grants in older MySQL versions (5.x), run `FLUSH PRIVILEGES` to reload the grant tables. MySQL 8.0 applies changes from `GRANT` and `REVOKE` immediately without a flush.

### Roles (MySQL 8.0+)

**Roles** group privileges under a named label, making it easier to manage access for multiple users:

```sql
-- Create roles
CREATE ROLE 'app_read', 'app_write', 'app_admin';

-- Assign privileges to roles
GRANT SELECT ON myapp.* TO 'app_read';
GRANT INSERT, UPDATE, DELETE ON myapp.* TO 'app_write';
GRANT ALL ON myapp.* TO 'app_admin';

-- Grant roles to users
GRANT 'app_read', 'app_write' TO 'app_user'@'10.0.1.%';
GRANT 'app_admin' TO 'dba'@'localhost';

-- Roles must be activated in the session
SET DEFAULT ROLE ALL TO 'app_user'@'10.0.1.%';
```

!!! warning "Roles require activation"
    Granting a role to a user does not activate it automatically. You must either run `SET DEFAULT ROLE` for the user or have them execute `SET ROLE 'role_name'` in their session. Without this step, the role's privileges are not in effect.

### Password Policies

MySQL 8.0 includes the **`validate_password`** component for enforcing password strength:

```sql
-- Check current policy
SHOW VARIABLES LIKE 'validate_password%';

-- Set policy level (LOW, MEDIUM, STRONG)
SET GLOBAL validate_password.policy = 'MEDIUM';

-- Minimum length
SET GLOBAL validate_password.length = 12;

-- Require mixed case, numbers, special characters
SET GLOBAL validate_password.mixed_case_count = 1;
SET GLOBAL validate_password.number_count = 1;
SET GLOBAL validate_password.special_char_count = 1;
```

Password policy levels:

| Policy | Checks |
|--------|--------|
| `LOW` | Length only |
| `MEDIUM` | Length + numbers + mixed case + special characters |
| `STRONG` | MEDIUM + dictionary file check |

```terminal
title: Managing Users and Privileges
steps:
  - command: "mysql -u root -p -e \"CREATE USER 'webapp'@'10.0.1.%' IDENTIFIED BY 'S3cur3_P@ss!'\""
    output: "Query OK, 0 rows affected (0.02 sec)"
    narration: "Create a new user that can connect from any host in the 10.0.1.x subnet. The password meets MEDIUM policy requirements."
  - command: "mysql -u root -p -e \"GRANT SELECT, INSERT, UPDATE, DELETE ON shopdb.* TO 'webapp'@'10.0.1.%'\""
    output: "Query OK, 0 rows affected (0.01 sec)"
    narration: "Grant standard CRUD privileges on the shopdb database. The user can read and write data but cannot alter schema or manage other users."
  - command: "mysql -u root -p -e \"SHOW GRANTS FOR 'webapp'@'10.0.1.%'\""
    output: |
      +--------------------------------------------------------------------------+
      | Grants for webapp@10.0.1.%                                               |
      +--------------------------------------------------------------------------+
      | GRANT USAGE ON *.* TO `webapp`@`10.0.1.%`                                |
      | GRANT SELECT, INSERT, UPDATE, DELETE ON `shopdb`.* TO `webapp`@`10.0.1.%`|
      +--------------------------------------------------------------------------+
    narration: "Verify the grants. USAGE means 'no global privileges' and always appears. The second line shows the database-level grants you just applied."
  - command: "mysql -u root -p -e \"CREATE ROLE 'readonly'; GRANT SELECT ON shopdb.* TO 'readonly'\""
    output: "Query OK, 0 rows affected (0.01 sec)"
    narration: "Create a role and assign SELECT privilege to it. Roles collect privileges under a reusable name."
  - command: "mysql -u root -p -e \"CREATE USER 'analyst'@'%' IDENTIFIED BY 'An@lyst_2024!'; GRANT 'readonly' TO 'analyst'@'%'; SET DEFAULT ROLE ALL TO 'analyst'@'%'\""
    output: "Query OK, 0 rows affected (0.02 sec)"
    narration: "Create a new user, assign the readonly role, and activate it as the default. Without SET DEFAULT ROLE, the analyst would connect with no role privileges active."
  - command: "mysql -u root -p -e \"REVOKE DELETE ON shopdb.* FROM 'webapp'@'10.0.1.%'\""
    output: "Query OK, 0 rows affected (0.01 sec)"
    narration: "Revoke the DELETE privilege. The application can still SELECT, INSERT, and UPDATE but can no longer delete rows. Useful for tightening access after an audit."
  - command: "mysql -u root -p -e \"SHOW GRANTS FOR 'webapp'@'10.0.1.%'\""
    output: |
      +-------------------------------------------------------------------+
      | Grants for webapp@10.0.1.%                                        |
      +-------------------------------------------------------------------+
      | GRANT USAGE ON *.* TO `webapp`@`10.0.1.%`                         |
      | GRANT SELECT, INSERT, UPDATE ON `shopdb`.* TO `webapp`@`10.0.1.%` |
      +-------------------------------------------------------------------+
    narration: "Confirm the revocation. DELETE is no longer listed - only SELECT, INSERT, and UPDATE remain."
```

```quiz
question: "In MySQL 8.0, what happens after you GRANT a role to a user but don't run SET DEFAULT ROLE?"
type: multiple-choice
options:
  - text: "The role's privileges are active immediately"
    feedback: "Roles are not active by default after being granted. The user must either SET ROLE in their session or have SET DEFAULT ROLE configured by an administrator."
  - text: "The user can connect but the role's privileges are not in effect until activated"
    correct: true
    feedback: "Correct! Granting a role associates it with the user, but it's not active in new sessions until SET DEFAULT ROLE is configured or the user manually runs SET ROLE. This is a common pitfall - administrators grant a role and assume it's working, but the user has no extra privileges."
  - text: "MySQL returns an error because roles must be activated at creation time"
    feedback: "There's no error. The GRANT succeeds, and the role is associated with the user. It's just inactive until explicitly activated."
  - text: "The user must disconnect and reconnect for the role to take effect"
    feedback: "Reconnecting alone doesn't activate a role. The role must be set as the default (SET DEFAULT ROLE) or activated in each session (SET ROLE)."
```

---

## Log Types

MySQL writes several log files, each serving a different purpose. Knowing which log to check is half the battle when diagnosing problems.

### Error Log

The **error log** is MySQL's most important log file. It records startup and shutdown events, crashes, warnings, and critical errors. Check here first when MySQL misbehaves.

```sql
-- Find the error log location
SHOW VARIABLES LIKE 'log_error';

-- Typical result: /var/log/mysql/error.log or /var/log/mysqld.log
```

MySQL 8.0 introduced a component-based error logging system with configurable output destinations and filtering. The default `log_error_services` value routes errors to the built-in log filter and sink.

### Slow Query Log

The **slow query log** captures queries that exceed a configurable time threshold. This is your primary tool for identifying performance problems.

```sql
-- Enable the slow query log
SET GLOBAL slow_query_log = 'ON';

-- Set the threshold (in seconds)
SET GLOBAL long_query_time = 1;

-- Also log queries that don't use indexes
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- Check the log file location
SHOW VARIABLES LIKE 'slow_query_log_file';
```

The **`long_query_time`** variable accepts decimal values. Setting it to `0.5` captures queries taking more than 500 milliseconds. Start with `1` second and lower it as you optimize.

For persistent configuration, add these to `my.cnf`:

```ini
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1
```

### General Query Log

The **general query log** records every statement the server receives. It captures connects, disconnects, and all SQL statements regardless of whether they succeed or fail.

```sql
SET GLOBAL general_log = 'ON';
SET GLOBAL general_log_file = '/var/log/mysql/general.log';
```

!!! danger "Performance impact"
    The general query log writes to disk for every statement. On a busy server, this creates massive I/O overhead and fills disk rapidly. Enable it only for short debugging sessions, never in production long-term. Use the slow query log or Performance Schema for ongoing monitoring instead.

### Binary Log

The **binary log** (binlog) records all statements that change data. It serves two critical purposes:

1. **Replication** - replicas read the binary log to apply changes from the source
2. **Point-in-time recovery** (PITR) - replay binary logs to restore data to a specific moment after restoring a backup

```sql
-- Check binary log status
SHOW VARIABLES LIKE 'log_bin';

-- List binary log files
SHOW BINARY LOGS;

-- View events in a specific log file
SHOW BINLOG EVENTS IN 'binlog.000042' LIMIT 20;
```

Binary logging is enabled by default in MySQL 8.0. The **`binlog_format`** variable controls how changes are recorded:

| Format | Description | Use Case |
|--------|-------------|----------|
| `ROW` | Logs actual row changes | Default in 8.0. Safest for replication |
| `STATEMENT` | Logs the SQL statements | Smaller logs, but non-deterministic functions can cause drift |
| `MIXED` | Statement by default, row when needed | Compromise, but adds complexity |

```sql
-- Check current format
SHOW VARIABLES LIKE 'binlog_format';

-- Purge old binary logs
PURGE BINARY LOGS BEFORE '2024-01-01 00:00:00';

-- Or keep only the last 7 days
SET GLOBAL binlog_expire_logs_seconds = 604800;
```

---

## Table Maintenance

Tables degrade over time. Deletes leave gaps in data files, index statistics drift from reality, and occasional corruption happens. Regular maintenance keeps things running smoothly.

### `mysqlcheck`

[**`mysqlcheck`**](https://dev.mysql.com/doc/refman/8.0/en/mysqlcheck.html) is a command-line utility that performs table maintenance without entering the `mysql` client. It supports four operations:

| Operation | Flag | Purpose |
|-----------|------|---------|
| `CHECK` | `-c` or `--check` | Verify table integrity |
| `REPAIR` | `-r` or `--repair` | Fix corrupted MyISAM tables |
| `ANALYZE` | `-a` or `--analyze` | Update index statistics |
| `OPTIMIZE` | `-o` or `--optimize` | Reclaim space, defragment |

```bash
# Check all tables in a database
mysqlcheck -u root -p --check myapp

# Check all databases
mysqlcheck -u root -p --check --all-databases

# Analyze all tables (update statistics)
mysqlcheck -u root -p --analyze --all-databases

# Optimize a specific table
mysqlcheck -u root -p --optimize myapp orders
```

### `OPTIMIZE TABLE` for InnoDB

For InnoDB tables, `OPTIMIZE TABLE` performs a full table rebuild. It recreates the table and its indexes, which:

- Reclaims space from deleted rows
- Rebuilds indexes for better efficiency
- Resets fragmentation

```sql
OPTIMIZE TABLE myapp.orders;
```

InnoDB translates `OPTIMIZE TABLE` into `ALTER TABLE ... FORCE` internally. This means it creates a temporary copy of the table, which requires free disk space equal to the table's size. On a 50 GB table, you need 50 GB of free space.

!!! warning "OPTIMIZE TABLE locks"
    While MySQL 8.0 performs the rebuild as an online DDL operation (allowing reads and writes), there are brief periods at the start and end where it acquires metadata locks. On very large tables, plan this for maintenance windows.

### `ANALYZE TABLE`

**`ANALYZE TABLE`** updates the statistics that the query optimizer uses to choose execution plans. Stale statistics can cause the optimizer to pick poor index choices:

```sql
ANALYZE TABLE myapp.orders;
ANALYZE TABLE myapp.users, myapp.sessions;
```

Unlike `OPTIMIZE`, `ANALYZE TABLE` is fast. It reads a sample of index pages and updates the cardinality estimates stored in `mysql.innodb_index_stats` and `mysql.innodb_table_stats`. Run it after bulk inserts or deletes that significantly change the data distribution.

```quiz
question: "What does OPTIMIZE TABLE do on an InnoDB table?"
type: multiple-choice
options:
  - text: "It defragments the indexes in place without copying data"
    feedback: "InnoDB cannot defragment in place. OPTIMIZE TABLE internally executes ALTER TABLE ... FORCE, which rebuilds the entire table and its indexes by creating a new copy."
  - text: "It rebuilds the table and indexes by creating a new copy, reclaiming space and reducing fragmentation"
    correct: true
    feedback: "Correct! For InnoDB, OPTIMIZE TABLE is equivalent to ALTER TABLE ... FORCE. MySQL creates a new copy of the table with fresh, compact data pages and rebuilt indexes, then swaps it in. This requires free disk space equal to the table size."
  - text: "It only updates index statistics, same as ANALYZE TABLE"
    feedback: "ANALYZE TABLE updates statistics. OPTIMIZE TABLE does a full table rebuild - a much heavier operation that also reclaims wasted space from deleted rows."
  - text: "It converts the table from InnoDB to a more optimized storage engine"
    feedback: "OPTIMIZE TABLE does not change the storage engine. It rebuilds the table within InnoDB, creating fresh data and index pages."
```

---

## `information_schema`

The **`information_schema`** database is a read-only set of views that expose metadata about every database, table, column, index, and active process on the server. It is your programmatic interface to MySQL's internals.

### Key Tables

#### `TABLES`

Size, row count, engine, and creation time for every table:

```sql
-- Find the largest tables
SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    ENGINE,
    TABLE_ROWS,
    ROUND(DATA_LENGTH / 1024 / 1024, 2) AS data_mb,
    ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS index_mb,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS total_mb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
LIMIT 10;
```

#### `COLUMNS`

Schema details for every column across all tables:

```sql
-- Find all columns of a certain type
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE DATA_TYPE = 'enum'
  AND TABLE_SCHEMA = 'myapp';
```

#### `STATISTICS`

Index metadata including cardinality, uniqueness, and column order:

```sql
-- Show indexes for a table
SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, CARDINALITY, NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'myapp' AND TABLE_NAME = 'orders'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
```

#### `PROCESSLIST`

All active connections and their current state:

```sql
-- Show active queries (not sleeping)
SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
FROM information_schema.PROCESSLIST
WHERE COMMAND != 'Sleep'
ORDER BY TIME DESC;
```

!!! tip "performance_schema.threads"
    In MySQL 8.0, `performance_schema.threads` provides more detail than `information_schema.PROCESSLIST` and does not require a mutex lock to read. For monitoring scripts, prefer `performance_schema.threads` or `SHOW PROCESSLIST` over querying `information_schema.PROCESSLIST` directly.

#### `INNODB_TRX`

Active InnoDB transactions, including how long they have been running and whether they are waiting on locks:

```sql
-- Find long-running transactions
SELECT
    trx_id,
    trx_state,
    trx_started,
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS age_seconds,
    trx_rows_locked,
    trx_rows_modified,
    trx_query
FROM information_schema.INNODB_TRX
ORDER BY trx_started ASC;
```

---

## Routine Maintenance Tasks

These are the tasks you will perform repeatedly as a MySQL administrator. Build them into your operational routine.

### Checking Disk Usage

Monitor data directory size and individual table growth:

```bash
# Total MySQL data directory size
du -sh /var/lib/mysql

# Size per database
du -sh /var/lib/mysql/*/
```

From within MySQL, use the `TABLES` view for more detail:

```sql
-- Database sizes
SELECT
    TABLE_SCHEMA AS db,
    ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
FROM information_schema.TABLES
GROUP BY TABLE_SCHEMA
ORDER BY size_mb DESC;

-- Tables larger than 1 GB
SELECT TABLE_SCHEMA, TABLE_NAME,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024 / 1024, 2) AS size_gb
FROM information_schema.TABLES
WHERE (DATA_LENGTH + INDEX_LENGTH) > 1073741824
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
```

### Monitoring Connections

```sql
-- Current connection count vs. limit
SHOW VARIABLES LIKE 'max_connections';
SHOW STATUS LIKE 'Threads_connected';

-- Connections by user
SELECT USER, COUNT(*) AS connections
FROM information_schema.PROCESSLIST
GROUP BY USER
ORDER BY connections DESC;

-- Connections by host
SELECT SUBSTRING_INDEX(HOST, ':', 1) AS client_host, COUNT(*) AS connections
FROM information_schema.PROCESSLIST
GROUP BY client_host
ORDER BY connections DESC;
```

### Killing Long Queries

When a runaway query is consuming resources or holding locks:

```sql
-- Find queries running longer than 60 seconds
SELECT ID, USER, HOST, DB, TIME, INFO
FROM information_schema.PROCESSLIST
WHERE COMMAND = 'Query' AND TIME > 60;

-- Kill a specific connection
KILL 12345;

-- Kill only the query (keep the connection)
KILL QUERY 12345;
```

`KILL` terminates the entire connection. `KILL QUERY` cancels just the running statement and leaves the connection open - prefer this for application connections that should stay alive.

### Checking Replication Status

If your server is a replica, verify replication health:

```sql
-- MySQL 8.0.22+
SHOW REPLICA STATUS\G

-- Older versions
SHOW SLAVE STATUS\G
```

Key fields to check:

| Field | Healthy Value |
|-------|--------------|
| `Replica_IO_Running` | `Yes` |
| `Replica_SQL_Running` | `Yes` |
| `Seconds_Behind_Source` | `0` (or a low, stable number) |
| `Last_Error` | Empty |

```sql
-- Quick replication check (MySQL 8.0.22+)
SELECT
    CHANNEL_NAME,
    SERVICE_STATE AS io_state
FROM performance_schema.replication_connection_status;

SELECT
    CHANNEL_NAME,
    SERVICE_STATE AS sql_state,
    LAST_ERROR_MESSAGE
FROM performance_schema.replication_applier_status;
```

```terminal
title: Routine Maintenance Tasks
steps:
  - command: "mysql -u root -p -e \"SELECT TABLE_SCHEMA AS db, ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb FROM information_schema.TABLES GROUP BY TABLE_SCHEMA ORDER BY size_mb DESC\""
    output: |
      +--------------------+---------+
      | db                 | size_mb |
      +--------------------+---------+
      | myapp              | 2456.31 |
      | analytics          |  812.50 |
      | mysql              |   12.44 |
      | sys                |    0.02 |
      | information_schema |    0.00 |
      +--------------------+---------+
    narration: "Check database sizes. The myapp database is using about 2.4 GB and analytics about 812 MB. This query reads from information_schema.TABLES, which caches size estimates for InnoDB."
  - command: "mysql -u root -p -e \"SELECT ID, USER, HOST, DB, TIME, STATE, SUBSTRING(INFO, 1, 60) AS query FROM information_schema.PROCESSLIST WHERE COMMAND = 'Query' AND TIME > 30 ORDER BY TIME DESC\""
    output: |
      +------+----------+------------------+-------+------+------------+--------------------------------------------------------------+
      | ID   | USER     | HOST             | DB    | TIME | STATE      | query                                                        |
      +------+----------+------------------+-------+------+------------+--------------------------------------------------------------+
      | 4821 | app_user | 10.0.1.50:54321  | myapp |  347 | Sending    | SELECT o.*, c.name FROM orders o JOIN customers c ON o.cust  |
      | 4903 | app_user | 10.0.1.51:41982  | myapp |   45 | executing  | UPDATE inventory SET quantity = quantity - 1 WHERE product_i |
      +------+----------+------------------+-------+------+------------+--------------------------------------------------------------+
    narration: "Find queries running longer than 30 seconds. Connection 4821 has been running for nearly 6 minutes - that join is likely missing an index or scanning a huge table."
  - command: "mysql -u root -p -e \"KILL QUERY 4821\""
    output: "Query OK, 0 rows affected (0.00 sec)"
    narration: "Kill just the query on connection 4821, keeping the connection alive. KILL QUERY is safer than KILL for application connections because the app doesn't need to reconnect."
  - command: "mysqlcheck -u root -p --analyze myapp"
    output: |
      myapp.customers                            OK
      myapp.orders                               OK
      myapp.inventory                            OK
      myapp.sessions                             OK
    narration: "Run ANALYZE TABLE on every table in myapp. This updates the index statistics the optimizer relies on. Fast and safe to run during production hours."
  - command: "mysql -u root -p -e \"SELECT trx_id, trx_state, TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS age_sec, trx_rows_locked, trx_query FROM information_schema.INNODB_TRX ORDER BY trx_started\""
    output: |
      +--------+-----------+---------+-----------------+------------------------------------------+
      | trx_id | trx_state | age_sec | trx_rows_locked | trx_query                                |
      +--------+-----------+---------+-----------------+------------------------------------------+
      | 98201  | RUNNING   |    1204 |           42891 | NULL                                     |
      | 98455  | LOCK WAIT |      12 |               1 | UPDATE orders SET status='shipped' WH...  |
      +--------+-----------+---------+-----------------+------------------------------------------+
    narration: "Check for long-running transactions. Transaction 98201 has been running for 20 minutes with 42,891 rows locked and no current query (trx_query is NULL). This usually means an application opened a transaction and never committed. Transaction 98455 is waiting on a lock held by 98201."
  - command: "mysql -u root -p -e \"KILL 98201\""
    output: "Query OK, 0 rows affected (0.00 sec)"
    narration: "Kill the stale connection entirely. InnoDB will roll back its uncommitted transaction and release the 42,891 row locks, unblocking transaction 98455."
```

### Scheduled Maintenance Script

A basic maintenance routine you can schedule via cron:

```bash
#!/bin/bash
# /usr/local/bin/mysql-maintenance.sh

LOG="/var/log/mysql-maintenance.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting maintenance" >> "$LOG"

# Update statistics on all databases
mysqlcheck -u root --analyze --all-databases >> "$LOG" 2>&1

# Check tables for errors
mysqlcheck -u root --check --all-databases >> "$LOG" 2>&1

# Purge binary logs older than 7 days
mysql -u root -e "PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 7 DAY)" >> "$LOG" 2>&1

echo "[$DATE] Maintenance complete" >> "$LOG"
```

```bash
# Run weekly at 3 AM Sunday
echo "0 3 * * 0 /usr/local/bin/mysql-maintenance.sh" | crontab -
```

---

## Exercises

```exercise
title: Diagnose and Fix a Stalled MySQL Server
difficulty: intermediate
scenario: |
  You receive an alert that your application is returning database timeout errors. Users are seeing slow page loads and some requests are failing entirely. Your task is to investigate and resolve the issue.

  The symptoms:
  - Application logs show "Lock wait timeout exceeded" errors
  - SHOW PROCESSLIST reveals 150+ connections, most in "Waiting for table metadata lock" state
  - A single connection has been running an ALTER TABLE for 45 minutes
  - Threads_connected is approaching max_connections (151)

  Diagnose the root cause and fix it without losing data.

  1. Identify the blocking query and the connection holding the lock
  2. Determine whether it is safe to kill the blocking connection
  3. Kill the appropriate connection or query
  4. Verify the server recovers (locks clear, connections drop)
  5. Implement a preventive measure to avoid this in the future
hints:
  - "Start with SHOW PROCESSLIST or information_schema.PROCESSLIST to find the blocking connection"
  - "Check information_schema.INNODB_TRX for long-running transactions that might block the ALTER"
  - "An ALTER TABLE waiting for a metadata lock means something else holds that lock - often an uncommitted transaction"
  - "KILL QUERY stops the statement; KILL terminates the connection entirely"
  - "Consider setting lock_wait_timeout or max_execution_time to prevent future occurrences"
solution: |
  ```sql
  -- Step 1: See all connections and find the blocker
  SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
  FROM information_schema.PROCESSLIST
  WHERE COMMAND != 'Sleep'
  ORDER BY TIME DESC;

  -- The ALTER TABLE shows as "Waiting for table metadata lock"
  -- Look for long-running transactions on the same table

  -- Step 2: Check for open transactions
  SELECT trx_id, trx_state, trx_started,
      TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS age_sec,
      trx_mysql_thread_id, trx_query
  FROM information_schema.INNODB_TRX
  ORDER BY trx_started;

  -- Find the old transaction blocking the ALTER
  -- trx_query may be NULL if the transaction is idle (started but not committed)

  -- Step 3: Kill the stale transaction (the idle one blocking the ALTER)
  KILL <thread_id_of_stale_transaction>;

  -- Step 4: Verify recovery
  SHOW PROCESSLIST;
  -- The ALTER TABLE should now proceed or the metadata lock waiters should clear
  SHOW STATUS LIKE 'Threads_connected';

  -- Step 5: Prevent recurrence
  -- Set a session-level lock wait timeout (default is 31536000 seconds = 1 year)
  SET GLOBAL lock_wait_timeout = 300;

  -- For MySQL 8.0+, set a maximum execution time for SELECT queries
  SET GLOBAL max_execution_time = 30000;  -- 30 seconds in milliseconds

  -- Add to my.cnf for persistence:
  -- [mysqld]
  -- lock_wait_timeout = 300
  -- max_execution_time = 30000
  ```
```

---

## Further Reading

- [MySQL 8.0 Reference Manual: mysql Client](https://dev.mysql.com/doc/refman/8.0/en/mysql.html) - complete CLI reference including all options and built-in commands
- [MySQL 8.0 Reference Manual: Access Control and Account Management](https://dev.mysql.com/doc/refman/8.0/en/access-control.html) - privilege system, roles, and password policy details
- [MySQL 8.0 Reference Manual: MySQL Server Logs](https://dev.mysql.com/doc/refman/8.0/en/server-logs.html) - configuration and format for all log types
- [MySQL 8.0 Reference Manual: information_schema](https://dev.mysql.com/doc/refman/8.0/en/information-schema.html) - complete reference for all metadata tables
- [Percona Toolkit](https://docs.percona.com/percona-toolkit/) - production-grade tools for MySQL including `pt-query-digest`, `pt-kill`, and `pt-online-schema-change`

---

**Previous:** [MySQL Installation & Configuration](mysql-installation-and-configuration.md) | **Next:** [MySQL Performance & Optimization](mysql-performance.md) | [Back to Index](README.md)
