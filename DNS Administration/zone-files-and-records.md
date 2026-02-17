# Zone Files and Records

This guide covers the anatomy of DNS zone files - the files that define what your domain actually does. You'll learn every record type you'll encounter in practice, the syntax that trips up even experienced administrators, and how to write complete zone files for both forward and reverse zones.

---

## Zone File Anatomy

A zone file is a plain text file that describes a DNS zone. The format was defined in [RFC 1035](https://datatracker.ietf.org/doc/html/rfc1035) in 1987, and the syntax hasn't changed since. Every authoritative DNS server reads zone data in this format (or loads equivalent data from a database).

### Directives

Zone files support several directives that control how the file is parsed:

**`$ORIGIN`** sets the default domain name appended to any name that doesn't end with a dot. If you don't set `$ORIGIN`, it defaults to the zone name from your server configuration.

```
$ORIGIN example.com.
```

With this directive, a record like `www IN A 198.51.100.10` is interpreted as `www.example.com. IN A 198.51.100.10`.

**`$TTL`** sets the default TTL for records that don't specify one explicitly.

```
$TTL 3600
```

This means "any record without its own TTL value lives in caches for 3600 seconds (1 hour)."

**`$INCLUDE`** inserts another file's contents at this point in the zone. Useful for splitting large zones into manageable pieces.

### Names and the Trailing Dot

This is the single most common source of zone file bugs. Names in a zone file are either **absolute** (ending with a dot) or **relative** (without a dot, so `$ORIGIN` is appended).

```
; With $ORIGIN example.com.

www                 IN  A     198.51.100.10     ; becomes www.example.com.
mail.example.com.   IN  A     198.51.100.20     ; stays mail.example.com. (absolute)
mail.example.com    IN  A     198.51.100.20     ; becomes mail.example.com.example.com. (BUG!)
```

That third line is the classic trailing-dot mistake. Without the dot, the parser appends the origin, producing a nonsensical name. You will make this mistake at least once. Zone checking tools like `named-checkzone` catch it.

### The `@` Shorthand

The `@` symbol means "the current origin" (the zone apex). So in a zone file for `example.com.`:

```
@   IN  A     198.51.100.10     ; means example.com. IN A 198.51.100.10
@   IN  MX    10 mail           ; means example.com. IN MX 10 mail.example.com.
```

### Comments

Anything after a semicolon (`;`) is a comment:

```
www     IN  A   198.51.100.10   ; main web server
```

---

## The SOA Record In Depth

Every zone file must start with a **SOA (Start of Authority)** record. It declares which server is the primary nameserver for the zone and provides parameters that control zone transfers and caching.

```
$TTL 3600
$ORIGIN example.com.
@   IN  SOA ns1.example.com. admin.example.com. (
            2025011501  ; serial
            3600        ; refresh (1 hour)
            900         ; retry (15 minutes)
            1209600     ; expire (2 weeks)
            300         ; minimum / negative cache TTL (5 minutes)
)
```

Every field matters:

**MNAME** (`ns1.example.com.`) - the primary nameserver for the zone. This should be the server where you edit zone data.

**RNAME** (`admin.example.com.`) - the responsible person's email address, encoded in a DNS-specific way. The first dot replaces the `@` sign. So `admin.example.com.` means `admin@example.com`. If the local part of the email contains a literal dot (like `first.last@example.com`), you escape it with a backslash: `first\.last.example.com.`

**Serial** (`2025011501`) - a version number that secondaries use to determine if the zone has changed. If the serial hasn't increased, the secondary won't transfer the zone. The most common convention is `YYYYMMDDNN` (date plus a two-digit revision number). January 15, 2025, first change of the day would be `2025011501`. Second change: `2025011502`.

Forgetting to increment the serial after editing a zone is one of the most common DNS mistakes. Your changes will take effect on the primary but never reach the secondaries.

**Refresh** (`3600`) - how often (in seconds) secondaries should check the primary for changes. One hour is typical.

**Retry** (`900`) - if a refresh check fails, how long before the secondary tries again. Should be shorter than refresh.

**Expire** (`1209600`) - if the secondary can't reach the primary for this long, it stops serving the zone entirely. Two weeks is standard. This prevents stale data from being served indefinitely.

**Minimum** (`300`) - this field was originally the minimum TTL for records in the zone. [RFC 2308](https://datatracker.ietf.org/doc/html/rfc2308) redefined it as the **negative cache TTL** - how long resolvers should cache NXDOMAIN (name not found) responses. Five minutes is a reasonable value.

You can query the SOA record in a readable format with:

```bash
dig SOA example.com +multiline
```

```
example.com.        3600 IN SOA ns1.example.com. admin.example.com. (
                            2025011501 ; serial
                            3600       ; refresh (1 hour)
                            900        ; retry (15 minutes)
                            1209600    ; expire (2 weeks)
                            300        ; minimum (5 minutes)
                        )
```

The `+multiline` flag is essential for reading SOA records - without it, all the fields run together on one line.

---

## Core Record Types

### A and AAAA

**A** records map a name to an IPv4 address. **AAAA** records map a name to an IPv6 address.

```
www         IN  A       198.51.100.10
www         IN  AAAA    2001:db8::1
```

A domain can have multiple A records. DNS responds with all of them, and clients typically try them in order (or randomize). This is the simplest form of load distribution - called **DNS round-robin**.

```
www         IN  A       198.51.100.10
www         IN  A       198.51.100.11
www         IN  A       198.51.100.12
```

### CNAME

A **CNAME (Canonical Name)** record creates an alias from one name to another.

```
blog        IN  CNAME   www.example.com.
```

When a resolver looks up `blog.example.com`, it sees the CNAME and follows it to `www.example.com`, then resolves that name to its A/AAAA records.

CNAME has a strict rule that catches people off guard: **a CNAME cannot coexist with any other record at the same name.** This means you cannot put a CNAME at the zone apex (`example.com.`) because the apex already has SOA and NS records (and typically MX and TXT records too).

This is why "CNAME at the apex" is forbidden by [RFC 1034](https://datatracker.ietf.org/doc/html/rfc1034). Everyone wants to do `example.com CNAME myapp.herokuapp.com` to point their bare domain at a cloud provider, but the RFC says no.

The workaround is provider-specific:

- **ALIAS** (DNSimple, NS1) / **ANAME** (PowerDNS, RFC draft) - the authoritative server resolves the target internally and returns A/AAAA records
- **CNAME flattening** (Cloudflare) - similar to ALIAS, done at the DNS provider level
- **A record** pointing directly at the provider's IP (if they offer a static IP)

### MX

**MX (Mail Exchange)** records specify which servers accept email for the domain. Each MX record has a **priority** (lower number = higher priority).

```
@           IN  MX  10  mail1.example.com.
@           IN  MX  20  mail2.example.com.
@           IN  MX  30  backupmx.example.com.
```

Mail servers try the lowest-priority MX first. If `mail1` is unreachable, they try `mail2`, then `backupmx`. Equal priorities mean the sender picks randomly among them.

An MX record **must point to a hostname, never an IP address**, and the target **must not be a CNAME**. Both constraints come from the RFCs and are enforced by many mail servers. Violating them causes subtle delivery failures.

### NS

**NS (Name Server)** records declare which servers are authoritative for a zone.

```
@           IN  NS  ns1.example.com.
@           IN  NS  ns2.example.com.
```

NS records at the zone apex tell resolvers where to find authoritative data. NS records at a subdomain create a **delegation** - they carve off a portion of the namespace to be handled by different servers.

```
; Delegate dev.example.com to different nameservers
dev         IN  NS  ns1.dev.example.com.
dev         IN  NS  ns2.dev.example.com.

; Glue records (needed because the NS names are within the delegated zone)
ns1.dev     IN  A   203.0.113.10
ns2.dev     IN  A   203.0.113.11
```

### TXT

**TXT** records hold arbitrary text. They've become one of the most heavily used record types because they're the mechanism for email authentication and domain verification.

```
; SPF - which servers may send email for this domain
@           IN  TXT "v=spf1 ip4:198.51.100.0/24 include:_spf.google.com -all"

; DKIM - public key for email signature verification
selector1._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3..."

; DMARC - policy for handling authentication failures
_dmarc      IN  TXT "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"

; Domain verification
@           IN  TXT "google-site-verification=abc123..."
```

TXT records have a structural quirk: each **character-string** within a TXT record is limited to 255 bytes. For data longer than 255 bytes (common with DKIM keys), you split it into multiple quoted strings that are concatenated:

```
selector1._domainkey IN TXT ("v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB"
                              "AQUAA4GNADCBiQKBgQC7ZYwx...")
```

The DNS protocol concatenates the strings automatically. But some providers' web interfaces handle this badly, silently truncating long values. If your DKIM verification is failing, check whether the full key made it into the record.

### PTR

**PTR (Pointer)** records do reverse DNS - mapping an IP address back to a hostname. They live in a special zone under `.in-addr.arpa` for IPv4 and `.ip6.arpa` for IPv6.

The trick with PTR records is that IP addresses are reversed. The PTR for `198.51.100.25` lives at `25.100.51.198.in-addr.arpa.`:

```
$ORIGIN 100.51.198.in-addr.arpa.
25      IN  PTR     mail.example.com.
```

Reverse DNS is controlled by whoever owns the IP address (typically your hosting provider or ISP), not whoever owns the domain. You usually set PTR records through your provider's control panel, not your own DNS server.

PTR records are critical for email. Many mail servers check that the sending IP's PTR record matches the SMTP HELO hostname, and reject or penalize email from IPs without valid reverse DNS.

---

## Service and Infrastructure Records

### SRV

**SRV (Service)** records specify the location of a service at a particular host and port.

```
_sip._tcp.example.com. 3600 IN SRV 10 60 5060 sipserver.example.com.
;                                   |  |  |     |
;                          priority-+  |  |     target host
;                              weight--+  |
;                                   port--+
```

The name format is `_service._protocol.domain`. **Priority** works like MX (lower first). **Weight** is for load balancing among records with the same priority - a server with weight 60 gets three times the traffic of one with weight 20.

SRV records are used by SIP, XMPP, LDAP, Kerberos, and many internal service discovery systems.

### CAA

**CAA (Certification Authority Authorization)** records specify which certificate authorities may issue TLS certificates for a domain.

```
@           IN  CAA 0 issue "letsencrypt.org"
@           IN  CAA 0 issuewild "letsencrypt.org"
@           IN  CAA 0 iodef "mailto:security@example.com"
```

`issue` controls regular certificates, `issuewild` controls wildcard certificates, and `iodef` specifies where to report violations. If you don't have CAA records, any CA can issue certificates for your domain.

### SSHFP

**SSHFP** records publish SSH host key fingerprints in DNS. When a client connects to an SSH server for the first time, it can verify the host key against the SSHFP record instead of showing "The authenticity of host... can't be established":

```
@           IN  SSHFP   4 2 abc123def456...
;                       |  |
;          algorithm ---+  hash type
```

This only works with DNSSEC validation enabled (otherwise an attacker could spoof the SSHFP record too).

---

## Complete Zone File Examples

### Forward Zone

A complete zone file for `example.com`:

```
$TTL 3600
$ORIGIN example.com.

; --- SOA ---
@   IN  SOA ns1.example.com. admin.example.com. (
            2025011501  ; serial
            3600        ; refresh (1 hour)
            900         ; retry (15 minutes)
            1209600     ; expire (2 weeks)
            300         ; minimum / negative cache TTL
)

; --- Nameservers ---
@           IN  NS      ns1.example.com.
@           IN  NS      ns2.example.com.

; --- Nameserver A records (glue) ---
ns1         IN  A       198.51.100.1
ns2         IN  A       198.51.100.2

; --- Mail ---
@           IN  MX      10 mail1.example.com.
@           IN  MX      20 mail2.example.com.
mail1       IN  A       198.51.100.10
mail2       IN  A       198.51.100.11

; --- Email authentication ---
@           IN  TXT     "v=spf1 ip4:198.51.100.0/24 -all"
selector1._domainkey IN TXT ("v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB"
                              "AQUAA4GNADCBiQKBgQC7ZYwx...")
_dmarc      IN  TXT     "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"

; --- Web ---
@           IN  A       198.51.100.20
@           IN  AAAA    2001:db8::20
www         IN  CNAME   example.com.

; --- Other services ---
ftp         IN  A       198.51.100.30
dev         IN  A       198.51.100.40

; --- Certificate authority ---
@           IN  CAA     0 issue "letsencrypt.org"
@           IN  CAA     0 issuewild "letsencrypt.org"
```

### Reverse Zone

The corresponding reverse zone for `198.51.100.0/24`:

```
$TTL 3600
$ORIGIN 100.51.198.in-addr.arpa.

@   IN  SOA ns1.example.com. admin.example.com. (
            2025011501  ; serial
            3600        ; refresh
            900         ; retry
            1209600     ; expire
            300         ; minimum
)

@           IN  NS      ns1.example.com.
@           IN  NS      ns2.example.com.

; IP -> hostname mappings (last octet only, $ORIGIN handles the rest)
1           IN  PTR     ns1.example.com.
2           IN  PTR     ns2.example.com.
10          IN  PTR     mail1.example.com.
11          IN  PTR     mail2.example.com.
20          IN  PTR     www.example.com.
30          IN  PTR     ftp.example.com.
40          IN  PTR     dev.example.com.
```

Notice the PTR records only have the last octet because `$ORIGIN` is set to `100.51.198.in-addr.arpa.`. The entry `1 IN PTR ns1.example.com.` expands to `1.100.51.198.in-addr.arpa. IN PTR ns1.example.com.`.

---

## Common Mistakes

**Missing trailing dot on FQDNs.** Already covered above, but it bears repeating. `mail.example.com` in a zone file becomes `mail.example.com.example.com.` because the origin is appended. Always use the trailing dot for fully qualified names.

**CNAME coexistence.** A CNAME cannot share a name with any other record type. This will fail:

```
; BROKEN - CNAME can't coexist with MX
@   IN  CNAME   other.example.com.
@   IN  MX      10 mail.example.com.
```

**Forgetting to increment the serial.** If you edit the zone file but don't change the serial, secondaries will never pick up the changes. They compare serials and only transfer when the primary's serial is higher.

**TTL too low.** A TTL of 60 seconds means every query hits your authoritative servers. During normal operations, 3600 (1 hour) to 86400 (24 hours) is reasonable. Lower to 300 (5 minutes) only when you're planning a change.

**TTL too high.** A TTL of 604800 (1 week) means if you make a mistake, resolvers worldwide will serve the wrong answer for up to a week. For records that change, keep TTLs reasonable.

**MX pointing to a CNAME.** The RFCs say MX targets must be A/AAAA records, not CNAMEs. Some servers handle this, many don't. It causes hard-to-diagnose email delivery failures.

---

## Further Reading

- [RFC 1035](https://datatracker.ietf.org/doc/html/rfc1035) - Domain Names: Implementation and Specification (zone file format)
- [RFC 2308](https://datatracker.ietf.org/doc/html/rfc2308) - Negative Caching of DNS Queries (SOA minimum field)
- [RFC 7208](https://datatracker.ietf.org/doc/html/rfc7208) - Sender Policy Framework (SPF)
- [RFC 6376](https://datatracker.ietf.org/doc/html/rfc6376) - DomainKeys Identified Mail (DKIM)
- [RFC 7489](https://datatracker.ietf.org/doc/html/rfc7489) - Domain-based Message Authentication (DMARC)
- [RFC 8659](https://datatracker.ietf.org/doc/html/rfc8659) - DNS Certification Authority Authorization (CAA)
- [IANA DNS Parameters](https://www.iana.org/assignments/dns-parameters/) - authoritative registry of record types and codes

---

**Previous:** [DNS Fundamentals](dns-fundamentals.md) | **Next:** [DNS Tools and Troubleshooting](dns-tools.md) | [Back to Index](README.md)
