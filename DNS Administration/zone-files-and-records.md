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

```quiz
question: "In a zone file, what does the trailing dot in 'example.com.' signify?"
type: multiple-choice
options:
  - text: "It marks the record as active"
    feedback: "The dot has nothing to do with record status. It's about how the DNS name is interpreted."
  - text: "It indicates an absolute/fully qualified domain name (FQDN)"
    correct: true
    feedback: "Correct! The trailing dot marks the name as fully qualified (absolute). Without the dot, BIND appends the zone's $ORIGIN. So 'mail' becomes 'mail.example.com.' but 'mail.example.com.' stays as-is. Forgetting the dot is one of the most common zone file mistakes."
  - text: "It enables DNSSEC for that record"
    feedback: "DNSSEC is configured separately and applies to the entire zone, not individual records. The trailing dot indicates an FQDN."
  - text: "It's optional formatting that has no effect"
    feedback: "The trailing dot is critical! Without it, the zone's $ORIGIN is appended. 'mail.example.com' (no dot) in the example.com zone becomes 'mail.example.com.example.com.' - a very common and hard-to-debug mistake."
```

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

```quiz
question: "Why is the SOA serial number typically formatted as YYYYMMDDNN?"
type: multiple-choice
options:
  - text: "DNS requires this specific format"
    feedback: "DNS only requires that the serial number increases with each change. The YYYYMMDDNN format is a convention, not a requirement."
  - text: "It's a convention that makes it easy to track when the zone was last changed"
    correct: true
    feedback: "Correct! The YYYYMMDDNN format (e.g., 2024011502 = Jan 15, 2024, change #2) embeds the date and a change counter. The only rule DNS enforces is that the serial must increase for secondaries to detect changes and initiate zone transfers."
  - text: "It ensures the serial number is always exactly 10 digits"
    feedback: "The serial is a 32-bit unsigned integer (up to ~4.29 billion). Length doesn't matter. The date format is a human-readability convention."
  - text: "The YYYY prefix is required for DNSSEC signature validation"
    feedback: "DNSSEC signatures have their own timestamps. The SOA serial format is independent of DNSSEC. It's simply a convention for human readability."
```

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

```quiz
question: "Why can't you put a CNAME record at the zone apex (e.g., example.com)?"
type: multiple-choice
options:
  - text: "CNAME records only work with subdomains like www"
    feedback: "CNAMEs technically work at any name, but the restriction is that a CNAME cannot coexist with other record types. The zone apex always has SOA and NS records."
  - text: "A CNAME cannot coexist with other record types, and the apex always has SOA and NS records"
    correct: true
    feedback: "Correct! RFC 1034 states that if a CNAME exists at a name, no other records can exist at that name. Since the zone apex must have SOA and NS records, a CNAME there would violate this rule. Use ALIAS/ANAME (provider-specific) or an A record instead."
  - text: "CNAMEs at the apex would create infinite loops"
    feedback: "Loops are prevented by other mechanisms. The restriction is that CNAME records are exclusive - they can't share a name with SOA, NS, MX, or any other record type."
  - text: "It's a limitation of BIND that other DNS servers don't have"
    feedback: "This is an RFC-level restriction, not server-specific. Some providers offer non-standard workarounds (ALIAS, ANAME), but the CNAME-at-apex limitation is in the DNS specification itself."
```

### MX

**MX (Mail Exchange)** records specify which servers accept email for the domain. Each MX record has a **priority** (lower number = higher priority).

```
@           IN  MX  10  mail1.example.com.
@           IN  MX  20  mail2.example.com.
@           IN  MX  30  backupmx.example.com.
```

Mail servers try the lowest-priority MX first. If `mail1` is unreachable, they try `mail2`, then `backupmx`. Equal priorities mean the sender picks randomly among them.

An MX record **must point to a hostname, never an IP address**, and the target **must not be a CNAME**. Both constraints come from the RFCs and are enforced by many mail servers. Violating them causes subtle delivery failures.

```quiz
question: "If a domain has MX records with priorities 10, 20, and 30, which server receives mail first?"
type: multiple-choice
options:
  - text: "The server with priority 30 (highest number = highest priority)"
    feedback: "MX priorities work the opposite way - lower numbers have higher priority. Think of it as preference order, where 10 is preferred over 20."
  - text: "The server with priority 10 (lowest number = highest priority)"
    correct: true
    feedback: "Correct! Lower MX priority numbers are tried first. Priority 10 is the primary mail server, 20 is the first backup, 30 is the second backup. If priority 10 is unreachable, mail is delivered to priority 20."
  - text: "All three receive mail simultaneously for load balancing"
    feedback: "MX priorities create a failover order, not load balancing. To load-balance, give multiple servers the same priority number. Different priorities mean fallback order."
  - text: "The sending server randomly selects one"
    feedback: "Selection is based on priority, not random. Servers with the same priority may be chosen randomly (or round-robin), but different priorities create an ordered preference."
```

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

```exercise
title: Write Email Authentication Records
difficulty: intermediate
scenario: |
  You need to set up email authentication records for `example.com`. The mail is
  sent from two sources:

  - Your mail server at `mail.example.com` (IP: 203.0.113.10)
  - A third-party email service (they tell you to include `spf.mailservice.com`)

  Write the following DNS records:
  1. An SPF record that authorizes both senders and fails all others
  2. A DMARC record that requests quarantine of failing messages and sends reports to `dmarc@example.com`
hints:
  - "SPF is a TXT record at the domain apex with v=spf1 prefix"
  - "Use ip4: for IP addresses and include: for third-party senders"
  - "End SPF with -all (hard fail) or ~all (soft fail)"
  - "DMARC is a TXT record at _dmarc.example.com with v=DMARC1 prefix"
solution: |
  ```
  ; SPF - authorize your server IP and the third-party service
  @          IN  TXT  "v=spf1 ip4:203.0.113.10 include:spf.mailservice.com -all"

  ; DMARC - quarantine failures, send reports
  _dmarc     IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=100"
  ```

  SPF breakdown:
  - `v=spf1` - version identifier (required)
  - `ip4:203.0.113.10` - authorize your mail server's IP
  - `include:spf.mailservice.com` - authorize the third-party service
  - `-all` - hard fail everything else (reject)

  DMARC breakdown:
  - `v=DMARC1` - version (required)
  - `p=quarantine` - quarantine (spam folder) messages that fail both SPF and DKIM
  - `rua=mailto:` - where to send aggregate reports
  - `pct=100` - apply to 100% of messages
```

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

```code-walkthrough
language: text
title: Complete Zone File Anatomy
code: |
  $TTL 86400
  @ IN SOA ns1.example.com. admin.example.com. (
              2024011502  ; Serial (YYYYMMDDNN)
              3600        ; Refresh (1 hour)
              900         ; Retry (15 minutes)
              604800      ; Expire (7 days)
              86400 )     ; Negative TTL (1 day)

  ; Nameservers
  @      IN  NS   ns1.example.com.
  @      IN  NS   ns2.example.com.

  ; Mail
  @      IN  MX   10 mail.example.com.
  @      IN  MX   20 backup-mx.example.com.

  ; A records
  @      IN  A    203.0.113.10
  ns1    IN  A    203.0.113.11
  ns2    IN  A    203.0.113.12
  mail   IN  A    203.0.113.20
  www    IN  CNAME @
annotations:
  - line: 1
    text: "$TTL sets the default TTL for records that don't specify their own. 86400 seconds = 24 hours of caching."
  - line: 2
    text: "SOA (Start of Authority): @ means the zone apex. The two names are the primary nameserver and the admin email (first dot replaces @, so admin.example.com. = admin@example.com)."
  - line: 3
    text: "Serial must increment with every change. Secondaries compare this to decide whether to transfer. YYYYMMDDNN format: 02 means the second change on Jan 15, 2024."
  - line: 4
    text: "Refresh: how often secondaries check for updates. 3600s = 1 hour. Balance between freshness and load on the primary."
  - line: 5
    text: "Retry: if refresh fails, try again after this interval. Should be shorter than refresh (here: 15 minutes)."
  - line: 6
    text: "Expire: if a secondary can't reach the primary for this long, it stops serving the zone. 7 days is standard."
  - line: 7
    text: "Negative TTL: how long resolvers cache NXDOMAIN (name doesn't exist) responses. Prevents repeated lookups for nonexistent names."
  - line: 10
    text: "NS records delegate the zone to these nameservers. You need at least 2 for redundancy. Trailing dots are critical here."
  - line: 13
    text: "MX records with priorities. 10 is tried first (primary), 20 is the backup. The target must be an A record, never a CNAME."
  - line: 17
    text: "A record at @ points the bare domain (example.com) to an IP. This is the record browsers use when you visit example.com without www."
  - line: 18
    text: "Glue records: ns1 and ns2 need A records here because they're within the zone they serve. Without these, there's a chicken-and-egg problem."
  - line: 21
    text: "CNAME for www pointing to @ (the zone apex). This means www.example.com resolves to wherever example.com points."
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

```exercise
title: Fix a Broken Zone File
difficulty: intermediate
scenario: |
  The following zone file has several errors. Find and fix all of them:

  ```
  $TTL 86400
  @  IN  SOA  ns1.example.com  admin.example.com (
                  2024011501
                  3600
                  900
                  604800
                  86400 )
  @      IN  NS   ns1.example.com
  @      IN  NS   ns2.example.com
  @      IN  A    192.168.1.10
  @      IN  CNAME www.example.com.
  www    IN  A    192.168.1.10
  mail   IN  A    192.168.1.20
  @      IN  MX   mail.example.com.
  ```

  There are at least 4 errors. Find them all.
hints:
  - "Check the SOA record - are the nameserver and email fields fully qualified (trailing dot)?"
  - "Can a CNAME exist at the zone apex (@) alongside A, SOA, and NS records?"
  - "MX records require a priority number before the mail server hostname"
  - "Check the NS records - are the target hostnames fully qualified?"
solution: |
  Fixed version:
  ```
  $TTL 86400
  @  IN  SOA  ns1.example.com. admin.example.com. (
                  2024011501
                  3600
                  900
                  604800
                  86400 )
  @      IN  NS   ns1.example.com.
  @      IN  NS   ns2.example.com.
  @      IN  A    192.168.1.10
  www    IN  A    192.168.1.10
  mail   IN  A    192.168.1.20
  @      IN  MX   10 mail.example.com.
  ```

  Errors fixed:
  1. **Missing trailing dots on SOA fields**: `ns1.example.com` → `ns1.example.com.` and `admin.example.com` → `admin.example.com.`
  2. **Missing trailing dots on NS targets**: Both NS records needed trailing dots
  3. **CNAME at zone apex**: Removed the illegal CNAME at @ (it conflicts with SOA, NS, and A records)
  4. **Missing MX priority**: Added priority `10` before `mail.example.com.`
```

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
