# Database Security

A database is only as secure as its weakest access path. Misconfigurations, default credentials, unencrypted connections, and injectable queries have been behind the majority of data breaches for decades. This guide covers the full security surface of production database systems - authentication, encryption, injection prevention, auditing, and privilege hardening - across both MySQL and PostgreSQL.

---

## Authentication Methods

<div class="diagram-container"><img src="../../assets/images/databases/security-layers.svg" alt="Database security layers showing network, authentication, authorization, and encryption as defense in depth"></div>

**Authentication** is the first gate. Every connection to your database must prove identity before it can do anything. Different methods vary in strength, complexity, and operational overhead.

### Password-Based Authentication

The most common method. Both MySQL and PostgreSQL support multiple password hashing plugins:

| Plugin/Method | Database | Notes |
|---------------|----------|-------|
| `mysql_native_password` | MySQL | SHA-1 based, legacy default pre-8.0 |
| `caching_sha2_password` | MySQL | SHA-256 based, default in MySQL 8.0+ |
| `scram-sha-256` | PostgreSQL | Salted challenge-response, default in PG 14+ |
| `md5` | PostgreSQL | Legacy, still common but weaker |

**MySQL** password plugin configuration:

```sql
-- Create a user with a specific auth plugin (MySQL 8.0+)
CREATE USER 'app_user'@'10.0.0.%'
  IDENTIFIED WITH caching_sha2_password BY 'strong_random_passphrase';

-- Check which plugin a user is using
SELECT user, host, plugin FROM mysql.user WHERE user = 'app_user';

-- Change an existing user's plugin
ALTER USER 'legacy_user'@'%'
  IDENTIFIED WITH caching_sha2_password BY 'new_passphrase';
```

**PostgreSQL** password method configuration in `pg_hba.conf`:

```
# TYPE  DATABASE  USER       ADDRESS         METHOD
host    all       app_user   10.0.0.0/24     scram-sha-256
host    all       all        127.0.0.1/32    scram-sha-256
```

Set the default in `postgresql.conf`:

```
password_encryption = scram-sha-256
```

!!! danger "Avoid md5 and mysql_native_password in new deployments"
    Both use weak hashing algorithms. `mysql_native_password` stores SHA-1 hashes that are vulnerable to rainbow table attacks. PostgreSQL's `md5` method is similarly outdated. Use `caching_sha2_password` for MySQL and `scram-sha-256` for PostgreSQL.

### Certificate-Based Authentication (x509)

Instead of passwords, clients present a TLS certificate signed by a trusted Certificate Authority. The database verifies the certificate chain.

**MySQL x509 authentication:**

```sql
-- Require a valid client certificate
CREATE USER 'secure_user'@'%'
  IDENTIFIED WITH caching_sha2_password BY 'passphrase'
  REQUIRE X509;

-- Require a specific certificate subject
CREATE USER 'strict_user'@'%'
  REQUIRE SUBJECT '/CN=app-server/O=MyCompany';
```

**PostgreSQL certificate authentication** in `pg_hba.conf`:

```
# Client must present a valid certificate signed by the server's root CA
hostssl   all   cert_user   10.0.0.0/24   cert   clientcert=verify-full
```

### LDAP Integration

**LDAP authentication** delegates credential verification to a directory service like Active Directory or OpenLDAP. Users authenticate with their corporate credentials.

**MySQL LDAP plugin:**

```sql
-- Install the LDAP plugin (MySQL Enterprise)
INSTALL PLUGIN authentication_ldap_simple
  SONAME 'authentication_ldap_simple.so';

-- Create a user that authenticates against LDAP
CREATE USER 'ldap_user'@'%'
  IDENTIFIED WITH authentication_ldap_simple;
```

**PostgreSQL LDAP** in `pg_hba.conf`:

```
host  all  all  10.0.0.0/24  ldap
  ldapserver=ldap.company.com
  ldapbasedn="ou=People,dc=company,dc=com"
  ldapsearchattribute=uid
```

### Kerberos/GSSAPI and PAM

For enterprise environments with existing Kerberos infrastructure:

- **Kerberos/GSSAPI**: Both MySQL (with the `authentication_kerberos` plugin) and PostgreSQL (via the `gss` method in `pg_hba.conf`) support Kerberos tickets for single sign-on
- **PAM** (Pluggable Authentication Modules): Delegates authentication to the operating system's PAM stack, which can chain multiple authentication backends - LDAP, Kerberos, local files, MFA tokens

PostgreSQL PAM configuration:

```
host  all  all  10.0.0.0/24  pam  pamservice=postgresql
```

The corresponding PAM service file (`/etc/pam.d/postgresql`) defines the actual authentication chain.

```quiz
question: "Your company uses Active Directory for all employee credentials. Which authentication method avoids creating separate database passwords?"
type: multiple-choice
options:
  - text: "LDAP authentication - it delegates credential checks to the directory service"
    correct: true
    feedback: "Correct! LDAP authentication forwards the username and password to your directory service (Active Directory, OpenLDAP) for verification. Users log in with their existing corporate credentials. No separate database passwords to manage, rotate, or forget."
  - text: "caching_sha2_password - it caches credentials from Active Directory"
    correct: false
    feedback: "caching_sha2_password is a password hashing plugin, not an external authentication method. The 'caching' refers to caching the SHA-256 hash computation, not credentials from another system. Users still need a separate database password."
  - text: "x509 certificates - they are issued by Active Directory"
    correct: false
    feedback: "While Active Directory Certificate Services can issue x509 certificates, certificate-based authentication is a separate mechanism from AD password authentication. It requires deploying certificates to every client, which is a different operational model than password-based SSO."
  - text: "scram-sha-256 - SCRAM stands for Salted Challenge Response Active-directory Mechanism"
    correct: false
    feedback: "SCRAM stands for Salted Challenge Response Authentication Mechanism. It is a self-contained password-based protocol that has no connection to Active Directory. Database passwords are stored and verified locally."
```

---

## TLS/SSL Configuration

Authentication proves identity, but without encryption the credentials (and all subsequent data) travel in plaintext. **TLS** (Transport Layer Security, the successor to SSL) encrypts the connection between client and server.

### Generating Certificates

For production, use certificates from your organization's internal CA or a public CA. For testing, self-signed certificates work:

```bash
# Generate a CA key and certificate
openssl genrsa 4096 > ca-key.pem
openssl req -new -x509 -nodes -days 3650 \
  -key ca-key.pem -out ca-cert.pem \
  -subj "/CN=MySQL-CA/O=MyCompany"

# Generate the server key and certificate signing request
openssl genrsa 4096 > server-key.pem
openssl req -new -key server-key.pem -out server-req.pem \
  -subj "/CN=db-server.company.com"

# Sign the server certificate with the CA
openssl x509 -req -in server-req.pem -days 3650 \
  -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \
  -out server-cert.pem

# Generate client key and certificate (for x509 auth)
openssl genrsa 4096 > client-key.pem
openssl req -new -key client-key.pem -out client-req.pem \
  -subj "/CN=app-server/O=MyCompany"
openssl x509 -req -in client-req.pem -days 3650 \
  -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \
  -out client-cert.pem
```

### MySQL TLS Configuration

In `my.cnf` (or `my.ini` on Windows):

```ini
[mysqld]
# Require all connections to use TLS
require_secure_transport = ON

# Certificate paths
ssl-ca   = /etc/mysql/ssl/ca-cert.pem
ssl-cert = /etc/mysql/ssl/server-cert.pem
ssl-key  = /etc/mysql/ssl/server-key.pem

# Minimum TLS version
tls_version = TLSv1.2,TLSv1.3
```

Verify the server's TLS status:

```sql
SHOW VARIABLES LIKE '%ssl%';
-- ssl_ca, ssl_cert, ssl_key should show your paths

SHOW STATUS LIKE 'Ssl_cipher';
-- Should show a cipher name like TLS_AES_256_GCM_SHA384
```

### PostgreSQL TLS Configuration

In `postgresql.conf`:

```
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server-cert.pem'
ssl_key_file  = '/etc/postgresql/ssl/server-key.pem'
ssl_ca_file   = '/etc/postgresql/ssl/ca-cert.pem'
ssl_min_protocol_version = 'TLSv1.2'
```

In `pg_hba.conf`, use `hostssl` instead of `host` to require TLS:

```
# Reject non-TLS connections from the network
hostssl   all   all   10.0.0.0/24   scram-sha-256
hostnossl all   all   10.0.0.0/24   reject
```

### Verifying Encrypted Connections

**MySQL client verification:**

```sql
-- Check your current connection
SHOW STATUS LIKE 'Ssl_cipher';
-- Non-empty = encrypted

SELECT * FROM performance_schema.session_status
WHERE variable_name = 'Ssl_version';
```

**PostgreSQL client verification:**

```sql
-- In psql
\conninfo
-- Should show "SSL connection (protocol: TLSv1.3, cipher: ...)"

SELECT ssl, version, cipher FROM pg_stat_ssl
WHERE pid = pg_backend_pid();
```

```terminal
title: Configuring and Verifying MySQL TLS
steps:
  - command: "ls /etc/mysql/ssl/"
    output: |
      ca-cert.pem   ca-key.pem   server-cert.pem   server-key.pem
    narration: "Confirm the certificate files are in place. In production, these come from your organization's CA. The server needs the CA cert, server cert, and server key."
  - command: "sudo cat /etc/mysql/my.cnf | grep -A6 '\\[mysqld\\]'"
    output: |
      [mysqld]
      require_secure_transport = ON
      ssl-ca   = /etc/mysql/ssl/ca-cert.pem
      ssl-cert = /etc/mysql/ssl/server-cert.pem
      ssl-key  = /etc/mysql/ssl/server-key.pem
      tls_version = TLSv1.2,TLSv1.3
    narration: "The mysqld section enables require_secure_transport, which rejects any unencrypted connection attempt. tls_version restricts to TLS 1.2 and 1.3 only."
  - command: "sudo systemctl restart mysql"
    output: ""
    narration: "Restart MySQL to apply the TLS configuration changes."
  - command: "mysql -u root -p -e \"SHOW VARIABLES LIKE 'require_secure_transport';\""
    output: |
      +---------------------------+-------+
      | Variable_name             | Value |
      +---------------------------+-------+
      | require_secure_transport  | ON    |
      +---------------------------+-------+
    narration: "Verify that require_secure_transport is enabled. Any connection attempt without TLS will be rejected."
  - command: "mysql -u root -p -e \"SHOW STATUS LIKE 'Ssl_cipher';\""
    output: |
      +---------------+------------------------+
      | Variable_name | Value                  |
      +---------------+------------------------+
      | Ssl_cipher    | TLS_AES_256_GCM_SHA384 |
      +---------------+------------------------+
    narration: "A non-empty Ssl_cipher confirms the current connection is encrypted. TLS_AES_256_GCM_SHA384 is a strong cipher suite from TLS 1.3."
  - command: "mysql -u app_user -p --ssl-mode=DISABLED -h 10.0.0.5 2>&1"
    output: |
      ERROR 3159 (HY000): Connections using insecure transport are prohibited
      while --require_secure_transport=ON.
    narration: "Attempting to connect without TLS is rejected immediately. This proves the server enforces encryption for all connections."
```

```quiz
question: "In PostgreSQL, what is the difference between 'host' and 'hostssl' entries in pg_hba.conf?"
type: multiple-choice
options:
  - text: "'host' matches TCP/IP connections regardless of TLS; 'hostssl' matches only TLS-encrypted connections"
    correct: true
    feedback: "Correct! 'host' matches any TCP/IP connection, whether encrypted or not. 'hostssl' matches only connections that use TLS. To enforce encryption, use 'hostssl' for allowed connections and 'hostnossl ... reject' to explicitly deny unencrypted ones."
  - text: "'host' is for local connections; 'hostssl' is for remote connections"
    correct: false
    feedback: "Both 'host' and 'hostssl' are for TCP/IP (network) connections. Local Unix socket connections use the 'local' type. The distinction is about encryption, not network location."
  - text: "'hostssl' enables TLS on the server; 'host' disables it"
    correct: false
    feedback: "pg_hba.conf controls authentication rules, not server-level TLS settings. TLS is enabled in postgresql.conf with ssl = on. The pg_hba.conf entries then filter which connections require TLS."
  - text: "They are aliases - both require TLS when ssl = on in postgresql.conf"
    correct: false
    feedback: "They are not aliases. Even with ssl = on, a 'host' entry allows both encrypted and unencrypted connections. Only 'hostssl' enforces that the connection must be encrypted."
```

---

## Encryption at Rest

TLS protects data in transit. **Encryption at rest** protects data stored on disk - against stolen drives, unauthorized filesystem access, or compromised backups.

### Transparent Data Encryption (TDE)

**TDE** encrypts data files at the storage engine level. The database handles encryption and decryption transparently - applications need no changes.

**MySQL Enterprise TDE** (InnoDB tablespace encryption):

```sql
-- Install the keyring plugin (required for TDE)
-- In my.cnf:
-- early-plugin-load = keyring_file.so
-- keyring_file_data = /var/lib/mysql-keyring/keyring

-- Encrypt a tablespace
ALTER TABLE customers ENCRYPTION = 'Y';

-- Encrypt the system tablespace
ALTER TABLESPACE mysql.innodb_system ENCRYPTION = 'Y';

-- Verify encryption status
SELECT name, encryption
FROM information_schema.innodb_tablespaces
WHERE encryption = 'Y';
```

!!! warning "Key management is the hard part"
    TDE is only as secure as the encryption keys. Storing the keyring file on the same disk as the database defeats the purpose - a stolen disk includes both the encrypted data and the key. Use a dedicated **Key Management Service** (KMS) like HashiCorp Vault, AWS KMS, or Azure Key Vault in production.

### Column-Level Encryption with pgcrypto

PostgreSQL does not have built-in TDE in the community edition, but the [**pgcrypto**](https://www.postgresql.org/docs/current/pgcrypto.html) extension provides column-level encryption:

```sql
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive columns using symmetric encryption (AES-256)
INSERT INTO customers (name, ssn_encrypted)
VALUES (
  'Jane Smith',
  pgp_sym_encrypt('123-45-6789', 'encryption-key-from-app')
);

-- Decrypt when reading
SELECT name, pgp_sym_decrypt(ssn_encrypted, 'encryption-key-from-app') AS ssn
FROM customers
WHERE id = 42;
```

The encryption key should come from the application or a KMS - never hardcode it in SQL or store it in the database.

### Filesystem-Level Encryption

An alternative to database-level encryption is encrypting the entire filesystem or block device:

- **LUKS/dm-crypt** (Linux): Encrypts block devices. The database writes normally; the kernel encrypts and decrypts transparently
- **BitLocker** (Windows): Full-disk encryption for Windows Server
- **AWS EBS Encryption** / **Azure Disk Encryption**: Cloud provider managed encryption for virtual disks

```bash
# Example: LUKS encryption for a database volume
sudo cryptsetup luksFormat /dev/sdb1
sudo cryptsetup luksOpen /dev/sdb1 db_encrypted
sudo mkfs.ext4 /dev/mapper/db_encrypted
sudo mount /dev/mapper/db_encrypted /var/lib/mysql
```

Filesystem encryption protects against physical theft but not against a compromised OS or database process - if the system is running, the filesystem is mounted and decrypted.

---

## SQL Injection Prevention

**SQL injection** remains the most exploited database vulnerability year after year. It occurs when user input is concatenated directly into SQL strings, allowing an attacker to modify the query's logic.

### The Problem: String Concatenation

```python
# VULNERABLE - never do this
username = request.form['username']
query = "SELECT * FROM users WHERE username = '" + username + "'"
cursor.execute(query)
# If username = "admin' OR '1'='1" the query becomes:
# SELECT * FROM users WHERE username = 'admin' OR '1'='1'
# This returns ALL users
```

### The Solution: Parameterized Queries

**Parameterized queries** (also called prepared statements) separate the SQL structure from the data. The database engine treats parameters as literal values, never as SQL syntax.

```code-walkthrough
title: "Parameterized Queries: Safe vs Unsafe Patterns"
description: Side-by-side comparison of injectable and safe query patterns across Python, JavaScript, and Java.
code: |
  # ---- Python (mysql-connector / psycopg2) ----

  # UNSAFE - string concatenation
  query = "SELECT * FROM users WHERE email = '" + email + "'"
  cursor.execute(query)

  # SAFE - parameterized query
  query = "SELECT * FROM users WHERE email = %s"
  cursor.execute(query, (email,))

  # ---- JavaScript / Node.js (mysql2) ----

  // UNSAFE - template literal interpolation
  const query = `SELECT * FROM orders WHERE user_id = ${userId}`;
  connection.query(query);

  // SAFE - placeholder parameter
  const query = "SELECT * FROM orders WHERE user_id = ?";
  connection.execute(query, [userId]);

  # ---- Java (JDBC) ----

  // UNSAFE - string concatenation
  String query = "SELECT * FROM products WHERE name = '" + name + "'";
  Statement stmt = conn.createStatement();
  ResultSet rs = stmt.executeQuery(query);

  // SAFE - PreparedStatement
  String query = "SELECT * FROM products WHERE name = ?";
  PreparedStatement pstmt = conn.prepareStatement(query);
  pstmt.setString(1, name);
  ResultSet rs = pstmt.executeQuery();
language: python
annotations:
  - line: 4
    text: "VULNERABLE. The email variable is spliced directly into the SQL string. An attacker can terminate the string and inject arbitrary SQL: ' OR 1=1; DROP TABLE users; --"
  - line: 8
    text: "SAFE. The %s placeholder is not string formatting - the database driver sends the query structure and the parameter value separately. The database engine never parses the parameter as SQL."
  - line: 14
    text: "VULNERABLE. JavaScript template literals make this look clean, but the userId value is still interpolated into the SQL string. An input like '1 OR 1=1' changes the query logic."
  - line: 18
    text: "SAFE. The ? placeholder tells mysql2 to send this as a parameterized query. The userId value is bound separately and treated as a literal value by the database."
  - line: 24
    text: "VULNERABLE. Java's Statement.executeQuery sends the entire concatenated string to the database. The name variable can contain SQL that alters the query."
  - line: 29
    text: "SAFE. PreparedStatement separates the query template from parameters. pstmt.setString(1, name) binds the first parameter as a string literal, regardless of its content."
```

### Stored Procedures as a Defense Layer

Stored procedures provide an additional layer of protection by encapsulating SQL logic on the server:

```sql
-- MySQL stored procedure
DELIMITER //
CREATE PROCEDURE get_user_by_email(IN p_email VARCHAR(255))
BEGIN
  SELECT id, username, email, created_at
  FROM users
  WHERE email = p_email;
END //
DELIMITER ;

-- Call from application
CALL get_user_by_email('user@example.com');
```

The application only calls the procedure with parameters - it never constructs raw SQL. The procedure controls exactly which columns are returned and which tables are accessed.

### Input Validation

Parameterized queries are the primary defense. Input validation is a secondary layer:

- **Allowlist validation**: If a field should be an integer, cast it to an integer before use
- **Length limits**: Reject inputs exceeding expected lengths
- **Character restrictions**: Email fields should match email patterns
- **Reject known attack patterns**: While not sufficient alone, blocking inputs containing `'; --` or `UNION SELECT` adds depth

### ORM Safety

Object-Relational Mappers (ORMs) like SQLAlchemy, Django ORM, Sequelize, and Hibernate use parameterized queries internally. They are generally safe, but watch for escape hatches:

```python
# Django ORM - safe by default
User.objects.filter(email=user_email)

# Django raw query - safe if parameterized
User.objects.raw("SELECT * FROM users WHERE email = %s", [user_email])

# Django raw query - UNSAFE if concatenated
User.objects.raw("SELECT * FROM users WHERE email = '" + user_email + "'")
```

!!! danger "ORMs don't make you immune"
    Every ORM provides a way to execute raw SQL. When you use it, you are responsible for parameterization. Code review should flag any raw SQL that concatenates user input.

---

## Audit Logging

You cannot protect what you cannot observe. **Audit logging** records who did what, when, and from where - essential for compliance (PCI DSS, HIPAA, SOX), incident investigation, and detecting unauthorized access.

### MySQL Enterprise Audit

The [**MySQL Enterprise Audit**](https://dev.mysql.com/doc/refman/8.0/en/audit-log.html) plugin provides comprehensive logging:

```sql
-- Install the audit plugin
INSTALL PLUGIN audit_log SONAME 'audit_log.so';

-- Configure in my.cnf
-- [mysqld]
-- audit-log-format = JSON
-- audit-log-policy = ALL
-- audit-log-file = /var/log/mysql/audit.log
```

For the community edition, the general query log provides basic auditing:

```ini
[mysqld]
general_log = ON
general_log_file = /var/log/mysql/general.log
```

!!! warning "Performance impact of general_log"
    The general query log records every single query and causes significant I/O overhead. Use it for short-term debugging or auditing, not as a permanent audit solution on high-traffic systems. The Enterprise Audit plugin has filtering capabilities that reduce overhead.

### PostgreSQL pgAudit

[**pgAudit**](https://www.pgaudit.org/) is the standard auditing extension for PostgreSQL:

```sql
-- Enable in postgresql.conf:
-- shared_preload_libraries = 'pgaudit'
-- pgaudit.log = 'ddl, role, write'

-- Per-database override
ALTER DATABASE production SET pgaudit.log = 'all';

-- Per-role override (audit everything the admin role does)
ALTER ROLE dba SET pgaudit.log = 'all';
```

pgAudit log classes:

| Class | What it logs |
|-------|-------------|
| `read` | SELECT, COPY FROM |
| `write` | INSERT, UPDATE, DELETE, TRUNCATE |
| `function` | Function calls |
| `role` | GRANT, REVOKE, CREATE/ALTER/DROP ROLE |
| `ddl` | CREATE, ALTER, DROP (tables, indexes, etc.) |
| `misc` | DISCARD, FETCH, CHECKPOINT |
| `all` | Everything above |

### What to Log

At minimum, audit these events:

- **Authentication events**: Successful and failed login attempts (track brute-force patterns)
- **DDL changes**: Schema modifications (CREATE, ALTER, DROP) - who changed the table structure?
- **DML on sensitive tables**: INSERT, UPDATE, DELETE on tables containing PII, financial data, or credentials
- **Privilege changes**: GRANT, REVOKE, CREATE ROLE, ALTER USER
- **Administrative actions**: Configuration changes, backup operations, replication setup

### Log Management

Raw audit logs are useless if nobody reviews them:

- **Centralize**: Ship logs to a SIEM (Splunk, Elasticsearch, Datadog) for search and alerting
- **Protect**: Audit logs should be write-only for the database process, stored on separate storage, and backed up independently
- **Retain**: Define retention policies based on compliance requirements (PCI DSS requires 1 year, HIPAA requires 6 years)
- **Alert**: Set up automated alerts for suspicious patterns - failed login spikes, after-hours DDL, mass data exports

```quiz
question: "You need to audit all schema changes and privilege modifications in PostgreSQL, but you want to minimize performance impact. Which pgaudit.log setting is most appropriate?"
type: multiple-choice
options:
  - text: "pgaudit.log = 'ddl, role'"
    correct: true
    feedback: "Correct! The 'ddl' class captures CREATE, ALTER, and DROP statements (schema changes), and 'role' captures GRANT, REVOKE, and role modifications. These are relatively infrequent operations, so the performance impact is minimal while still capturing the most security-critical changes."
  - text: "pgaudit.log = 'all'"
    correct: false
    feedback: "Logging everything includes every SELECT, INSERT, UPDATE, and DELETE. On a busy system, this generates massive log volume and measurable I/O overhead. Reserve 'all' for specific roles or databases where full auditing is required by regulation."
  - text: "pgaudit.log = 'write'"
    correct: false
    feedback: "The 'write' class captures INSERT, UPDATE, DELETE, and TRUNCATE - data modification. This misses DDL (schema changes) and role/privilege changes, which were the stated requirements."
  - text: "pgaudit.log = 'misc'"
    correct: false
    feedback: "The 'misc' class captures DISCARD, FETCH, CHECKPOINT, and similar operational commands. It does not include DDL or role changes."
```

---

## Privilege Hardening

Even authenticated users should only have access to what they need. **Privilege hardening** applies the principle of least privilege: every account gets the minimum permissions required for its function.

### Separate Accounts by Function

Never use a single account for everything. Create purpose-specific accounts:

| Account | Purpose | Typical Privileges |
|---------|---------|-------------------|
| `app_read` | Application read queries | SELECT on specific tables |
| `app_write` | Application write operations | SELECT, INSERT, UPDATE, DELETE on specific tables |
| `admin` | DBA administration | Full privileges (used interactively, never by applications) |
| `backup_user` | Backup operations | SELECT, LOCK TABLES, SHOW VIEW, RELOAD, REPLICATION CLIENT |
| `monitor_user` | Monitoring/metrics | SELECT on `performance_schema`, `information_schema` |
| `migration_user` | Schema migrations | CREATE, ALTER, DROP, INDEX on application database |

### MySQL Privilege Hardening

```sql
-- Create a read-only application account
CREATE USER 'app_read'@'10.0.0.%'
  IDENTIFIED WITH caching_sha2_password BY 'read_passphrase';
GRANT SELECT ON myapp.* TO 'app_read'@'10.0.0.%';

-- Create a write account with limited DML
CREATE USER 'app_write'@'10.0.0.%'
  IDENTIFIED WITH caching_sha2_password BY 'write_passphrase';
GRANT SELECT, INSERT, UPDATE, DELETE ON myapp.* TO 'app_write'@'10.0.0.%';

-- Monitoring account
CREATE USER 'monitor'@'10.0.0.%'
  IDENTIFIED WITH caching_sha2_password BY 'monitor_passphrase';
GRANT SELECT ON performance_schema.* TO 'monitor'@'10.0.0.%';
GRANT PROCESS ON *.* TO 'monitor'@'10.0.0.%';

-- Review existing privileges - look for overly broad grants
SELECT grantee, privilege_type, table_schema
FROM information_schema.schema_privileges
ORDER BY grantee;
```

### PostgreSQL Privilege Hardening

```sql
-- Revoke default public schema access (critical in PostgreSQL)
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Grant schema usage explicitly
GRANT USAGE ON SCHEMA public TO app_read;
GRANT USAGE ON SCHEMA public TO app_write;

-- Read-only role
CREATE ROLE app_read LOGIN PASSWORD 'read_passphrase';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO app_read;

-- Write role
CREATE ROLE app_write LOGIN PASSWORD 'write_passphrase';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_write;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_write;
```

!!! tip "ALTER DEFAULT PRIVILEGES matters"
    `GRANT SELECT ON ALL TABLES` only applies to tables that exist right now. When new tables are created later, the role will not have access. `ALTER DEFAULT PRIVILEGES` sets the permissions that future tables inherit automatically.

### Avoiding GRANT ALL

`GRANT ALL PRIVILEGES` gives everything - SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, and more. For application accounts, this is almost always too broad:

```sql
-- WRONG - application doesn't need DROP, ALTER, CREATE
GRANT ALL PRIVILEGES ON myapp.* TO 'app_user'@'%';

-- RIGHT - only what the application actually uses
GRANT SELECT, INSERT, UPDATE, DELETE ON myapp.* TO 'app_user'@'%';
```

If an application account is compromised, `GRANT ALL` means the attacker can drop tables, alter schema, and read data from every table. Scoped grants limit the blast radius.

### Network-Level Restrictions

Database ports should never be exposed to the public internet:

```bash
# MySQL - bind only to internal interface (my.cnf)
# bind-address = 10.0.0.5

# PostgreSQL - listen only on internal interface (postgresql.conf)
# listen_addresses = '10.0.0.5'

# Firewall rules (iptables example)
iptables -A INPUT -p tcp --dport 3306 -s 10.0.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 3306 -j DROP

iptables -A INPUT -p tcp --dport 5432 -s 10.0.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP
```

Combine network restrictions with MySQL's host-based user system (`'user'@'10.0.0.%'`) and PostgreSQL's `pg_hba.conf` address matching for defense in depth.

---

## OWASP Database Security

The [**OWASP**](https://owasp.org/) (Open Worldwide Application Security Project) identifies recurring patterns in database breaches. These are the risks that consistently appear in real-world incidents:

### Top Database Security Risks

**1. SQL Injection** - The most exploited vulnerability. Parameterized queries eliminate it entirely, yet it persists because legacy code, raw query escape hatches, and dynamic SQL construction remain common.

**2. Excessive Privileges** - Application accounts with DBA-level access. When the application is compromised, the attacker inherits every privilege the account has. The principle of least privilege directly counters this.

**3. Unpatched Databases** - Known vulnerabilities with published CVEs remain exploitable until patched. Establish a patching cadence: critical CVEs within 72 hours, regular patches monthly.

**4. Default Credentials** - MySQL historically created accounts with no password. PostgreSQL's `trust` authentication in `pg_hba.conf` allows passwordless connections. Every default credential must be changed or removed before production deployment.

**5. Exposed Backups** - Database dumps stored in world-readable locations, uploaded to unsecured S3 buckets, or left in web-accessible directories. Encrypt backups and restrict access.

**6. Unnecessary Features Enabled** - File loading (`LOAD DATA LOCAL INFILE` in MySQL), external program execution (`COPY ... PROGRAM` in PostgreSQL), and unused stored procedures increase the attack surface. Disable what you do not use.

**7. Insecure Transport** - Unencrypted connections between application and database. TLS is non-negotiable in production.

### Security Checklist

| Check | MySQL | PostgreSQL |
|-------|-------|------------|
| Strong auth plugin | `caching_sha2_password` | `scram-sha-256` |
| TLS enforced | `require_secure_transport = ON` | `hostssl` + `hostnossl reject` |
| No default/empty passwords | Check `mysql.user` | Check `pg_hba.conf` for `trust` |
| Least privilege accounts | Review `SHOW GRANTS` | Review `\du` and `\dp` |
| Audit logging | Enterprise Audit or general_log | pgAudit extension |
| Network restricted | `bind-address` + firewall | `listen_addresses` + firewall |
| Backups encrypted | Encrypt dump files | Encrypt dump files |
| Patches current | `SELECT VERSION()` | `SELECT version()` |
| File loading disabled | `local_infile = OFF` | Restrict `COPY ... PROGRAM` |

---

## Exercises

```exercise
title: Database Security Audit
difficulty: intermediate
scenario: |
  You have inherited a PostgreSQL 15 database server that has been running in production for two years with minimal security review. Perform a security audit by checking and fixing each of these areas:

  1. Check the authentication methods in pg_hba.conf - identify any entries using 'trust' or 'md5'
  2. Verify that TLS is enabled and enforced for all remote connections
  3. Review all database roles - identify accounts with SUPERUSER or CREATEDB privileges that should not have them
  4. Check if the public schema has default access revoked
  5. Verify pgAudit is installed and configured to log DDL and role changes
  6. Check that the database is not listening on all interfaces (0.0.0.0)
  7. Write the remediation SQL/config for each issue found
hints:
  - "Check pg_hba.conf for 'trust' and 'md5' entries - replace with 'scram-sha-256'"
  - "Run SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles to review privileges"
  - "Check listen_addresses in postgresql.conf - it should be a specific IP, not '*' or '0.0.0.0'"
  - "Use REVOKE ALL ON SCHEMA public FROM PUBLIC to remove default access"
  - "Verify pgAudit: SELECT * FROM pg_available_extensions WHERE name = 'pgaudit'"
solution: |
  ```sql
  -- Step 1: Fix authentication methods
  -- In pg_hba.conf, change:
  --   host all all 0.0.0.0/0 trust      -->  DELETE this line
  --   host all all 10.0.0.0/24 md5       -->  hostssl all all 10.0.0.0/24 scram-sha-256
  -- Ensure password_encryption = scram-sha-256 in postgresql.conf

  -- Step 2: Verify TLS
  -- In postgresql.conf:
  --   ssl = on
  --   ssl_cert_file = '/etc/postgresql/ssl/server-cert.pem'
  --   ssl_key_file = '/etc/postgresql/ssl/server-key.pem'
  --   ssl_min_protocol_version = 'TLSv1.2'
  -- In pg_hba.conf, use hostssl instead of host

  -- Step 3: Review and fix roles
  SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
  FROM pg_roles WHERE rolsuper OR rolcreatedb OR rolcreaterole;
  -- Remove unnecessary privileges:
  ALTER ROLE app_user NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ALTER ROLE backup_user NOSUPERUSER NOCREATEDB;

  -- Step 4: Revoke public schema access
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
  -- Then grant explicitly to roles that need it:
  GRANT USAGE ON SCHEMA public TO app_read;
  GRANT USAGE ON SCHEMA public TO app_write;

  -- Step 5: Enable pgAudit
  -- In postgresql.conf:
  --   shared_preload_libraries = 'pgaudit'
  --   pgaudit.log = 'ddl, role'
  CREATE EXTENSION IF NOT EXISTS pgaudit;

  -- Step 6: Restrict listen address
  -- In postgresql.conf:
  --   listen_addresses = '10.0.0.5'   -- specific internal IP
  -- NOT: listen_addresses = '*'

  -- Step 7: Reload configuration
  SELECT pg_reload_conf();
  ```
```

---

## Further Reading

- [MySQL Security Guide](https://dev.mysql.com/doc/refman/8.0/en/security.html) - official MySQL security documentation covering authentication, encryption, and access control
- [PostgreSQL Client Authentication (pg_hba.conf)](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) - comprehensive reference for PostgreSQL authentication configuration
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) - parameterized query patterns for every major language
- [pgAudit Documentation](https://www.pgaudit.org/) - PostgreSQL audit logging extension setup and configuration
- [CIS Benchmarks for MySQL and PostgreSQL](https://www.cisecurity.org/benchmark) - industry-standard hardening checklists from the Center for Internet Security

---

**Previous:** [Backup & Recovery Strategies](backup-and-recovery.md) | **Next:** [Scaling & Architecture Patterns](scaling-and-architecture.md) | [Back to Index](README.md)
