# Databases

A comprehensive course on databases - from relational fundamentals and SQL through MySQL administration, PostgreSQL internals, NoSQL systems, and production operations. These guides take you from "I know I need a database" to understanding storage engines, query optimization, replication topologies, and recovery procedures well enough to architect, tune, and operate database systems in production.

Each guide is self-contained, but the order below follows a natural learning path. Basic Linux CLI familiarity is assumed throughout.

---

## Foundations

### [Database Fundamentals](database-fundamentals.md)

The history of data management from flat files through hierarchical and network models to the relational revolution and the NoSQL movement. Covers the relational model, ACID properties, CAP theorem, storage engine basics, and a decision framework for choosing between RDBMS and NoSQL systems.

### [SQL Essentials](sql-essentials.md)

The language every relational database speaks. Covers DDL for defining schema, DML for manipulating data, all JOIN types with visual explanations, subqueries, aggregations with GROUP BY and HAVING, transaction control, and the functions you will use daily.

### [Database Design & Modeling](database-design.md)

Turning requirements into schema. Covers entity-relationship diagrams, normalization from first normal form through Boyce-Codd, denormalization trade-offs for read performance, index theory covering B-tree and hash structures, data type selection, and constraint enforcement with primary keys, foreign keys, unique, and check constraints.

---

## MySQL & MariaDB

### [MySQL Installation & Configuration](mysql-installation-and-configuration.md)

Getting MySQL running and configured correctly. Covers installation via package managers and Docker, the `my.cnf` file structure with section precedence, InnoDB versus MyISAM storage engines, buffer pool sizing, character sets and collations, and where MariaDB diverges from MySQL.

### [MySQL Administration](mysql-administration.md)

Day-to-day MySQL management. Covers the `mysql` CLI, the user and privilege system including roles in MySQL 8.0+, log types from error through binary logs, table maintenance with `mysqlcheck` and `OPTIMIZE TABLE`, the `information_schema`, and routine operational tasks.

### [MySQL Performance & Optimization](mysql-performance.md)

Finding and fixing slow queries. Covers `EXPLAIN` and `EXPLAIN ANALYZE` output interpretation, index strategies including covering and composite indexes, buffer pool tuning, query profiling, slow query log analysis, `pt-query-digest`, optimizer hints, and common anti-patterns that kill performance.

### [MySQL Replication & High Availability](mysql-replication.md)

Scaling reads and surviving failures. Covers binary log replication, GTID mode, semi-synchronous replication, Group Replication, InnoDB Cluster, ProxySQL for connection routing, failover patterns, and monitoring replication lag.

---

## PostgreSQL

### [PostgreSQL Fundamentals](postgresql-fundamentals.md)

Getting started with PostgreSQL. Covers installation and `initdb`, the `psql` CLI with meta-commands and `.psqlrc` customization, `postgresql.conf` tuning, `pg_hba.conf` authentication methods, the schema/database hierarchy, system catalogs, and `pg_catalog` internals.

### [PostgreSQL Administration](postgresql-administration.md)

Running PostgreSQL in production. Covers roles and privileges including row-level security, tablespace management, VACUUM and ANALYZE with autovacuum tuning, `pg_stat_*` monitoring views, essential extensions like `pg_stat_statements` and `pgcrypto`, and WAL management for crash recovery.

### [PostgreSQL Advanced Features](postgresql-advanced.md)

PostgreSQL capabilities beyond standard SQL. Covers recursive CTEs, window functions, JSONB operators with GIN indexing, table partitioning strategies, full-text search with `tsvector` and `tsquery`, connection pooling with PgBouncer, and foreign data wrappers for querying external sources.

---

## NoSQL

### [NoSQL Concepts & Architecture](nosql-concepts.md)

Understanding when and why to go beyond relational. Covers document stores, key-value stores, wide-column stores, and graph databases, with a deep dive into CAP theorem trade-offs, consistency models from eventual through strong, polyglot persistence patterns, and a practical decision framework.

### [MongoDB](mongodb.md)

The dominant document database. Covers the document model and BSON types, CRUD operations, the aggregation pipeline with stages and operators, index types including compound, text, and geospatial, replica sets for availability, sharding fundamentals, and the `mongosh` CLI.

### [Redis](redis.md)

In-memory data structures for speed. Covers strings, hashes, lists, sets, sorted sets, and streams, caching patterns including cache-aside and write-through, TTL and eviction policies, pub/sub messaging, Lua scripting for atomic operations, persistence with RDB and AOF, and Sentinel and Cluster for high availability.

---

## Operations

### [Backup & Recovery Strategies](backup-and-recovery.md)

Protecting data against loss. Covers logical versus physical backups, `mysqldump` and `mydumper` for MySQL, `pg_dump` and `pg_basebackup` for PostgreSQL, Percona XtraBackup for hot InnoDB backups, point-in-time recovery with WAL and binary logs, backup verification, scheduling, and retention policies.

### [Database Security](database-security.md)

Hardening databases against threats. Covers authentication methods from passwords through Kerberos, TLS/SSL configuration, encryption at rest with transparent data encryption, SQL injection prevention with parameterized queries, audit logging, privilege hardening principles, and the OWASP database security guidelines.

### [Scaling & Architecture Patterns](scaling-and-architecture.md)

Growing beyond a single server. Covers read replicas, connection pooling with ProxySQL and PgBouncer, horizontal versus vertical scaling trade-offs, sharding strategies, microservices data patterns including database-per-service, CQRS, and an overview of event sourcing.

### [InnoDB Recovery with PDRT](innodb-recovery-pdrt.md)

The last-resort recovery guide. Covers the Percona Data Recovery Tool workflow including `constraints_parser` and `page_parser`, InnoDB file architecture with `ibdata1` and per-table `.ibd` files, first-response triage procedures, manual recovery with custom table definitions, and the cPanel/WHM operational context.
