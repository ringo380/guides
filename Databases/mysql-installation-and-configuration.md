# MySQL Installation & Configuration

Getting a database server running is the easy part. Getting it configured correctly - so it performs well, stores your data safely, and doesn't fall over under load - takes understanding. This guide covers installing [**MySQL**](https://dev.mysql.com/doc/refman/8.0/en/) on every major platform, understanding the configuration file that controls its behavior, choosing between storage engines, sizing the buffer pool, getting character sets right, and locking down the installation before anything touches production.

---

## Installing MySQL

### Debian and Ubuntu (apt)

The [**MySQL APT Repository**](https://dev.mysql.com/downloads/repo/apt/) provides the latest packages for Debian-based distributions. You can also install the version bundled with your distribution's default repositories, though it may be older.

```bash
# Install from the default Ubuntu/Debian repos
sudo apt update
sudo apt install mysql-server

# Check the installed version
mysql --version
```

On Ubuntu 22.04+, this installs MySQL 8.0. The service starts automatically after installation.

```bash
# Verify the service is running
sudo systemctl status mysql

# Enable MySQL to start on boot (usually enabled by default)
sudo systemctl enable mysql
```

### RHEL, Fedora, and CentOS (dnf/yum)

Red Hat-based distributions often ship [**MariaDB**](https://mariadb.org/documentation/) by default instead of MySQL. To install MySQL itself, add the official MySQL repository first.

```bash
# Fedora / RHEL 8+ / CentOS Stream (dnf)
sudo dnf install https://dev.mysql.com/get/mysql80-community-release-el8-9.noarch.rpm
sudo dnf install mysql-community-server

# CentOS 7 (yum)
sudo yum install https://dev.mysql.com/get/mysql80-community-release-el7-11.noarch.rpm
sudo yum install mysql-community-server
```

Start and enable the service:

```bash
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

!!! warning "Temporary root password on RHEL-based installs"
    MySQL on RHEL/CentOS generates a temporary root password during installation. Retrieve it before doing anything else:

    ```bash
    sudo grep 'temporary password' /var/log/mysqld.log
    ```

    You must change this password on first login. The `mysql_secure_installation` script (covered later) handles this.

### macOS (Homebrew)

[**Homebrew**](https://brew.sh/) is the simplest path on macOS:

```bash
brew install mysql

# Start the service
brew services start mysql
```

Homebrew installs MySQL with no root password by default. You should run `mysql_secure_installation` immediately after starting the service.

### Docker

Running MySQL in [**Docker**](https://hub.docker.com/_/mysql) is the fastest way to get a disposable instance for development or testing. The official `mysql` image supports all 8.0.x releases.

```bash
# Pull and run MySQL 8.0
docker run --name mysql-dev \
  -e MYSQL_ROOT_PASSWORD=changeme \
  -p 3306:3306 \
  -d mysql:8.0
```

For a more reproducible setup, use a `docker-compose.yml` file:

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: mysql-dev
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: changeme
      MYSQL_DATABASE: appdb
      MYSQL_USER: appuser
      MYSQL_PASSWORD: apppassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./my-custom.cnf:/etc/mysql/conf.d/custom.cnf

volumes:
  mysql_data:
```

The `volumes` entry for `mysql_data` ensures your data survives container restarts. The second volume mount lets you inject a custom configuration file.

```bash
# Start the stack
docker compose up -d

# Connect to the running instance
docker exec -it mysql-dev mysql -u root -p
```

```terminal
title: Installing MySQL on Ubuntu and Verifying the Service
steps:
  - command: "sudo apt update && sudo apt install -y mysql-server"
    output: |
      Reading package lists... Done
      Building dependency tree... Done
      The following NEW packages will be installed:
        mysql-client-8.0 mysql-client-core-8.0 mysql-common
        mysql-server-8.0 mysql-server-core-8.0
      Setting up mysql-server-8.0 (8.0.39-0ubuntu0.22.04.1) ...
      Processing triggers for systemd (249.11-0ubuntu3.12) ...
    narration: "The apt package manager installs MySQL server along with the client tools. On Ubuntu, the service starts automatically."
  - command: "sudo systemctl status mysql --no-pager"
    output: |
      ● mysql.service - MySQL Community Server
           Loaded: loaded (/lib/systemd/system/mysql.service; enabled)
           Active: active (running) since Wed 2025-03-12 14:22:01 UTC; 30s ago
         Main PID: 4821 (mysqld)
           Status: "Server is operational"
            Tasks: 38 (limit: 4915)
           Memory: 362.4M
              CPU: 1.204s
           CGroup: /system.slice/mysql.service
                   └─4821 /usr/sbin/mysqld
    narration: "systemctl confirms MySQL is running. The service is 'enabled', meaning it will start automatically on boot."
  - command: "mysql --version"
    output: "mysql  Ver 8.0.39-0ubuntu0.22.04.1 for Linux on x86_64 ((Ubuntu))"
    narration: "Verify the installed version. MySQL 8.0 is the current GA release series."
  - command: "sudo mysql -e 'SELECT VERSION();'"
    output: |
      +-------------------------+
      | VERSION()               |
      +-------------------------+
      | 8.0.39-0ubuntu0.22.04.1 |
      +-------------------------+
    narration: "On Ubuntu, the root MySQL user authenticates via the auth_socket plugin by default, so sudo mysql works without a password. This is secure for local administration but differs from the password-based login you get on other platforms."
```

```quiz
question: "On a fresh MySQL installation on RHEL/CentOS, where do you find the temporary root password?"
type: multiple-choice
options:
  - text: "It's printed to the terminal during installation"
    feedback: "The password is logged, not printed to stdout. It's easy to miss if you aren't looking for it in the right place."
  - text: "In /var/log/mysqld.log"
    correct: true
    feedback: "Correct! MySQL on RHEL-based systems generates a temporary root password and writes it to the error log at /var/log/mysqld.log. Grep for 'temporary password' to find it."
  - text: "In /etc/mysql/my.cnf"
    feedback: "The configuration file does not contain passwords. The temporary root password is written to the MySQL error log."
  - text: "There is no root password by default"
    feedback: "That's true for Homebrew on macOS and some Ubuntu installations, but RHEL/CentOS installs generate a mandatory temporary password that must be changed on first login."
```

---

## The `my.cnf` Configuration File

MySQL reads its configuration from `my.cnf` (or `my.ini` on Windows). This file controls everything from memory allocation to networking behavior to storage engine defaults.

### File Locations

MySQL checks multiple locations in a specific order, with later files overriding earlier ones:

| Order | Path | Typical Use |
|-------|------|-------------|
| 1 | `/etc/my.cnf` | System-wide defaults (RHEL/CentOS) |
| 2 | `/etc/mysql/my.cnf` | System-wide defaults (Debian/Ubuntu) |
| 3 | `~/.my.cnf` | Per-user client settings |
| 4 | Files in `conf.d/` directories | Drop-in overrides |

To see exactly which files your MySQL installation reads and in what order:

```bash
mysqld --verbose --help 2>/dev/null | head -20
```

Or check the compiled-in defaults:

```bash
mysql --help | grep -A 1 "Default options"
```

### Section Structure

`my.cnf` uses an INI-style format with **sections** (also called groups) that target different programs:

```ini
[mysqld]
# Settings for the MySQL server daemon
datadir = /var/lib/mysql
port = 3306

[mysql]
# Settings for the mysql command-line client
prompt = \\u@\\h [\\d]>\_

[client]
# Settings for ALL MySQL client programs (mysql, mysqldump, etc.)
port = 3306
socket = /var/run/mysqld/mysqld.sock
```

The `[mysqld]` section is where the server tuning happens. The `[client]` section applies to every client tool. The `[mysql]` section applies only to the interactive `mysql` CLI.

### Option Precedence

When the same option appears in multiple places, MySQL follows this precedence (highest to lowest):

1. **Command-line arguments** - `mysqld --innodb-buffer-pool-size=2G`
2. **Last file read** in the config file chain
3. **Within a file**, the last occurrence of an option wins

This means a setting in `/etc/mysql/conf.d/custom.cnf` overrides the same setting in `/etc/mysql/my.cnf`, and a command-line flag overrides everything.

!!! tip "Use conf.d directories for custom settings"
    Instead of editing the main `my.cnf` directly, drop a file into `/etc/mysql/conf.d/` (Debian/Ubuntu) or `/etc/my.cnf.d/` (RHEL/CentOS). This keeps your customizations separate from package-managed defaults and survives package upgrades cleanly.

```code-walkthrough
title: "A Production my.cnf Configuration"
language: ini
code: |
  [mysqld]
  # Networking
  bind-address = 0.0.0.0
  port = 3306
  max_connections = 200

  # InnoDB Storage Engine
  default_storage_engine = InnoDB
  innodb_buffer_pool_size = 4G
  innodb_log_file_size = 512M
  innodb_file_per_table = ON
  innodb_flush_log_at_trx_commit = 1
  innodb_flush_method = O_DIRECT

  # Character Set
  character_set_server = utf8mb4
  collation_server = utf8mb4_0900_ai_ci

  # Logging
  slow_query_log = ON
  slow_query_log_file = /var/log/mysql/slow.log
  long_query_time = 1
  log_error = /var/log/mysql/error.log

  # Binary Logging (required for replication and PITR)
  server_id = 1
  log_bin = /var/log/mysql/mysql-bin
  binlog_expire_logs_seconds = 604800

  [mysql]
  prompt = \\u@\\h [\\d]>\\_
  default_character_set = utf8mb4

  [client]
  default_character_set = utf8mb4
  socket = /var/run/mysqld/mysqld.sock
annotations:
  - line: 3
    text: "bind-address controls which network interfaces MySQL listens on. 0.0.0.0 means all interfaces. For a server that only accepts local connections, use 127.0.0.1."
  - line: 5
    text: "max_connections sets the maximum number of simultaneous client connections. The default (151) is often too low for production. Each connection consumes memory, so don't set this arbitrarily high."
  - line: 8
    text: "Explicitly setting InnoDB as the default engine is good practice, even though it has been the default since MySQL 5.5."
  - line: 9
    text: "innodb_buffer_pool_size is the single most important tuning parameter. This 4G setting is appropriate for a server with ~8G of RAM dedicated to MySQL. General rule: 50-70% of available RAM."
  - line: 10
    text: "innodb_log_file_size controls the redo log size. Larger logs improve write performance but increase crash recovery time. 512M is a solid starting point."
  - line: 11
    text: "innodb_file_per_table = ON stores each table in its own .ibd file instead of the shared ibdata1 tablespace. This is the default in MySQL 8.0 and makes space reclamation possible."
  - line: 12
    text: "innodb_flush_log_at_trx_commit = 1 ensures every committed transaction is flushed to disk. This is the ACID-compliant setting. Values of 0 or 2 trade durability for write speed."
  - line: 13
    text: "O_DIRECT bypasses the OS page cache for InnoDB data files, avoiding double-buffering. The buffer pool already caches data in userspace."
  - line: 16
    text: "utf8mb4 is the correct UTF-8 encoding in MySQL. The legacy 'utf8' (alias for utf8mb3) only supports 3-byte characters and cannot store emoji or many CJK characters."
  - line: 17
    text: "utf8mb4_0900_ai_ci is the default collation in MySQL 8.0. It follows Unicode 9.0 rules, is accent-insensitive (ai) and case-insensitive (ci)."
  - line: 20
    text: "The slow query log captures queries exceeding long_query_time. This is your primary tool for finding queries that need optimization."
  - line: 22
    text: "long_query_time = 1 logs queries taking more than 1 second. In high-traffic applications, you might lower this to 0.5 or even 0.1."
  - line: 26
    text: "server_id must be unique across all servers in a replication topology. Even if you aren't using replication today, enabling binary logging allows point-in-time recovery."
  - line: 28
    text: "binlog_expire_logs_seconds = 604800 keeps 7 days of binary logs (7 * 24 * 3600). Adjust based on your backup schedule and disk space."
  - line: 30
    text: "The [mysql] section configures only the interactive mysql client. The custom prompt shows user, host, and current database."
  - line: 34
    text: "The [client] section applies to all client programs - mysql, mysqldump, mysqladmin, and any tool using the MySQL client library."
```

---

## Storage Engines: InnoDB vs MyISAM

A **storage engine** is the component that handles how data is physically stored, retrieved, and indexed. MySQL's pluggable architecture supports multiple storage engines, but in practice you will use one of two: **InnoDB** or **MyISAM**.

### InnoDB

InnoDB has been the default storage engine since MySQL 5.5, and for good reason. It provides:

- **ACID transactions** - full commit, rollback, and crash recovery
- **Row-level locking** - concurrent reads and writes without blocking each other
- **Foreign key constraints** - referential integrity enforced by the engine
- **Crash recovery** - the redo log (write-ahead log) ensures committed data survives power failures
- **MVCC** (Multi-Version Concurrency Control) - readers don't block writers and vice versa
- **Clustered indexes** - data is physically ordered by the primary key, making primary key lookups extremely fast

### MyISAM

MyISAM was the default engine before MySQL 5.5. It still exists but is rarely the right choice:

- **Table-level locking** - a write to any row locks the entire table
- **No transactions** - no commit, no rollback, no crash recovery guarantees
- **No foreign keys** - referential integrity must be enforced by your application
- **Full-text indexing** - MyISAM had this first, but InnoDB supports it since MySQL 5.6
- **Smaller disk footprint** - MyISAM tables are slightly more compact for read-heavy, append-only workloads
- **REPAIR TABLE** - MyISAM tables can be repaired after corruption, but they corrupt more easily than InnoDB

### Feature Comparison

| Feature | InnoDB | MyISAM |
|---------|--------|--------|
| Transactions | Yes (ACID) | No |
| Locking | Row-level | Table-level |
| Foreign keys | Yes | No |
| Crash recovery | Automatic (redo log) | Manual (`REPAIR TABLE`) |
| Full-text search | Yes (5.6+) | Yes |
| MVCC | Yes | No |
| Clustered index | Yes | No |
| Compressed tables | Yes | Yes |
| Geospatial indexes | Yes (5.7+) | Yes |
| Default since | MySQL 5.5 | Before 5.5 |

!!! danger "Use InnoDB unless you have a specific, documented reason not to"
    MyISAM's table-level locking makes it unsuitable for any workload with concurrent writes. A single slow `UPDATE` blocks every other query on that table. InnoDB's row-level locking handles concurrency far better. The only remaining niche for MyISAM is read-only data loaded in bulk and queried by full-text search, and even that use case is shrinking as InnoDB's full-text implementation matures.

### `innodb_file_per_table`

By default (since MySQL 5.6.6), InnoDB stores each table in its own **tablespace file** - a `.ibd` file in the data directory. This setting is controlled by `innodb_file_per_table`.

```ini
[mysqld]
innodb_file_per_table = ON   # default in MySQL 8.0
```

When `innodb_file_per_table = ON`:

- Each table gets its own `schema_name/table_name.ibd` file
- Dropping a table or running `OPTIMIZE TABLE` reclaims disk space to the OS
- You can place individual tables on different storage devices using `DATA DIRECTORY`
- Backups can target individual tables (Percona XtraBackup supports partial backups)

When `innodb_file_per_table = OFF`:

- All table data goes into the shared **system tablespace** (`ibdata1`)
- `ibdata1` grows but never shrinks - dropped tables leave empty space inside the file, but the file itself stays large
- The only way to reclaim that space is to dump all data, delete `ibdata1`, and reimport

There is almost never a reason to disable this setting on MySQL 8.0.

```quiz
question: "What happens when you DROP a large table and innodb_file_per_table is OFF?"
type: multiple-choice
options:
  - text: "The disk space is immediately returned to the operating system"
    feedback: "When innodb_file_per_table is OFF, all data lives in the shared ibdata1 file. Dropping a table marks the space as reusable within ibdata1, but the file itself does not shrink."
  - text: "The space is freed inside ibdata1 but the file does not shrink"
    correct: true
    feedback: "Correct! The shared system tablespace (ibdata1) never shrinks. Dropped table space becomes available for new InnoDB data within the file, but the disk space is not returned to the OS. This is one of the main reasons innodb_file_per_table = ON is the default."
  - text: "MySQL automatically runs OPTIMIZE TABLE to reclaim space"
    feedback: "OPTIMIZE TABLE can reclaim space when innodb_file_per_table is ON (it rebuilds the table's .ibd file), but it cannot shrink ibdata1."
  - text: "The table data is moved to a temporary file before deletion"
    feedback: "No intermediate file is created. With innodb_file_per_table OFF, the data simply remains as unused pages inside ibdata1."
```

---

## Buffer Pool Sizing

The **InnoDB buffer pool** is a memory cache that holds table data and index pages. When MySQL reads a row, it loads the page containing that row into the buffer pool. Subsequent reads of the same data come from memory instead of disk. The buffer pool is the single most impactful tuning parameter in MySQL.

### How It Works

The buffer pool uses an LRU (Least Recently Used) algorithm with a twist: InnoDB splits the list into a "young" sublist and an "old" sublist. Pages enter at the midpoint of the old sublist and only get promoted to the young sublist if they are accessed again after a short delay. This prevents a one-time table scan from flushing frequently accessed pages out of cache.

### Sizing Guidelines

The general rule: set `innodb_buffer_pool_size` to **50-70%** of the total RAM on a dedicated database server.

| Server RAM | Buffer Pool Size | Reasoning |
|-----------|-----------------|-----------|
| 2 GB | 1 GB | Small dev/staging server, leave room for OS and connections |
| 8 GB | 5-6 GB | Typical production server |
| 32 GB | 20-24 GB | Large production workload |
| 128 GB | 80-100 GB | High-performance dedicated database |

```ini
[mysqld]
# For an 8 GB server
innodb_buffer_pool_size = 5G

# For large buffer pools (> 1 GB), use multiple instances
# Each instance gets its own mutex, reducing contention
innodb_buffer_pool_instances = 4
```

!!! tip "Check your buffer pool hit ratio"
    After running under production load, check how effectively the buffer pool is serving reads:

    ```sql
    SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
    ```

    Calculate the hit ratio: `1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)`. A ratio below 99% on a warmed-up server suggests the buffer pool is too small - data is being read from disk when it should be in memory.

Don't over-allocate. The operating system needs memory for its own page cache, for per-connection buffers (`sort_buffer_size`, `join_buffer_size`, `read_buffer_size` multiplied by `max_connections`), and for the OS itself. A MySQL server that uses all available RAM will trigger the OOM killer, and a dead database is worse than a slow one.

---

## Character Sets and Collations

A **character set** defines which characters can be stored. A **collation** defines how those characters are sorted and compared. Getting this wrong causes data loss, broken searches, or silent corruption.

### utf8mb4 vs utf8 (utf8mb3)

MySQL's `utf8` character set is not real UTF-8. It uses a maximum of 3 bytes per character, which means it cannot store any character that requires 4 bytes in UTF-8 encoding. This includes:

- Emoji (U+1F600 and above)
- Many CJK unified ideographs
- Musical symbols
- Mathematical symbols beyond the Basic Multilingual Plane

**`utf8mb4`** is MySQL's true UTF-8 implementation, supporting the full Unicode range with up to 4 bytes per character. It has been the default character set since MySQL 8.0.

```sql
-- Check current server defaults
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';

-- Set at the server level in my.cnf
-- [mysqld]
-- character_set_server = utf8mb4
-- collation_server = utf8mb4_0900_ai_ci

-- Set at the database level
CREATE DATABASE myapp CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Set at the table level
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

### Choosing a Collation

MySQL 8.0 ships with over 40 collations for `utf8mb4`. The most commonly used:

| Collation | Behavior | Use When |
|-----------|----------|----------|
| `utf8mb4_0900_ai_ci` | Accent-insensitive, case-insensitive (Unicode 9.0) | Default for most applications |
| `utf8mb4_0900_as_cs` | Accent-sensitive, case-sensitive | Usernames, codes where "cafe" and "cafe" must differ |
| `utf8mb4_unicode_ci` | Case-insensitive (older Unicode standard) | Legacy applications migrating from MySQL 5.7 |
| `utf8mb4_bin` | Binary comparison (byte-by-byte) | Exact matching, hash values, case-sensitive without linguistic rules |
| `utf8mb4_general_ci` | Simplified case-insensitive | Avoid - faster than unicode_ci on old hardware but less correct |

The `_ai_` and `_as_` segments mean accent-insensitive and accent-sensitive. The `_ci` and `_cs` suffixes mean case-insensitive and case-sensitive.

!!! warning "Migrating from utf8 to utf8mb4"
    If you have existing tables using `utf8` (utf8mb3), converting to `utf8mb4` increases the maximum byte length of each character from 3 to 4. This can push `VARCHAR(255)` columns past the 767-byte index prefix limit on older row formats. On MySQL 8.0 with `DYNAMIC` row format (the default), the index prefix limit is 3072 bytes, so this is rarely a problem. Test the conversion on a copy of your data first:

    ```sql
    ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
    ```

```quiz
question: "Why should you use utf8mb4 instead of utf8 in MySQL?"
type: multiple-choice
options:
  - text: "utf8mb4 is faster because it uses fewer bytes per character"
    feedback: "utf8mb4 actually uses up to 4 bytes per character compared to utf8's 3 bytes. It is not faster - it is more correct."
  - text: "MySQL's utf8 only supports 3 bytes per character and cannot store emoji or many Unicode characters above the Basic Multilingual Plane"
    correct: true
    feedback: "Correct! MySQL's utf8 (utf8mb3) is a broken implementation that caps at 3 bytes. Real UTF-8 uses up to 4 bytes. utf8mb4 is MySQL's true UTF-8 and should be used for all new databases."
  - text: "utf8 has been deprecated and removed from MySQL 8.0"
    feedback: "utf8 (utf8mb3) is deprecated as of MySQL 8.0.28 but not removed. It still works, but new databases should always use utf8mb4."
  - text: "utf8mb4 supports more collation options"
    feedback: "While utf8mb4 does have newer collations (like the 0900 series), the primary reason to use it is that MySQL's utf8 cannot represent the full Unicode character set."
```

---

## MariaDB vs MySQL

[**MariaDB**](https://mariadb.com/kb/en/documentation/) is a fork of MySQL created in 2009 by Michael "Monty" Widenius (MySQL's original author) after Oracle acquired Sun Microsystems. MariaDB aims for MySQL compatibility but has diverged in several areas.

### Where MariaDB Diverges

**JSON support**: MySQL 8.0 stores JSON in an optimized binary format with a dedicated `JSON` data type that validates on insert. MariaDB's `JSON` is an alias for `LONGTEXT` - it accepts JSON syntax but stores it as plain text without binary optimization. MySQL's JSON path expressions and functions (`JSON_TABLE`, `JSON_ARRAYAGG`) are generally more mature.

**Authentication plugins**: MySQL 8.0 defaults to `caching_sha2_password`, which requires TLS or RSA key exchange. MariaDB uses `mysql_native_password` by default, which is less secure but more compatible with older client libraries. This difference breaks some client connections when switching between servers.

**Optimizer**: MariaDB includes optimizer features that MySQL lacks, such as condition pushdown for derived tables (before MySQL 8.0.22 added it), and the `optimizer_switch` settings differ. MariaDB's cost model and join algorithms diverge enough that the same query can choose different execution plans on each.

**Window functions**: MariaDB added window functions in version 10.2 (2017). MySQL added them in 8.0 (2018). The implementations are functionally similar but differ in edge cases around frame specifications.

**System-versioned tables**: MariaDB supports temporal tables natively with `WITH SYSTEM VERSIONING`, allowing you to query historical row states. MySQL has no equivalent built-in feature.

**Thread pool**: MariaDB includes a thread pool in the community edition. MySQL's thread pool is an Enterprise-only feature.

### Compatibility

For most applications, MariaDB 10.x is a drop-in replacement for MySQL 5.7. The divergence widens with MySQL 8.0 features:

| Feature | MySQL 8.0 | MariaDB 10.x/11.x |
|---------|-----------|-------------------|
| Native JSON type | Yes | No (alias for LONGTEXT) |
| `caching_sha2_password` | Default | Not supported |
| CTEs (WITH clause) | Yes | Yes |
| Window functions | Yes | Yes |
| CHECK constraints | Yes (enforced) | Yes (enforced since 10.2) |
| Roles | Yes | Yes |
| Invisible columns | Yes (8.0.23+) | Yes (10.3+) |
| System versioning | No | Yes |
| `EXCEPT` / `INTERSECT` | Yes (8.0.31+) | Yes |
| Atomic DDL | Yes | Partial |

If you are starting a new project, choose one and stay with it. Migrating between MySQL and MariaDB becomes harder as you use features specific to either fork.

---

## Securing the Installation

A fresh MySQL installation ships with settings optimized for getting started, not for security. Before the server accepts any real data, run through these steps.

### `mysql_secure_installation`

MySQL ships with a script that handles the most critical initial hardening:

```bash
sudo mysql_secure_installation
```

The script walks through these prompts:

1. **Set/change the root password** - required on RHEL-based installs, recommended everywhere
2. **Remove anonymous users** - MySQL creates an anonymous user that can connect without authentication
3. **Disallow remote root login** - the root account should only connect from `localhost`
4. **Remove the test database** - a publicly accessible `test` database ships by default
5. **Reload privilege tables** - applies the changes immediately

Answer "yes" to all of these in any environment that isn't a throwaway development container.

```terminal
title: Running mysql_secure_installation
steps:
  - command: "sudo mysql_secure_installation"
    output: |
      Securing the MySQL server deployment.

      Connecting to MySQL using a blank password.

      VALIDATE PASSWORD COMPONENT can be used to test passwords
      and improve security. It checks the strength of password
      and allows the users to set only those passwords which are
      secure enough. Would you like to setup VALIDATE PASSWORD component?

      Press y|Y for Yes, any other key for No: y

      There are three levels of password validation policy:

      LOW    Length >= 8
      MEDIUM Length >= 8, numeric, mixed case, and special characters
      STRONG Length >= 8, numeric, mixed case, special characters and dictionary file

      Please enter 0 = LOW, 1 = MEDIUM, 2 = STRONG: 2
    narration: "The VALIDATE PASSWORD component enforces password complexity. The STRONG policy requires at least 8 characters with a mix of character types, checked against a dictionary file. For production, use MEDIUM or STRONG."
  - command: ""
    output: |
      Please set the password for root here.

      New password: ********
      Re-enter new password: ********

      Estimated strength of the password: 100
      Do you wish to continue with the password provided? y
    narration: "Choose a strong root password. This is the superuser account for the database - treat it with the same care as the system root password."
  - command: ""
    output: |
      By default, a MySQL installation has an anonymous user,
      allowing anyone to log into MySQL without having to have
      a user account created for them.

      Remove anonymous users? (Press y|Y for Yes) : y
      Success.

      Normally, root should only be allowed to connect from
      'localhost'.

      Disallow root login remotely? (Press y|Y for Yes) : y
      Success.

      By default, MySQL comes with a database named 'test' that
      anyone can access.

      Remove test database and access to it? (Press y|Y for Yes) : y
       - Dropping test database...
      Success.
       - Removing privileges on test database...
      Success.

      Reloading the privilege tables will ensure that all changes
      made so far will take effect immediately.

      Reload privilege tables now? (Press y|Y for Yes) : y
      Success.

      All done!
    narration: "Answer yes to every prompt. Anonymous users, remote root access, and the test database are all security liabilities. These changes take effect immediately after the privilege table reload."
```

### Additional Hardening

Beyond `mysql_secure_installation`, consider these configuration changes:

```ini
[mysqld]
# Disable LOAD DATA LOCAL INFILE (prevents reading server-side files via SQL)
local_infile = OFF

# Require secure transport for all connections (MySQL 8.0+)
require_secure_transport = ON

# Disable symbolic links (prevents symlinking data files to sensitive locations)
symbolic-links = 0

# Log all connection attempts
log_error_verbosity = 3
```

Create application-specific user accounts with minimal privileges instead of sharing the root account:

```sql
-- Create a user for your application
CREATE USER 'appuser'@'192.168.1.%' IDENTIFIED BY 'strong_password_here';

-- Grant only the privileges the application needs
GRANT SELECT, INSERT, UPDATE, DELETE ON appdb.* TO 'appuser'@'192.168.1.%';

-- Never grant ALL PRIVILEGES to application accounts
-- Never grant SUPER, FILE, or PROCESS to application accounts

FLUSH PRIVILEGES;
```

---

## Putting It All Together

You now have the pieces: a running MySQL installation, a configuration file tuned for your hardware, InnoDB as the storage engine with per-table tablespace and a properly sized buffer pool, utf8mb4 as the character set, and a secured installation with strong authentication.

The configuration choices in this guide are conservative defaults that work well for most workloads. As your data grows and your query patterns become clear, the [MySQL Performance & Optimization](mysql-performance.md) guide covers the tools and techniques for measuring what needs tuning and adjusting these settings based on real data rather than guesswork.

```exercise
title: "Configure MySQL for a New Application"
type: scenario
scenario: |
  You are setting up MySQL 8.0 on a dedicated server with 16 GB of RAM for a new web application.
  The application is a content management system that stores articles, user profiles, and media metadata.
  It handles approximately 500 concurrent users during peak traffic.
  Your tasks are to write the critical my.cnf settings, create the application database and user, and verify the configuration.
tasks:
  - task: "What value should you set for innodb_buffer_pool_size on this 16 GB server?"
    hint: "The general guideline is 50-70% of total RAM for a dedicated database server."
    answer: "8G to 11G (for example, innodb_buffer_pool_size = 10G). On a 16 GB server dedicated to MySQL, 50-70% gives you 8-11 GB. Leaving 5-8 GB for the OS, connection buffers, and other MySQL memory structures."
  - task: "Write the character set and collation settings for the [mysqld] section that ensure full Unicode support."
    hint: "MySQL's 'utf8' is not real UTF-8. You need the 4-byte variant."
    answer: "character_set_server = utf8mb4 and collation_server = utf8mb4_0900_ai_ci. This ensures every new database and table inherits proper Unicode support unless explicitly overridden."
  - task: "Write a CREATE USER and GRANT statement that gives the application the minimum privileges it needs for CRUD operations on a database called cmsdb."
    hint: "CRUD means Create, Read, Update, Delete - but in SQL those translate to specific privilege names."
    answer: "CREATE USER 'cmsapp'@'10.0.0.%' IDENTIFIED BY 'strong_password'; GRANT SELECT, INSERT, UPDATE, DELETE ON cmsdb.* TO 'cmsapp'@'10.0.0.%'; The host mask should match your application server subnet. Do not grant ALL PRIVILEGES or administrative privileges like SUPER, FILE, or PROCESS."
  - task: "What is the risk of setting innodb_flush_log_at_trx_commit = 0 instead of 1?"
    hint: "Think about what happens to committed transactions if the server crashes."
    answer: "With innodb_flush_log_at_trx_commit = 0, InnoDB flushes the log buffer to the redo log file approximately once per second, rather than at each transaction commit. If MySQL or the server crashes, you can lose up to one second of committed transactions. Setting 1 guarantees that every committed transaction is flushed to disk - full ACID durability."
```

---

## Further Reading

- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/) - the complete official documentation
- [InnoDB Storage Engine](https://dev.mysql.com/doc/refman/8.0/en/innodb-storage-engine.html) - architecture, buffer pool, redo log, and configuration
- [MySQL Server System Variables](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html) - every my.cnf option documented
- [MariaDB Knowledge Base](https://mariadb.com/kb/en/) - MariaDB-specific documentation and compatibility notes
- [Percona Blog: InnoDB Buffer Pool](https://www.percona.com/blog/tag/innodb-buffer-pool/) - practical tuning advice from the Percona team
- [MySQL Docker Official Image](https://hub.docker.com/_/mysql) - environment variables, initialization scripts, and volume configuration

---

**Previous:** [Database Design & Modeling](database-design.md) | **Next:** [MySQL Administration](mysql-administration.md) | [Back to Index](README.md)
