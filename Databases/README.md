# Databases

A comprehensive course on databases - from relational fundamentals and SQL through MySQL administration, PostgreSQL internals, NoSQL systems, and production operations. These guides take you from "I know I need a database" to understanding storage engines, query optimization, replication topologies, and recovery procedures well enough to architect, tune, and operate database systems in production.

Each guide is self-contained, but the order below follows a natural learning path. Basic Linux CLI familiarity is assumed throughout.

---

## Guides

<div class="topic-progression">
<h3>Foundations</h3>
<a class="topic-card" href="database-fundamentals.md" data-guide="database-fundamentals" data-topic="Databases">
<span class="topic-card__number">1</span>
<span class="topic-card__badge">Start Here</span>
<div class="topic-card__body">
<div class="topic-card__title">Database Fundamentals</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Core database concepts including the relational model, ACID properties, CAP theorem, and a decision framework for choosing between RDBMS and NoSQL systems.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="sql-essentials.md" data-guide="sql-essentials" data-topic="Databases">
<span class="topic-card__number">2</span>
<div class="topic-card__body">
<div class="topic-card__title">SQL Essentials</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">The standard language for relational databases. Covers DDL, DML, JOINs, aggregations, subqueries, and transaction control.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="database-design.md" data-guide="database-design" data-topic="Databases">
<span class="topic-card__number">3</span>
<div class="topic-card__body">
<div class="topic-card__title">Database Design &amp; Modeling</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Turning requirements into schema with ER diagrams, normalization through Boyce-Codd, index theory, and constraint enforcement.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>MySQL &amp; MariaDB</h3>
<a class="topic-card" href="mysql-installation-and-configuration.md" data-guide="mysql-installation-and-configuration" data-topic="Databases">
<span class="topic-card__number">4</span>
<div class="topic-card__body">
<div class="topic-card__title">MySQL Installation &amp; Configuration</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Installing MySQL, configuring my.cnf, choosing storage engines, sizing the buffer pool, and hardening for production.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="mysql-administration.md" data-guide="mysql-administration" data-topic="Databases">
<span class="topic-card__number">5</span>
<div class="topic-card__body">
<div class="topic-card__title">MySQL Administration</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Day-to-day MySQL management with the mysql CLI, user and privilege system, log types, and table maintenance.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="mysql-performance.md" data-guide="mysql-performance" data-topic="Databases">
<span class="topic-card__number">6</span>
<div class="topic-card__body">
<div class="topic-card__title">MySQL Performance &amp; Optimization</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Finding and fixing slow queries with EXPLAIN, index strategies, buffer pool tuning, and slow query log analysis.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="mysql-replication.md" data-guide="mysql-replication" data-topic="Databases">
<span class="topic-card__number">7</span>
<div class="topic-card__body">
<div class="topic-card__title">MySQL Replication &amp; High Availability</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Binary log replication, GTID topologies, Group Replication, InnoDB Cluster, and ProxySQL connection routing.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>PostgreSQL</h3>
<a class="topic-card" href="postgresql-fundamentals.md" data-guide="postgresql-fundamentals" data-topic="Databases">
<span class="topic-card__number">8</span>
<div class="topic-card__body">
<div class="topic-card__title">PostgreSQL Fundamentals</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Installation, psql CLI, postgresql.conf tuning, pg_hba.conf authentication, and MVCC snapshot isolation.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="postgresql-administration.md" data-guide="postgresql-administration" data-topic="Databases">
<span class="topic-card__number">9</span>
<div class="topic-card__body">
<div class="topic-card__title">PostgreSQL Administration</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Roles and privileges, VACUUM and autovacuum tuning, pg_stat monitoring views, extensions, and WAL management.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="postgresql-advanced.md" data-guide="postgresql-advanced" data-topic="Databases">
<span class="topic-card__number">10</span>
<div class="topic-card__body">
<div class="topic-card__title">PostgreSQL Advanced Features</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Recursive CTEs, window functions, JSONB with GIN indexing, table partitioning, full-text search, and PgBouncer.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>NoSQL</h3>
<a class="topic-card" href="nosql-concepts.md" data-guide="nosql-concepts" data-topic="Databases">
<span class="topic-card__number">11</span>
<div class="topic-card__body">
<div class="topic-card__title">NoSQL Concepts &amp; Architecture</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Document, key-value, wide-column, and graph databases. CAP theorem, consistency models, and polyglot persistence.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="mongodb.md" data-guide="mongodb" data-topic="Databases">
<span class="topic-card__number">12</span>
<div class="topic-card__body">
<div class="topic-card__title">MongoDB</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">The document model, CRUD operations, aggregation pipelines, indexing, replica sets, and sharding fundamentals.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="redis.md" data-guide="redis" data-topic="Databases">
<span class="topic-card__number">13</span>
<div class="topic-card__body">
<div class="topic-card__title">Redis</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">In-memory data structures, caching patterns, pub/sub, Lua scripting, persistence with RDB and AOF, and Sentinel/Cluster.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>Operations</h3>
<a class="topic-card" href="backup-and-recovery.md" data-guide="backup-and-recovery" data-topic="Databases">
<span class="topic-card__number">14</span>
<div class="topic-card__body">
<div class="topic-card__title">Backup &amp; Recovery Strategies</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Logical vs physical backups, mysqldump, pg_dump, Percona XtraBackup, and point-in-time recovery.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="database-security.md" data-guide="database-security" data-topic="Databases">
<span class="topic-card__number">15</span>
<div class="topic-card__body">
<div class="topic-card__title">Database Security</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Authentication methods, TLS/SSL configuration, SQL injection prevention, audit logging, and privilege hardening.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="scaling-and-architecture.md" data-guide="scaling-and-architecture" data-topic="Databases">
<span class="topic-card__number">16</span>
<div class="topic-card__body">
<div class="topic-card__title">Scaling &amp; Architecture Patterns</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Read replicas, connection pooling, sharding strategies, and microservices data patterns including CQRS.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="innodb-recovery-pdrt.md" data-guide="innodb-recovery-pdrt" data-topic="Databases">
<span class="topic-card__number">17</span>
<div class="topic-card__body">
<div class="topic-card__title">InnoDB Recovery with PDRT</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Last-resort data recovery using the Percona Data Recovery Tool, InnoDB file architecture, and first-response triage.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
</div>
