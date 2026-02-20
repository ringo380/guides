# PostgreSQL Fundamentals

[**PostgreSQL**](https://www.postgresql.org/docs/current/) began in 1986 as the POSTGRES project at UC Berkeley, led by Michael Stonebraker. The original goal was to push beyond the limitations of existing relational databases by adding support for complex data types, user-defined functions, and extensible type systems. In 1996, the project adopted SQL as its query language and was renamed PostgreSQL to reflect that change. The project has been community-driven ever since, with no single corporate owner.

Three design principles distinguish PostgreSQL from other relational databases:

- **Object-relational design** - tables can inherit from other tables, custom types can be defined with operators and functions, and the type system is extensible at runtime
- **Standards compliance** - PostgreSQL implements more of the SQL standard than any other open-source database, including window functions, CTEs, lateral joins, and MERGE (added in version 15)
- **Extensibility** - you can add custom data types, operators, index methods, procedural languages, and foreign data wrappers without modifying core source code

PostgreSQL uses a **multi-version concurrency control** (MVCC) model that allows readers and writers to operate without blocking each other. Every transaction sees a consistent snapshot of the database, and old row versions are cleaned up later by the VACUUM process. This architecture trades some write overhead and storage for excellent concurrent read performance.

---

## Installation

### Package Managers

On Debian and Ubuntu, the official PostgreSQL repository provides the latest versions. Add the repository and install:

```bash
# Add the PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update
sudo apt install postgresql-16
```

On RHEL, Fedora, and Rocky Linux:

```bash
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf install -y postgresql16-server postgresql16
```

On macOS with [**Homebrew**](https://brew.sh/):

```bash
brew install postgresql@16
brew services start postgresql@16
```

### Cluster Initialization with initdb

On Linux, after installing the packages, you need to initialize a **database cluster** - the directory structure where PostgreSQL stores all its data. The `initdb` command creates this structure:

```bash
# RHEL/Fedora (the Debian package runs initdb automatically)
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb
```

Under the hood, `initdb` creates:

- The `base/` directory for database files
- The `global/` directory for cluster-wide tables
- Default configuration files (`postgresql.conf`, `pg_hba.conf`, `pg_ident.conf`)
- The `template0` and `template1` **template databases** used as blueprints when you create new databases
- The initial `postgres` database and `postgres` superuser role

!!! tip "Data directory location"
    The default data directory varies by platform: `/var/lib/pgsql/16/data` on RHEL, `/var/lib/postgresql/16/main` on Debian/Ubuntu. Homebrew uses `/opt/homebrew/var/postgresql@16` on Apple Silicon. You can always find it with `SHOW data_directory;` from within `psql`.

### Starting and Stopping

Use `systemctl` on Linux systems with systemd:

```bash
sudo systemctl start postgresql-16
sudo systemctl enable postgresql-16
sudo systemctl status postgresql-16
```

For manual control, `pg_ctl` operates directly on the data directory:

```bash
pg_ctl -D /var/lib/pgsql/16/data start
pg_ctl -D /var/lib/pgsql/16/data stop -m fast
pg_ctl -D /var/lib/pgsql/16/data restart
pg_ctl -D /var/lib/pgsql/16/data status
```

The `-m fast` flag sends SIGTERM to active connections and shuts down without waiting for clients to disconnect. The alternative `-m smart` (default) waits for all connections to close on their own, and `-m immediate` simulates a crash recovery scenario.

```terminal
title: Installing PostgreSQL and Initializing a Cluster
steps:
  - command: "sudo dnf install -y postgresql16-server postgresql16"
    output: |
      Last metadata expiration check: 1:22:07 ago on Thu Feb 19 10:15:32 2026.
      Dependencies resolved.
      ================================================================================
       Package                  Arch       Version          Repository          Size
      ================================================================================
      Installing:
       postgresql16-server      x86_64     16.6-1PGDG.el9  pgdg16             5.9 M
       postgresql16             x86_64     16.6-1PGDG.el9  pgdg16             1.6 M
      Installing dependencies:
       libicu                   x86_64     67.1-9.el9       baseos             9.0 M
       postgresql16-libs        x86_64     16.6-1PGDG.el9  pgdg16             293 k

      Transaction Summary
      ================================================================================
      Install  4 Packages

      Installed:
        postgresql16-16.6-1PGDG.el9.x86_64
        postgresql16-server-16.6-1PGDG.el9.x86_64
        postgresql16-libs-16.6-1PGDG.el9.x86_64
        libicu-67.1-9.el9.x86_64
      Complete!
    narration: "Install the PostgreSQL 16 server and client packages from the official PGDG repository. The server package provides postmaster and initdb. The client package provides psql."
  - command: "sudo /usr/pgsql-16/bin/postgresql-16-setup initdb"
    output: |
      Initializing database ... OK
    narration: "initdb creates the data directory structure at /var/lib/pgsql/16/data. It generates template databases, default configuration files, and the initial postgres superuser role. On Debian/Ubuntu, the package installation runs this step automatically."
  - command: "sudo systemctl start postgresql-16 && sudo systemctl enable postgresql-16"
    output: |
      Created symlink /etc/systemd/system/multi-user.target.wants/postgresql-16.service → /usr/lib/systemd/system/postgresql-16.service.
    narration: "Start PostgreSQL and enable it to start on boot. The service runs as the postgres system user."
  - command: "sudo -u postgres psql -c 'SELECT version();'"
    output: |
       PostgreSQL 16.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 11.4.1 20231218 (Red Hat 11.4.1-3), 64-bit
      (1 row)
    narration: "Verify the installation by connecting as the postgres superuser and checking the version. The sudo -u postgres runs the command as the postgres operating system user, which has peer authentication by default."
```

```quiz
question: "What does initdb create when initializing a PostgreSQL cluster?"
type: multiple-choice
options:
  - text: "Only the postgresql.conf configuration file"
    feedback: "initdb creates much more than just the configuration file. It builds the entire data directory structure including template databases, the postgres database, and all configuration files."
  - text: "The data directory structure, template databases (template0 and template1), the postgres database and superuser role, and default configuration files"
    correct: true
    feedback: "Correct. initdb creates the complete cluster structure: base/ and global/ directories for data files, the template0 and template1 template databases, the default postgres database, the postgres superuser role, and configuration files including postgresql.conf and pg_hba.conf."
  - text: "A single database file and an admin user account in the operating system"
    feedback: "PostgreSQL does not use a single database file. initdb creates an entire directory structure. It also does not create OS user accounts - the postgres system user must already exist (package installation handles this)."
  - text: "An empty data directory that gets populated when the first database is created"
    feedback: "The data directory is not empty after initdb. It already contains template databases, the postgres database, system catalogs, and configuration files - everything needed for the cluster to start accepting connections."
```

---

## The psql CLI

[**psql**](https://www.postgresql.org/docs/current/app-psql.html) is the interactive terminal for PostgreSQL. It supports SQL execution, **meta-commands** (backslash commands that query system catalogs), tab completion, command history, and scripting.

### Connecting

```bash
# Connect as the postgres superuser to the postgres database
sudo -u postgres psql

# Connect to a specific database as a specific user
psql -h localhost -p 5432 -U myuser -d mydb

# Connection string format
psql "host=db.example.com port=5432 dbname=mydb user=myuser sslmode=require"

# Switch databases within psql
\c mydb
```

The `\c` (or `\connect`) meta-command switches to a different database without leaving the `psql` session. You can also change the user at the same time with `\c dbname username`.

### Essential Meta-Commands

Meta-commands start with a backslash and are processed by `psql` itself, not sent to the server. These are the ones you will use daily:

| Command | Description |
|---------|-------------|
| `\l` | List all databases |
| `\dt` | List tables in the current schema |
| `\dt+` | List tables with size and description |
| `\d tablename` | Describe a table (columns, types, indexes, constraints) |
| `\di` | List indexes |
| `\du` | List roles (users and groups) |
| `\df` | List functions |
| `\dn` | List schemas |
| `\x` | Toggle expanded display (vertical output for wide rows) |
| `\timing` | Toggle query execution time display |
| `\e` | Open the last query in your `$EDITOR` |
| `\i filename` | Execute commands from a file |
| `\o filename` | Send query output to a file |
| `\!` | Execute a shell command |

!!! tip "Pattern filtering"
    Most meta-commands accept a pattern argument. `\dt public.*` lists tables in the `public` schema only. `\df *json*` lists functions with "json" in the name. The pattern follows SQL LIKE syntax.

### COPY vs \\copy

`COPY` is a server-side SQL command that reads and writes files on the server's filesystem, running as the `postgres` OS user:

```sql
COPY customers TO '/tmp/customers.csv' WITH (FORMAT csv, HEADER);
COPY customers FROM '/tmp/import.csv' WITH (FORMAT csv, HEADER);
```

`\copy` is a `psql` meta-command that transfers data between the server and the local client machine:

```sql
\copy customers TO 'customers.csv' WITH (FORMAT csv, HEADER)
\copy customers FROM 'import.csv' WITH (FORMAT csv, HEADER)
```

Use `\copy` when you are connecting to a remote server and need files on your local machine, or when the `postgres` user does not have filesystem access to the target path. Use `COPY` for server-local bulk operations - it is faster because data does not travel over the client connection.

### Customizing with .psqlrc

Create a `~/.psqlrc` file to customize your `psql` sessions:

```sql
-- Quiet mode during startup
\set QUIET 1

-- Better NULL display
\pset null '(null)'

-- Show query timing
\timing

-- Expanded auto mode (vertical display when rows are wide)
\x auto

-- History per database
\set HISTFILE ~/.psql_history-:DBNAME

-- Verbose error messages
\set VERBOSITY verbose

-- Prompt: user@host:port/dbname
\set PROMPT1 '%n@%M:%>/%/ %# '

-- Restore normal output
\set QUIET 0
```

```terminal
title: Exploring PostgreSQL with psql Meta-Commands
steps:
  - command: "sudo -u postgres psql"
    output: |
      psql (16.6)
      Type "help" for help.

      postgres=#
    narration: "Connect to the default postgres database as the postgres superuser. The postgres=# prompt indicates you are connected as a superuser (the # symbol). Regular users see => instead."
  - command: "\\l"
    output: |
                                                   List of databases
         Name      |  Owner   | Encoding | Locale Provider |   Collate   |    Ctype    | Access privileges
      -------------+----------+----------+-----------------+-------------+-------------+-------------------
       postgres    | postgres | UTF8     | libc            | en_US.UTF-8 | en_US.UTF-8 |
       template0   | postgres | UTF8     | libc            | en_US.UTF-8 | en_US.UTF-8 | =c/postgres      +
                   |          |          |                 |             |             | postgres=CTc/postgres
       template1   | postgres | UTF8     | libc            | en_US.UTF-8 | en_US.UTF-8 | =c/postgres      +
                   |          |          |                 |             |             | postgres=CTc/postgres
      (3 rows)
    narration: "\\l lists all databases in the cluster. template0 is the pristine template that cannot be modified. template1 is the default template for CREATE DATABASE - any objects you add to template1 appear in every new database. postgres is the default administrative database."
  - command: "CREATE DATABASE appdb;"
    output: |
      CREATE DATABASE
    narration: "Create a new database. PostgreSQL copies template1 to create it. The new database inherits template1's encoding, collation, and any objects that exist in template1."
  - command: "\\c appdb"
    output: |
      You are now connected to database "appdb" as user "postgres".
    narration: "Switch to the new database using the \\c meta-command. The prompt changes to show the current database name."
  - command: "CREATE TABLE users (id serial PRIMARY KEY, name text NOT NULL, email text UNIQUE, created_at timestamptz DEFAULT now());"
    output: |
      CREATE TABLE
    narration: "Create a sample table. The serial type is an auto-incrementing integer. timestamptz stores timestamps with time zone information. DEFAULT now() sets the creation time automatically."
  - command: "\\dt"
    output: |
               List of relations
       Schema |  Name  | Type  |  Owner
      --------+--------+-------+----------
       public | users  | table | postgres
      (1 row)
    narration: "\\dt lists all tables in the current schema. The table lives in the public schema by default."
  - command: "\\d users"
    output: |
                                           Table "public.users"
         Column    |           Type           | Collation | Nullable |              Default
      ------------+--------------------------+-----------+----------+-----------------------------------
       id          | integer                  |           | not null | nextval('users_id_seq'::regclass)
       name        | text                     |           | not null |
       email       | text                     |           |          |
       created_at  | timestamp with time zone |           |          | now()
      Indexes:
          "users_pkey" PRIMARY KEY, btree (id)
          "users_email_key" UNIQUE CONSTRAINT, btree (email)
    narration: "\\d tablename shows the table structure including columns, types, constraints, and indexes. The serial column was expanded to an integer with a sequence default. The PRIMARY KEY and UNIQUE constraints automatically created btree indexes."
  - command: "\\x on"
    output: |
      Expanded display is on.
    narration: "\\x toggles expanded (vertical) display mode. This is useful for tables with many columns where horizontal output wraps and becomes unreadable. Use \\x auto to let psql decide based on terminal width."
  - command: "\\timing on"
    output: |
      Timing is on.
    narration: "\\timing shows execution time for every query. Essential for identifying slow queries during interactive development."
```

```quiz
question: "What is the difference between COPY and \\copy in PostgreSQL?"
type: multiple-choice
options:
  - text: "COPY works with CSV files while \\copy works with binary files"
    feedback: "Both COPY and \\copy support CSV, text, and binary formats. The difference is where the files are accessed, not what formats they support."
  - text: "COPY is a server-side command that reads/writes files on the server filesystem; \\copy is a psql client command that transfers data between the server and the local client machine"
    correct: true
    feedback: "Correct. COPY runs on the server and accesses files as the postgres OS user. \\copy is a psql meta-command that streams data over the client connection, allowing you to read and write files on your local machine. COPY is faster for server-local operations because data stays on the server."
  - text: "\\copy is just an alias for COPY with no functional difference"
    feedback: "They are functionally different. COPY operates on server-side files while \\copy operates on client-side files. This matters when connecting to a remote database."
  - text: "COPY is deprecated and \\copy is its replacement"
    feedback: "COPY is not deprecated. Both commands serve different purposes - COPY for server-local file operations and \\copy for client-side file transfers. COPY is faster for server-local bulk loading."
```

---

## Configuring postgresql.conf

The main server configuration file is `postgresql.conf`, located in the data directory. Changes to most parameters require a server reload (`SELECT pg_reload_conf();` or `pg_ctl reload`), though some require a full restart.

### Connection Settings

```ini
listen_addresses = 'localhost'    # Which interfaces to listen on ('*' for all)
port = 5432                       # TCP port
max_connections = 100             # Maximum concurrent connections
```

`listen_addresses` controls which network interfaces PostgreSQL binds to. The default `localhost` only accepts local connections. Set it to `'*'` to listen on all interfaces, but always pair this with proper `pg_hba.conf` rules.

`max_connections` has a direct impact on memory usage because each connection consumes `work_mem` and other per-session resources. Connection poolers like [**PgBouncer**](https://www.pgbouncer.org/) allow hundreds of application connections to share a smaller pool of database connections.

### Memory Settings

```ini
shared_buffers = '256MB'          # Shared memory for caching data pages
work_mem = '4MB'                  # Per-operation memory for sorts and hashes
maintenance_work_mem = '64MB'     # Memory for VACUUM, CREATE INDEX, etc.
effective_cache_size = '1GB'      # Planner's estimate of available OS cache
```

**shared_buffers** is the most important memory parameter. It controls how much memory PostgreSQL allocates for caching table and index data in shared memory. Start with 25% of total RAM and adjust based on your workload. Setting it too high wastes memory that the OS file cache could use more effectively.

**work_mem** is allocated per sort or hash operation within a query - a complex query with multiple sorts can allocate `work_mem` multiple times. Keep this conservative (4-16 MB) for OLTP workloads with many connections. Increase it for analytical queries that need large in-memory sorts.

**maintenance_work_mem** affects operations like `VACUUM`, `CREATE INDEX`, and `ALTER TABLE ADD FOREIGN KEY`. Setting this higher (256 MB - 1 GB) speeds up these maintenance operations. It only matters during maintenance, so higher values are safe.

**effective_cache_size** does not allocate any memory. It tells the query planner how much memory is available for disk caching (shared_buffers plus OS file cache). Set it to approximately 75% of total RAM on a dedicated database server. A higher value makes the planner more likely to choose index scans over sequential scans.

### WAL Settings

```ini
wal_level = 'replica'             # Logging level: minimal, replica, or logical
```

**Write-Ahead Logging** (WAL) ensures crash recovery by writing changes to a log before applying them to data files. The `wal_level` parameter controls how much information is recorded:

- `minimal` - enough for crash recovery only; no replication support
- `replica` - adds information needed for streaming replication and point-in-time recovery (the default since PostgreSQL 10)
- `logical` - adds information needed for logical decoding and logical replication

!!! warning "WAL level changes require restart"
    Changing `wal_level` requires a full server restart. Set it to `replica` from the start if you might ever need replication or point-in-time recovery. Upgrading from `minimal` later means a restart window.

---

## Configuring pg_hba.conf

The **pg_hba.conf** file (Host-Based Authentication) controls who can connect to the database, from where, and how they must authenticate. PostgreSQL evaluates rules top to bottom and uses the first matching rule. If no rule matches, the connection is rejected.

### Record Format

Each line in `pg_hba.conf` has the format:

```
TYPE  DATABASE  USER  ADDRESS  METHOD
```

| Field | Values |
|-------|--------|
| TYPE | `local` (Unix socket), `host` (TCP/IP with or without SSL), `hostssl` (SSL only), `hostnossl` (non-SSL only) |
| DATABASE | `all`, a database name, a comma-separated list, or `sameuser` |
| USER | `all`, a role name, a comma-separated list, or `+groupname` for group membership |
| ADDRESS | IP address with CIDR mask (for `host` types), omitted for `local` |
| METHOD | `trust`, `peer`, `md5`, `scram-sha-256`, `cert`, `reject`, and others |

### Authentication Methods

**trust** - allows the connection unconditionally without a password. Only appropriate for local development on single-user machines:

```
local   all   all   trust
```

**peer** - uses the operating system username to authenticate. The connecting OS user must match the PostgreSQL role name. This is the default for local Unix socket connections:

```
local   all   all   peer
```

**md5** - requires an MD5-hashed password. Supported by all clients but less secure than `scram-sha-256`:

```
host    all   all   192.168.1.0/24   md5
```

**scram-sha-256** - the strongest password-based authentication method. Uses the SCRAM-SHA-256 challenge-response protocol. Recommended for all password-authenticated connections:

```
host    all   all   10.0.0.0/8   scram-sha-256
```

**cert** - authenticates using client SSL certificates. The client must present a valid certificate signed by a trusted CA:

```
hostssl   all   all   0.0.0.0/0   cert
```

**reject** - unconditionally rejects the connection. Useful as a catch-all at the end of the file or to block specific networks:

```
host    all   all   0.0.0.0/0   reject
```

!!! danger "Order matters"
    PostgreSQL evaluates pg_hba.conf rules top to bottom and uses the first match. A `trust` rule above a `scram-sha-256` rule will override the stronger method. Always place more restrictive rules before less restrictive ones, and end with a `reject` rule for defense in depth.

```code-walkthrough
language: bash
title: Understanding pg_hba.conf
code: |
  # TYPE  DATABASE  USER  ADDRESS       METHOD
  local   all       all                 peer
  host    all       all   127.0.0.1/32  scram-sha-256
  host    all       all   ::1/128       scram-sha-256
  host    mydb      app   10.0.0.0/8    scram-sha-256
  host    all       all   0.0.0.0/0     reject
annotations:
  - line: 1
    text: "Comment line defining the column format. Every pg_hba.conf entry has these fields: connection type, target database, target user, client address (except for local connections), and authentication method."
  - line: 2
    text: "Unix socket connections from any local user to any database use peer authentication. The OS username must match the PostgreSQL role name. This is why 'sudo -u postgres psql' works without a password - the OS user 'postgres' matches the PostgreSQL superuser role 'postgres'."
  - line: 3
    text: "TCP connections from localhost (127.0.0.1) require scram-sha-256 password authentication. The /32 mask means this rule matches only the exact IP 127.0.0.1. This covers applications connecting via TCP on the same machine."
  - line: 4
    text: "Same as above but for IPv6 localhost (::1). The /128 mask is the IPv6 equivalent of /32. Both rules are needed because clients may connect via either IPv4 or IPv6 loopback."
  - line: 5
    text: "The application user 'app' can connect to 'mydb' from the 10.0.0.0/8 private network using scram-sha-256. This is a targeted rule - only one user to one database from one network. This pattern limits the blast radius if the app credentials are compromised."
  - line: 6
    text: "Reject all other connections from any address. This catch-all rule at the bottom is defense in depth - if no earlier rule matched, the connection is denied. Without this rule, unmatched connections would also be rejected (PostgreSQL's default), but an explicit reject makes the intent clear and prevents accidental exposure if a permissive rule is added later."
```

After editing `pg_hba.conf`, reload the configuration:

```bash
sudo -u postgres psql -c "SELECT pg_reload_conf();"
# Or
pg_ctl -D /var/lib/pgsql/16/data reload
```

---

## Schemas vs Databases

PostgreSQL organizes objects in a three-level hierarchy: **cluster** > **database** > **schema** > objects (tables, views, functions, indexes). Understanding this hierarchy is essential for organizing your data and managing access.

### The Catalog Hierarchy

A **cluster** is the entire PostgreSQL instance managed by one `postmaster` process. It contains multiple databases, but cross-database queries are not possible in a single SQL statement (unlike MySQL, where you can `SELECT` across databases freely).

A **database** is an isolated container of schemas and objects. Each connection targets exactly one database. You create databases with:

```sql
CREATE DATABASE analytics OWNER app_user;
```

A **schema** is a namespace within a database. It allows you to group related objects and control access at the namespace level. Multiple schemas can contain tables with the same name without conflict:

```sql
CREATE SCHEMA inventory;
CREATE TABLE inventory.products (id serial PRIMARY KEY, name text);

CREATE SCHEMA reporting;
CREATE TABLE reporting.products (id serial PRIMARY KEY, name text, summary text);
```

### The public Schema

Every new database contains a **public** schema. When you create objects without specifying a schema, they go into `public`. When you query without specifying a schema, PostgreSQL searches according to the **search_path**:

```sql
-- These are equivalent when search_path includes 'public'
SELECT * FROM users;
SELECT * FROM public.users;

-- Check the current search path
SHOW search_path;
-- "$user", public

-- Modify the search path for the session
SET search_path TO myapp, public;
```

The default `search_path` is `"$user", public`. PostgreSQL first looks for a schema matching the current role name, then falls back to `public`. Setting a custom `search_path` at the role or database level organizes multi-tenant or multi-module applications:

```sql
-- Set a default search_path for a role
ALTER ROLE app_user SET search_path TO myapp, public;

-- Set a default search_path for a database
ALTER DATABASE mydb SET search_path TO myapp, public;
```

### When to Use Schemas vs Databases

| Use Case | Choose |
|----------|--------|
| Fully isolated applications with different users and permissions | Separate databases |
| Logical grouping within one application (e.g., `auth`, `billing`, `inventory`) | Schemas within one database |
| Multi-tenant applications where tenants share the same table structure | One schema per tenant |
| Extensions that need to be shared (e.g., `pg_stat_statements`) | Schemas within one database (extensions are per-database) |

```quiz
question: "In PostgreSQL, what happens when you run CREATE TABLE products (...) without specifying a schema?"
type: multiple-choice
options:
  - text: "PostgreSQL creates the table in a schema matching the current user's name, or raises an error if that schema does not exist"
    feedback: "Close, but not quite. The search_path determines where unqualified objects are created. The default search_path is '\"$user\", public'. PostgreSQL uses the first schema in the path that exists. If a schema matching the username does not exist, it falls through to public."
  - text: "The table is created in the public schema (assuming the default search_path)"
    correct: true
    feedback: "Correct. With the default search_path of '\"$user\", public', PostgreSQL tries the user-named schema first. Since most users do not have a schema matching their role name, it falls through to public. The table is created in public. To change this behavior, modify the search_path or create objects with explicit schema qualification."
  - text: "PostgreSQL prompts you to choose a schema"
    feedback: "PostgreSQL does not prompt for schema selection. It uses the search_path setting to determine where unqualified objects are created. The first existing schema in the search_path is used."
  - text: "The table is created in the pg_catalog schema alongside system tables"
    feedback: "pg_catalog is reserved for PostgreSQL system catalogs. User tables cannot be created there. Unqualified table creation uses the search_path, which defaults to the user's schema and then public."
```

---

## System Catalogs

PostgreSQL stores all metadata - table definitions, column types, indexes, functions, permissions, and statistics - in **system catalogs**. These are regular tables that you can query with SQL.

### The pg_catalog Schema

Every database contains a `pg_catalog` schema with the catalog tables. The most commonly queried catalogs:

| Catalog | Contents |
|---------|----------|
| `pg_class` | All relations (tables, indexes, sequences, views) |
| `pg_attribute` | All columns of all relations |
| `pg_index` | Index definitions and properties |
| `pg_namespace` | Schemas |
| `pg_roles` | Roles (users and groups) |
| `pg_database` | Databases in the cluster |
| `pg_proc` | Functions and procedures |
| `pg_type` | Data types |
| `pg_settings` | Server configuration parameters (queryable view of `postgresql.conf`) |

You can query these directly:

```sql
-- Find all tables in the public schema
SELECT relname, relkind, reltuples::bigint AS row_estimate
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
ORDER BY reltuples DESC;

-- Find all indexes on a table
SELECT indexrelid::regclass AS index_name,
       indisunique AS is_unique,
       indisprimary AS is_primary
FROM pg_index
WHERE indrelid = 'users'::regclass;
```

### Statistical Views

PostgreSQL collects runtime statistics through the **statistics collector**. The `pg_stat_*` views expose this data:

**pg_stat_activity** - shows every current connection, its query, and its state:

```sql
SELECT pid, usename, datname, state, query, query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

This is your first stop when diagnosing slow queries or connection issues. The `state` column shows `active` (running a query), `idle` (waiting for a command), `idle in transaction` (inside an open transaction but not executing), and `idle in transaction (aborted)`.

!!! warning "Idle in transaction"
    Connections in `idle in transaction` state hold locks and prevent VACUUM from cleaning up dead rows. If you see long-running idle-in-transaction sessions, investigate the application code. Set `idle_in_transaction_session_timeout` to automatically terminate sessions that sit idle inside a transaction too long.

**pg_stat_user_tables** - per-table statistics including sequential scan counts, index scan counts, and dead tuple counts:

```sql
SELECT schemaname, relname,
       seq_scan, seq_tup_read,
       idx_scan, idx_tup_fetch,
       n_tup_ins, n_tup_upd, n_tup_del,
       n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

Tables with high `seq_scan` counts and low `idx_scan` counts may need better indexes. Tables with high `n_dead_tup` counts may need more aggressive autovacuum settings.

### The information_schema

PostgreSQL also provides the SQL-standard **information_schema** - a set of views that present catalog data in a standardized, portable format:

```sql
-- List all columns in a table (portable across databases)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- List all tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
```

The `information_schema` is portable across SQL databases, but it is slower than querying `pg_catalog` directly because it uses complex views. For PostgreSQL-specific metadata (like tablespace, storage parameters, or toast tables), you need the `pg_catalog` tables.

```exercise
title: PostgreSQL Catalog Exploration
type: scenario
scenario: |
  You are a database administrator who just inherited a PostgreSQL database called `webapp`. You need to assess the current state of the database before making any changes. Using system catalogs and psql meta-commands, answer the following questions about the database.
tasks:
  - task: "Write a query to find all tables in the public schema that have more than 10,000 estimated rows, showing the table name, estimated row count, and whether autovacuum has ever run on them."
    hint: "Combine pg_class for row estimates with pg_stat_user_tables for autovacuum information."
    answer: "SELECT c.relname, c.reltuples::bigint AS estimated_rows, s.last_autovacuum FROM pg_class c JOIN pg_stat_user_tables s ON c.relname = s.relname WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.reltuples > 10000 ORDER BY c.reltuples DESC;"
  - task: "Write a query to find tables with a high ratio of sequential scans to index scans, which might indicate missing indexes."
    hint: "Use pg_stat_user_tables. Compare seq_scan and idx_scan columns. Filter out tables with no scans at all."
    answer: "SELECT relname, seq_scan, idx_scan, CASE WHEN idx_scan > 0 THEN round(seq_scan::numeric / idx_scan, 2) ELSE NULL END AS seq_to_idx_ratio FROM pg_stat_user_tables WHERE seq_scan + idx_scan > 0 ORDER BY seq_scan DESC;"
  - task: "Write a query to identify connections that have been idle in transaction for more than 5 minutes."
    hint: "Use pg_stat_activity. Filter on state and compare the current time to xact_start or state_change."
    answer: "SELECT pid, usename, datname, state, query, age(now(), state_change) AS idle_duration FROM pg_stat_activity WHERE state = 'idle in transaction' AND now() - state_change > interval '5 minutes' ORDER BY state_change;"
  - task: "Write the psql meta-command to describe all indexes on a table called 'orders', then write the equivalent SQL query using pg_catalog."
    hint: "The psql meta-command is a single backslash command. For the SQL equivalent, query pg_index joined with pg_class."
    answer: "The psql command is: \\di+ public.orders* (or \\d orders to see indexes as part of the table description). The SQL equivalent: SELECT i.relname AS index_name, ix.indisunique, ix.indisprimary, pg_get_indexdef(ix.indexrelid) AS definition FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid WHERE ix.indrelid = 'orders'::regclass ORDER BY i.relname;"
```

---

## Further Reading

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/current/) - the complete reference for every feature, function, and configuration parameter
- [PostgreSQL Wiki - Tuning Your PostgreSQL Server](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server) - community-maintained tuning guidance with workload-specific recommendations
- [pgTune](https://pgtune.leopard.in.ua/) - web-based configuration calculator that generates postgresql.conf settings based on your hardware
- [The Internals of PostgreSQL](https://www.interdb.jp/pg/) - free online book covering MVCC, WAL, query processing, and buffer management internals
- [pg_hba.conf Documentation](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) - full reference for authentication configuration with examples for every method

---

**Previous:** [MySQL Replication & High Availability](mysql-replication.md) | **Next:** [PostgreSQL Administration](postgresql-administration.md) | [Back to Index](README.md)
