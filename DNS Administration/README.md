# DNS Administration

A comprehensive guide to DNS - from how name resolution actually works to running authoritative servers, signing zones with DNSSEC, and designing resilient architectures. These guides take you from "I can query DNS" to understanding the system deeply enough to build and operate it.

Each topic is covered in its own guide. Start anywhere - they're self-contained, but the order below follows a natural learning path.

---

## Guides

### [DNS Fundamentals](dns-fundamentals.md)

What DNS actually is, how the hierarchy works from root servers to your browser, and how resolution happens step by step. Covers the history behind DNS, the difference between authoritative and recursive servers, the root zone, caching, TTLs, and glue records.

### [Zone Files and Records](zone-files-and-records.md)

The anatomy of a zone file and every record type you'll encounter in practice. Covers SOA fields, A/AAAA, CNAME (and why you can't use it at the apex), MX, NS, TXT (SPF/DKIM/DMARC), PTR, SRV, and CAA - with complete annotated zone file examples for both forward and reverse zones.

### [DNS Tools and Troubleshooting](dns-tools.md)

The essential toolkit for querying, diagnosing, and debugging DNS. Covers `dig` in depth (including reading full output, `+trace`, `+dnssec`), `drill`, `delv`, `host`, `nslookup`, and `whois` - plus systematic troubleshooting playbooks for common failures.

### [BIND](bind.md)

The reference DNS implementation. Covers installation, `named.conf` structure, configuring caching resolvers and authoritative servers, primary/secondary with TSIG authentication, split-horizon views, security hardening, and `rndc` operations.

### [NSD and Unbound](nsd-and-unbound.md)

NLnet Labs' approach to DNS - separate authoritative (NSD) and recursive (Unbound) into purpose-built software. Covers both servers from installation through primary/secondary configuration, running them together, and when to choose them over BIND.

### [PowerDNS](powerdns.md)

Database-backed DNS with a built-in HTTP API. Covers the authoritative server with MySQL and SQLite backends, zone management via `pdnsutil` and the REST API, the recursor, primary/secondary replication, and DNSSEC signing.

### [DNSSEC](dnssec.md)

How DNS authentication works, from the Kaminsky attack that made it urgent to the ICANN root key ceremonies that anchor it. Covers the trust chain, DNSKEY/RRSIG/DS/NSEC records, key management, signing with BIND/NSD/PowerDNS, validation, and debugging failures.

### [DNS Architecture and Operations](dns-architecture.md)

Designing DNS infrastructure for the real world. Covers primary/secondary topologies, zone transfers (AXFR/IXFR), hidden primaries, split-horizon, anycast, DNS for email (SPF/DKIM/DMARC deep-dive), monitoring, and migration patterns.
