# DNSSEC

This guide covers DNSSEC - the system that adds cryptographic authentication to DNS. You'll learn why it was created, how the trust chain works from the root zone down to individual records, how to sign zones with BIND, NSD, and PowerDNS, and how to debug validation failures.

---

## Why DNSSEC Exists

DNS was designed in 1983 with no authentication whatsoever. When a resolver receives a DNS response, it has no way to verify that the answer actually came from the authoritative server and wasn't modified in transit. This is a problem because DNS is infrastructure - every HTTPS connection, email delivery, and API call starts with a DNS query. If an attacker can forge DNS responses, they can redirect traffic anywhere.

### The Kaminsky Attack

DNS cache poisoning attacks had been known for years, but in 2008, security researcher Dan Kaminsky discovered a technique that made them devastatingly practical. The attack exploited the way resolvers handle referrals to flood a resolver with forged responses, each trying a different transaction ID. Because the transaction ID was only 16 bits (65,536 possibilities), a high-speed attacker could guess the right ID within seconds and inject a poisoned cache entry.

Kaminsky recognized the severity and did something unusual - instead of publishing immediately, he coordinated a massive multi-vendor patching effort through the Department of Homeland Security's US-CERT. DNS software vendors quietly developed and deployed source port randomization patches (adding ~16 bits of entropy) before the vulnerability was publicly disclosed. Kaminsky presented the full details at Black Hat 2008, famously wearing rollerskates on stage.

The Kaminsky attack was mitigated but not eliminated by source port randomization. DNSSEC is the real fix - it makes forged responses cryptographically detectable, regardless of how clever the spoofing technique is.

### What DNSSEC Does (and Doesn't Do)

**DNSSEC provides:**
- **Authentication** - proof that the response came from the zone owner
- **Integrity** - proof that the response wasn't modified in transit
- **Authenticated denial of existence** - proof that a name genuinely doesn't exist (not a forged NXDOMAIN)

**DNSSEC does NOT provide:**
- **Confidentiality** - DNS queries and responses are still plaintext (that's what DoH/DoT are for)
- **Protection against a compromised authoritative server** - if the attacker controls the zone data and signing keys, DNSSEC signs the attacker's data
- **DDoS protection** - DNSSEC responses are larger than unsigned ones, potentially worsening amplification

---

## The DNSSEC Trust Chain

DNSSEC works by creating a chain of cryptographic trust from the root zone down to the record you're querying. Each link in the chain is verified by the one above it.

### Root Zone Signing

The root zone was fully signed with DNSSEC on **July 15, 2010**. The signing ceremony was (and continues to be) one of the most carefully controlled processes in internet governance.

The ICANN **root KSK ceremony** requires approximately 12-14 people from around the world to physically assemble at one of two secure facilities (in Culver City, California or El Segundo, Virginia). Trusted Community Representatives unlock safe deposit boxes containing smart cards. Multiple HSMs (Hardware Security Modules) are involved. The ceremony follows a rigid script, is livestreamed, and typically takes 3-8 hours. A complete audit trail is published. The entire point is that no single person or organization can sign the root zone alone.

### How the Chain Works

Every signed zone has:
1. A **DNSKEY** record containing the zone's public key(s)
2. **RRSIG** records - cryptographic signatures over each record set
3. A **DS (Delegation Signer)** record in the *parent* zone that hashes the child's key

The chain works like this:

```
Root zone (.)
  DNSKEY → signs everything in the root zone
  DS for .com → hash of .com's DNSKEY
          ↓
.com zone
  DNSKEY → signs everything in .com
  DS for example.com → hash of example.com's DNSKEY
          ↓
example.com zone
  DNSKEY → signs everything in example.com
  RRSIG over A record for www.example.com → signature
          ↓
Validated answer: www.example.com A 93.184.216.34
```

A validating resolver starts at the root (whose key it already knows - the "trust anchor") and follows the chain down. At each level:

1. Fetch the DNSKEY for the zone
2. Verify it matches the DS record in the parent zone
3. Use the DNSKEY to verify the RRSIG signatures on the records
4. If any step fails, return SERVFAIL instead of the (potentially forged) answer

---

## DNSSEC Record Types

### DNSKEY

The **DNSKEY** record publishes a zone's public key. A zone typically has two keys:

**KSK (Key Signing Key)** - flag value 257. Signs only the DNSKEY record set. The KSK's hash is published as a DS record in the parent zone. KSKs are changed infrequently (every 1-2 years).

**ZSK (Zone Signing Key)** - flag value 256. Signs all other record sets in the zone. ZSKs are changed more frequently (every 1-3 months) because they're used heavily and a compromise would be more impactful.

Some implementations use a single **CSK (Combined Signing Key)** - flag value 257 - that does both jobs. PowerDNS defaults to this approach.

### RRSIG

An **RRSIG** record is a cryptographic signature over a specific record set (all records of the same name and type). For every A record, MX record, etc., there's a corresponding RRSIG.

```bash
dig +dnssec example.com A
```

```
;; ANSWER SECTION:
example.com.    86400   IN  A       93.184.216.34
example.com.    86400   IN  RRSIG   A 13 2 86400 20250215000000 20250201000000 31406 example.com. abc123...
```

The RRSIG fields include the algorithm (13 = ECDSAP256SHA256), the number of labels (2), the original TTL, signature expiration and inception timestamps, the key tag (identifying which DNSKEY made the signature), and the signature itself.

**RRSIG signatures have expiration dates.** If signatures expire and aren't refreshed, DNSSEC validation fails and the domain stops resolving for validating resolvers. This is the most common DNSSEC operational failure. In October 2023, Cloudflare experienced a 3-hour outage for some domains due to expired DNSSEC signatures that went undetected.

### DS

A **DS (Delegation Signer)** record in the parent zone links to the child zone's DNSKEY. It's a hash of the child's KSK. You submit the DS record to your registrar, who publishes it in the parent zone (e.g., `.com`).

```bash
dig DS example.com +short
```

```
31406 13 2 abc123def456789...
```

The fields are: key tag, algorithm, digest type (2 = SHA-256), and the digest.

### NSEC and NSEC3

How do you prove that a name *doesn't* exist? You can't sign a record that doesn't exist. DNSSEC solves this with **NSEC (Next Secure)** records.

An **NSEC** record says "the next name that exists after this one is X." By chaining all existing names together, a resolver can verify that a queried name falls in a gap and genuinely doesn't exist.

The problem with NSEC is **zone walking**. An attacker can follow the NSEC chain to enumerate every name in a zone:

```bash
# Start with a query for a name that doesn't exist
dig @ns1.example.com nonexistent.example.com

# The NSEC record reveals the next existing name
# Query for a name just after that, get another NSEC, repeat...
```

**NSEC3** was created to prevent zone walking. Instead of listing names directly, NSEC3 uses hashed names. The chain still proves non-existence, but an attacker can't read the actual names from the hashes (though offline dictionary attacks against the hashes are possible).

Most modern zones use NSEC3 for zone walking prevention.

---

## Key Management: KSK and ZSK

### Why Two Keys?

Using separate KSK and ZSK keys serves a practical purpose. The DS record in the parent zone is a hash of the KSK. Changing the KSK requires updating the DS record at the registrar - a manual, error-prone process. The ZSK, on the other hand, can be changed without touching the parent zone.

This separation means you can rotate ZSKs frequently (for security) without the operational burden of updating DS records each time. KSKs rotate much less often.

### Algorithm Recommendations

The current recommended algorithm is **ECDSAP256SHA256 (algorithm 13)**. It produces much smaller signatures than RSA, reducing DNS response sizes and improving performance. Older zones may use RSA (algorithms 5, 7, 8), but new deployments should use algorithm 13.

### Rollover Procedures

**ZSK rollover** (pre-publish method):
1. Generate the new ZSK and publish it in DNSKEY (but don't sign with it yet)
2. Wait for the old DNSKEY TTL to expire (so all resolvers have the new key)
3. Start signing with the new ZSK
4. Remove the old ZSK signatures
5. Remove the old ZSK from DNSKEY

**KSK rollover** (double-DS method):
1. Generate the new KSK and publish it in DNSKEY
2. Submit the new DS record to the registrar (keep the old one too)
3. Wait for the parent zone to publish the new DS
4. Wait for the old DS TTL to expire
5. Remove the old KSK from DNSKEY
6. Remove the old DS from the parent

Key rollovers are the most operationally risky part of DNSSEC. Automate them whenever possible.

---

## Signing with BIND

### Automated Signing with dnssec-policy (BIND 9.16+)

BIND 9.16 introduced `dnssec-policy`, which fully automates DNSSEC signing, key generation, and rollover. This is the recommended approach.

```
// named.conf

dnssec-policy "standard" {
    keys {
        ksk key-directory lifetime P2Y algorithm ecdsap256sha256;
        zsk key-directory lifetime P3M algorithm ecdsap256sha256;
    };
    nsec3param iterations 0 optout no salt-length 0;
    // Timing parameters (automatic rollover)
    dnskey-ttl PT1H;
    publish-safety PT1H;
    retire-safety PT1H;
    signatures-refresh P5D;
    signatures-validity P14D;
    signatures-validity-dnskey P14D;
    max-zone-ttl P1D;
    zone-propagation-delay PT5M;
    parent-ds-ttl P1D;
    parent-propagation-delay PT1H;
};

zone "example.com" {
    type primary;
    file "zones/example.com.zone";
    dnssec-policy "standard";
    inline-signing yes;
};
```

With this configuration, BIND:
- Generates KSK and ZSK keys automatically
- Signs all records in the zone
- Re-signs before signatures expire
- Rolls ZSKs every 3 months and KSKs every 2 years
- Publishes new keys in advance of rollover

After enabling, check the signing status:

```bash
rndc signing -list example.com
rndc zonestatus example.com
```

Get the DS record to submit to your registrar:

```bash
dig @localhost example.com DNSKEY | dnssec-dsfromkey -2 -f - example.com
```

### Manual Signing (Legacy)

For older BIND versions or when you need explicit control:

```bash
# Generate keys
dnssec-keygen -a ECDSAP256SHA256 -f KSK example.com
dnssec-keygen -a ECDSAP256SHA256 example.com

# Include keys in zone file
$INCLUDE Kexample.com.+013+31406.key
$INCLUDE Kexample.com.+013+52918.key

# Sign the zone
dnssec-signzone -A -3 $(head -c 8 /dev/urandom | od -A n -t x | tr -d ' ') \
    -N INCREMENT -o example.com -t zones/example.com.zone
```

This generates a signed zone file (`example.com.zone.signed`) that must be referenced in `named.conf`. You need to re-sign before the signatures expire - typically via a cron job. `dnssec-policy` eliminates all of this manual work.

---

## Signing with NSD

NSD itself doesn't sign zones. You use external tools from the **ldns** library:

```bash
# Generate keys
ldns-keygen -a ECDSAP256SHA256 -k example.com    # KSK
ldns-keygen -a ECDSAP256SHA256 example.com        # ZSK

# Sign the zone
ldns-signzone -n -p -s $(head -c 8 /dev/urandom | od -A n -t x | tr -d ' ') \
    example.com.zone Kexample.com.+013+*.private
```

Configure NSD to serve the signed zone:

```yaml
zone:
    name: "example.com"
    zonefile: "example.com.zone.signed"
```

You'll need a cron job or script to re-sign periodically:

```bash
# Re-sign weekly (signatures typically valid 30 days)
0 3 * * 0 ldns-signzone -n -p example.com.zone Kexample.com.*.private && nsd-control reload example.com
```

---

## Signing with PowerDNS

PowerDNS has the simplest DNSSEC signing workflow:

```bash
# Sign a zone (generates keys, signs everything)
pdnsutil secure-zone example.com

# View DNSSEC status
pdnsutil show-zone example.com

# Get the DS record for your registrar
pdnsutil export-zone-ds example.com
```

PowerDNS signs records on-the-fly as they're served, using keys stored in the database. There's no separate signed zone file and no need for re-signing cron jobs. When you add or modify records, they're automatically signed.

**Rectify the zone** after direct database modifications:

```bash
pdnsutil rectify-zone example.com
```

---

## Validating DNSSEC

### dig +dnssec

```bash
dig +dnssec example.com A
```

Look for the `ad` flag in the response header:

```
;; flags: qr rd ra ad; QUERY: 1, ANSWER: 2
```

`ad` (Authenticated Data) means your resolver validated the DNSSEC signatures. If `ad` is absent, either the zone isn't signed or your resolver isn't validating.

The response includes RRSIG records alongside the answer:

```
;; ANSWER SECTION:
example.com.    86400   IN  A       93.184.216.34
example.com.    86400   IN  RRSIG   A 13 2 86400 ...
```

### delv

`delv` does its own validation, independent of your resolver:

```bash
delv example.com A
```

```
; fully validated
example.com.    86400   IN  A   93.184.216.34
example.com.    86400   IN  RRSIG   A 13 2 86400 ...
```

"fully validated" means the entire trust chain checked out.

### dig +cd (Checking Disabled)

When you suspect DNSSEC is causing a SERVFAIL, use `+cd` to bypass validation:

```bash
dig example.com A              # SERVFAIL (DNSSEC issue)
dig +cd example.com A          # returns the answer, skipping validation
```

If `+cd` gives you an answer when the normal query returns SERVFAIL, the problem is definitely DNSSEC.

### Online Tools

- [**DNSViz**](https://dnsviz.net/) - visualizes the entire DNSSEC trust chain as a graph, showing exactly where validation succeeds or fails
- [**Verisign DNSSEC Debugger**](https://dnssec-debugger.verisignlabs.com/) - tests delegation and signing from root to your zone

---

## Common DNSSEC Failures

### Expired Signatures

RRSIG records have inception and expiration timestamps. If the current time is outside that window, validation fails.

**Diagnosis:**

```bash
dig +dnssec example.com A | grep RRSIG
```

Check the expiration timestamp. If it's in the past, signatures need to be refreshed.

**Fix:** Re-sign the zone (or fix the automated signing process). If using `dnssec-policy` in BIND, check that the signing process is running. If using PowerDNS, this shouldn't happen unless the server was down for an extended period.

### DS/DNSKEY Mismatch

The DS record in the parent zone doesn't match any DNSKEY in the child zone. This happens during botched key rollovers.

**Diagnosis:**

```bash
# Get the DS from the parent
dig DS example.com +short

# Get the DNSKEYs from the authoritative server
dig @ns1.example.com DNSKEY example.com

# Compare - the DS key tag should match a DNSKEY key tag
```

**Fix:** Either update the DS record at the registrar to match the current DNSKEY, or add the DNSKEY that matches the existing DS record back to the zone.

### Clock Skew

DNSSEC signatures are time-bounded. If your server's clock is significantly wrong, valid signatures appear expired (or not yet valid).

**Diagnosis:**

```bash
date              # check current time
dig +dnssec example.com | grep RRSIG   # check inception/expiration
```

**Fix:** Synchronize your clock with NTP:

```bash
timedatectl set-ntp true
```

### Algorithm Downgrade

If the DS record specifies algorithm 13 but the DNSKEY uses algorithm 8 (or vice versa), validation fails.

**Diagnosis:**

```bash
dig DS example.com +short      # shows algorithm number
dig DNSKEY example.com +short  # shows algorithm number
```

The algorithm numbers must match between the DS and the DNSKEY it references.

### Debugging Workflow

When a domain returns SERVFAIL and you suspect DNSSEC:

```bash
# Step 1: Confirm it's a DNSSEC issue
dig example.com                    # SERVFAIL
dig +cd example.com                # works? Then it's DNSSEC

# Step 2: Check the trust chain
delv example.com                   # shows where validation fails
# OR
drill -S example.com               # traces the entire chain

# Step 3: Check specific components
dig +dnssec example.com DNSKEY     # are DNSKEYs present?
dig DS example.com                 # is the DS record correct?
dig +dnssec example.com A          # are RRSIGs present and current?

# Step 4: Use DNSViz for visual analysis
# Visit https://dnsviz.net/ and enter the domain
```

---

## Further Reading

- [RFC 4033](https://datatracker.ietf.org/doc/html/rfc4033) - DNS Security Introduction and Requirements
- [RFC 4034](https://datatracker.ietf.org/doc/html/rfc4034) - Resource Records for DNS Security Extensions
- [RFC 4035](https://datatracker.ietf.org/doc/html/rfc4035) - Protocol Modifications for DNS Security Extensions
- [RFC 5155](https://datatracker.ietf.org/doc/html/rfc5155) - DNS Security (DNSSEC) Hashed Authenticated Denial of Existence (NSEC3)
- [DNSViz](https://dnsviz.net/) - DNSSEC visualization and analysis
- [Verisign DNSSEC Debugger](https://dnssec-debugger.verisignlabs.com/) - online DNSSEC validation testing
- [ICANN Root KSK Ceremonies](https://www.iana.org/dnssec/ceremonies) - ceremony scripts and documentation

---

**Previous:** [PowerDNS](powerdns.md) | **Next:** [DNS Architecture and Operations](dns-architecture.md) | [Back to Index](README.md)
