# Certificate Management

Managing TLS certificates is one of the most operationally critical tasks in systems administration. An expired or misconfigured certificate takes down your site, breaks API integrations, and erodes user trust. This guide covers the full lifecycle: obtaining certificates, automating renewal, building internal CAs, and troubleshooting the most common failures.

---

## The ACME Protocol

The **Automatic Certificate Management Environment (ACME)** protocol is how clients like Certbot communicate with [**Let's Encrypt**](https://letsencrypt.org/) to automate certificate issuance and renewal. Understanding the protocol helps you debug problems when automation fails.

The flow:

1. The client generates a key pair and registers an account with the CA.
2. The client requests a certificate for one or more domains.
3. The CA issues **challenges** to prove the client controls the domain(s).
4. The client completes the challenges and notifies the CA.
5. The CA verifies the challenges and issues the certificate.
6. The client downloads and installs the certificate.

### Challenge Types

| Challenge | Mechanism | Port Required | Use Case |
|-----------|-----------|---------------|----------|
| HTTP-01 | Place a file at `/.well-known/acme-challenge/` | 80 | Standard web servers |
| DNS-01 | Add a TXT record to `_acme-challenge.domain` | None | Wildcards, internal servers, CDN-fronted sites |
| TLS-ALPN-01 | Present a special self-signed cert on port 443 | 443 | When port 80 is unavailable |

HTTP-01 is the simplest - [**Certbot**](https://certbot.eff.org/) places a token file on your web server and Let's Encrypt fetches it. DNS-01 is required for wildcard certificates (`*.example.com`) because it proves control over the entire DNS zone, not just a single server.

---

## Let's Encrypt with Certbot

### Installation

```bash
# Ubuntu/Debian (snap is the recommended method)
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Alternative: pip (useful in containers or minimal environments)
pip install certbot certbot-nginx
```

### Obtaining a Certificate

```bash
# Automatic Nginx configuration (obtains cert + modifies nginx config)
sudo certbot --nginx -d example.com -d www.example.com

# Certificate only (does not modify server config)
sudo certbot certonly --nginx -d example.com -d www.example.com

# Standalone mode (Certbot runs its own temporary web server on port 80)
sudo certbot certonly --standalone -d example.com

# DNS challenge for wildcard certificates
sudo certbot certonly --manual --preferred-challenges dns -d "*.example.com" -d example.com
```

!!! tip "`fullchain.pem` vs `cert.pem`"
    Certbot stores files in `/etc/letsencrypt/live/example.com/`. Always use `fullchain.pem` in your server configuration, not `cert.pem`. The fullchain includes both your certificate and the intermediate CA certificate. Using just `cert.pem` causes trust errors on clients that don't have the intermediate cached.

### Certificate Files

After a successful issuance, Certbot creates these files:

| File | Contents |
|------|----------|
| `privkey.pem` | Your private key. Never share this. |
| `cert.pem` | Your certificate only (end-entity). |
| `chain.pem` | Intermediate CA certificate(s). |
| `fullchain.pem` | `cert.pem` + `chain.pem` combined. Use this in server configs. |

---

## Automated Renewal

Let's Encrypt certificates are valid for **90 days**. Short lifetimes reduce the window of exposure if a key is compromised and encourage automation over manual processes.

### How Certbot Renews

Certbot installs a systemd timer (or cron job) that runs `certbot renew` twice daily. It only renews certificates within 30 days of expiration.

```bash
# Check the renewal timer status
sudo systemctl status certbot.timer

# View all managed certificates and their expiration dates
sudo certbot certificates

# Test renewal without actually renewing (dry run)
sudo certbot renew --dry-run

# Force renewal of a specific certificate
sudo certbot renew --cert-name example.com --force-renewal
```

### Post-Renewal Hooks

After renewing a certificate, you need to reload the web server so it picks up the new files. Certbot supports hooks for this:

```bash
# Reload Nginx after any successful renewal
sudo certbot renew --deploy-hook "systemctl reload nginx"
```

For a permanent hook, create a file in `/etc/letsencrypt/renewal-hooks/deploy/`:

```bash
#!/bin/bash
# /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl reload nginx
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Monitoring Certificate Expiration

Automated renewal should handle everything, but monitoring catches the cases where it doesn't - DNS changes that break challenges, Certbot bugs, or servers that were never set up for automation.

### Script-Based Monitoring

```bash
#!/bin/bash
# check-cert-expiry.sh - Alert if certificate expires within 14 days
DOMAIN="example.com"
DAYS_WARNING=14

EXPIRY=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -enddate | cut -d= -f2)

EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

if [ "$DAYS_LEFT" -lt "$DAYS_WARNING" ]; then
    echo "WARNING: $DOMAIN certificate expires in $DAYS_LEFT days ($EXPIRY)"
    # Send alert: email, Slack webhook, PagerDuty, etc.
fi
```

### External Monitoring Services

For production systems, supplement local scripts with external monitoring that checks from outside your network:

- **Uptime Robot** / **Better Uptime**: Monitor HTTPS endpoints and alert on certificate errors.
- **SSL Labs**: Periodic deep scans of your TLS configuration.
- **Certbot `certificates` command**: Quick local check of managed certificate status.

!!! danger "Never expose or commit private keys"
    Private keys (`privkey.pem`, `.key` files) must never appear in version control, log files, error messages, or backup archives without encryption. If a private key is compromised, you must revoke the certificate immediately (`certbot revoke --cert-path /etc/letsencrypt/live/example.com/cert.pem`) and obtain a new one.

---

## Building an Internal CA

For internal services (microservices, development environments, VPN authentication), running your own CA avoids paying for commercial certificates and lets you issue certificates for internal hostnames that aren't publicly resolvable.

### Create a Root CA

```bash
# Generate the CA private key (keep this offline/secure after setup)
openssl genrsa -aes256 -out ca.key 4096

# Create the self-signed root certificate (valid 10 years)
openssl req -new -x509 -key ca.key -sha256 -days 3650 \
  -out ca.crt -subj "/CN=Internal Root CA/O=My Company"
```

### Sign a Server Certificate

```bash
# Generate the server's private key
openssl genrsa -out server.key 2048

# Create a CSR with SANs
openssl req -new -key server.key -out server.csr \
  -subj "/CN=api.internal" \
  -addext "subjectAltName=DNS:api.internal,DNS:api.staging.internal"

# Sign it with your CA (valid 1 year)
openssl x509 -req -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 365 -sha256 \
  -copy_extensions copyall
```

### Distributing the CA Certificate

For clients to trust certificates signed by your internal CA, they need your `ca.crt` installed as a trusted root:

```bash
# Ubuntu/Debian
sudo cp ca.crt /usr/local/share/ca-certificates/internal-ca.crt
sudo update-ca-certificates

# RHEL/CentOS
sudo cp ca.crt /etc/pki/ca-trust/source/anchors/internal-ca.crt
sudo update-ca-trust

# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ca.crt
```

---

## Format Conversion

Different platforms require different certificate formats. These conversions come up frequently.

```bash
# PEM to PKCS#12 (for Windows/Java - bundles cert + key + chain)
openssl pkcs12 -export \
  -in server.crt -inkey server.key -certfile ca.crt \
  -out server.p12

# PKCS#12 to PEM (extract from Windows/Java format)
openssl pkcs12 -in server.p12 -out server.pem -nodes

# PEM to DER (binary format)
openssl x509 -in server.crt -outform DER -out server.der

# DER to PEM
openssl x509 -in server.der -inform DER -out server.pem

# Import PKCS#12 into a Java keystore
keytool -importkeystore \
  -srckeystore server.p12 -srcstoretype pkcs12 \
  -destkeystore server.jks -deststoretype jks
```

---

## Troubleshooting

### Certificate/Key Mismatch

The modulus of the certificate and key must match. If they don't, the server will fail to start TLS.

```bash
# These two hashes must be identical
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in server.key | openssl md5
```

**Common cause**: Renewed the certificate but forgot to update the key path in the server config, or mixed up files from different domains.

### Incomplete Certificate Chain

Symptom: Desktop browsers work (they cache intermediates), but mobile devices, API clients, or `curl` report trust errors.

```bash
# Test the chain
openssl s_client -connect example.com:443 -servername example.com

# Look for this in the output:
# Verify return code: 21 (unable to verify the first certificate)
# This means the intermediate certificate is missing.
```

**Fix**: Use `fullchain.pem` instead of `cert.pem` in your server configuration.

### Expired Certificate

```bash
# Check from the command line
echo | openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -dates
```

**Common cause**: Certbot renewal failed silently. Check `sudo certbot certificates` and `/var/log/letsencrypt/letsencrypt.log`.

### SNI Issues

If the wrong certificate is served, the server may not support Server Name Indication (SNI) or the `server_name` directive doesn't match.

```bash
# Explicitly test with SNI
openssl s_client -connect 1.2.3.4:443 -servername example.com
```

---

```terminal
scenario: "Obtain and configure a Let's Encrypt certificate with Certbot"
steps:
  - command: "sudo certbot certonly --nginx -d mysite.example.com --dry-run"
    output: "Saving debug log to /var/log/letsencrypt/letsencrypt.log\nSimulating renewal of an existing certificate for mysite.example.com\n\nThe dry run was successful."
    narration: "Always do a dry run first. This validates that Certbot can reach Let's Encrypt, your DNS resolves correctly, and your web server configuration is compatible - all without consuming a rate-limited certificate issuance."
  - command: "sudo certbot certonly --nginx -d mysite.example.com"
    output: "Saving debug log to /var/log/letsencrypt/letsencrypt.log\nRequesting a certificate for mysite.example.com\n\nSuccessfully received certificate.\nCertificate is saved at: /etc/letsencrypt/live/mysite.example.com/fullchain.pem\nKey is saved at:         /etc/letsencrypt/live/mysite.example.com/privkey.pem"
    narration: "Issue the real certificate. Certbot uses the HTTP-01 challenge through your existing Nginx server. The certificate and key are stored under /etc/letsencrypt/live/."
  - command: "sudo certbot certificates"
    output: "Certificate Name: mysite.example.com\n  Domains: mysite.example.com\n  Expiry Date: 2026-06-23 (VALID: 89 days)\n  Certificate Path: /etc/letsencrypt/live/mysite.example.com/fullchain.pem\n  Private Key Path: /etc/letsencrypt/live/mysite.example.com/privkey.pem"
    narration: "List all managed certificates. This shows the domain, expiration, and file paths. The certificate is valid for 90 days."
  - command: "openssl x509 -in /etc/letsencrypt/live/mysite.example.com/fullchain.pem -noout -subject -issuer -dates"
    output: "subject=CN = mysite.example.com\nissuer=C = US, O = Let's Encrypt, CN = R11\nnotBefore=Mar 25 12:00:00 2026 GMT\nnotAfter=Jun 23 12:00:00 2026 GMT"
    narration: "Verify the certificate details with OpenSSL. The issuer is Let's Encrypt's intermediate CA (R11), and the validity period confirms the 90-day window."
  - command: "sudo certbot renew --dry-run"
    output: "Processing /etc/letsencrypt/renewal/mysite.example.com.conf\nSimulating renewal of an existing certificate for mysite.example.com\nThe dry run was successful."
    narration: "Test the renewal process. This confirms that when the systemd timer triggers certbot renew in the future, it will work correctly."
  - command: "sudo systemctl status certbot.timer"
    output: "● certbot.timer - Run certbot twice daily\n   Loaded: loaded (/lib/systemd/system/certbot.timer; enabled)\n   Active: active (waiting)\n  Trigger: Tue 2026-03-25 18:23:00 UTC; 5h left"
    narration: "The certbot timer is active and will automatically attempt renewal twice daily. It only actually renews when certificates are within 30 days of expiration."
```

---

## Interactive Quizzes

```quiz
question: "How long are Let's Encrypt certificates valid for before they must be renewed?"
type: multiple-choice
options:
  - text: "30 days"
    feedback: "30 days is the renewal window (Certbot renews within 30 days of expiration), but the certificate itself is valid for 90 days."
  - text: "90 days"
    correct: true
    feedback: "Correct! Let's Encrypt certificates are short-lived (90 days) to encourage automation and minimize the damage window if a key is compromised. Certbot's automatic renewal handles this transparently."
  - text: "1 year"
    feedback: "Commercial certificates often last 1 year, but Let's Encrypt uses 90 days by design."
  - text: "10 years"
    feedback: "Root CA certificates can last 10-20 years, but end-entity certificates are much shorter."
```

```quiz
question: "If clients report 'Untrusted Authority' errors but the certificate is valid, what is the most likely cause?"
type: multiple-choice
options:
  - text: "The private key has expired."
    feedback: "Private keys don't expire. The certificate has an expiration date, not the key."
  - text: "The server is using cert.pem instead of fullchain.pem, missing the intermediate CA certificate."
    correct: true
    feedback: "Correct! Without the intermediate certificate, clients cannot build the trust chain from your certificate to a trusted root CA. Desktop browsers may work because they cache intermediates, but mobile clients, curl, and API clients will fail."
  - text: "The client's clock is wrong."
    feedback: "Clock skew can cause certificate validation failures, but the error message would mention date/time, not 'Untrusted Authority'."
  - text: "Let's Encrypt is not a trusted CA."
    feedback: "Let's Encrypt is trusted by all major browsers and operating systems since 2016."
```

```quiz
question: "Which ACME challenge type is required for wildcard certificates?"
type: multiple-choice
options:
  - text: "HTTP-01"
    feedback: "HTTP-01 proves control of a single server. It cannot verify control of an entire domain zone, which is required for wildcards."
  - text: "DNS-01"
    correct: true
    feedback: "Correct! DNS-01 requires adding a TXT record to the domain's DNS zone, proving control over the entire zone. This is necessary for wildcards because *.example.com covers all subdomains, not just one specific server."
  - text: "TLS-ALPN-01"
    feedback: "TLS-ALPN-01 is an alternative to HTTP-01 for single-domain certificates when port 80 is unavailable."
  - text: "Any challenge type works for wildcards."
    feedback: "Only DNS-01 can be used for wildcard certificates. This is a Let's Encrypt policy based on the need to prove zone-level control."
```

---

```exercise
title: "Set Up Certificate Auto-Renewal with Monitoring"
description: "Configure Certbot renewal with a post-deploy hook and create a monitoring script that alerts when certificates are close to expiration."
requirements:
  - "Create a Certbot deploy hook script that reloads Nginx after renewal"
  - "Make the hook executable and place it in the correct directory"
  - "Write a shell script that checks a domain's certificate expiration and warns if it's within 14 days"
  - "The monitoring script should output the domain, days remaining, and expiration date"
  - "Test the renewal configuration with a dry run"
hints:
  - "Deploy hooks go in /etc/letsencrypt/renewal-hooks/deploy/"
  - "Use openssl s_client to connect and openssl x509 to extract the expiration date"
  - "The date command can convert dates to epoch seconds for arithmetic"
  - "Don't forget to chmod +x your scripts"
solution: |
  # Step 1: Create the deploy hook
  # /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  #!/bin/bash
  systemctl reload nginx
  logger "Certbot: Nginx reloaded after certificate renewal"

  # Make it executable
  # sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

  # Step 2: Create the monitoring script
  # /usr/local/bin/check-cert-expiry.sh
  #!/bin/bash
  DOMAIN="${1:?Usage: $0 <domain>}"
  WARN_DAYS=14

  EXPIRY=$(echo | openssl s_client -connect "$DOMAIN:443" \
    -servername "$DOMAIN" 2>/dev/null \
    | openssl x509 -noout -enddate | cut -d= -f2)

  if [ -z "$EXPIRY" ]; then
      echo "ERROR: Could not connect to $DOMAIN:443"
      exit 2
  fi

  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

  echo "$DOMAIN: $DAYS_LEFT days remaining (expires $EXPIRY)"

  if [ "$DAYS_LEFT" -lt "$WARN_DAYS" ]; then
      echo "WARNING: Certificate expires in less than $WARN_DAYS days!"
      exit 1
  fi

  # sudo chmod +x /usr/local/bin/check-cert-expiry.sh

  # Step 3: Test renewal
  # sudo certbot renew --dry-run

  # Step 4: Add to cron for daily monitoring
  # 0 9 * * * /usr/local/bin/check-cert-expiry.sh example.com | mail -s "Cert Check" admin@example.com
```

---

```command-builder
title: "OpenSSL Certificate Commands"
description: "Build common OpenSSL commands for certificate management."
base: "openssl"
groups:
  - name: "Operation"
    options:
      - label: "Inspect a certificate"
        value: "x509 -in cert.pem -text -noout"
      - label: "Check expiration date"
        value: "x509 -in cert.pem -enddate -noout"
      - label: "Generate RSA private key"
        value: "genrsa -out server.key 4096"
      - label: "Create a CSR"
        value: "req -new -key server.key -out server.csr"
      - label: "Test remote server"
        value: "s_client -connect example.com:443 -servername example.com"
      - label: "Verify certificate chain"
        value: "verify -CAfile ca-bundle.pem cert.pem"
      - label: "Convert PEM to PKCS#12"
        value: "pkcs12 -export -in cert.pem -inkey server.key -out cert.p12"
      - label: "Check cert/key match"
        value: "x509 -noout -modulus -in cert.pem | openssl md5"
```

---

## Further Reading

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/) - how the CA works, rate limits, and best practices
- [Certbot Instructions](https://certbot.eff.org/instructions) - installation and usage guides for every server/OS combination
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/) - free online scanner that grades your TLS configuration
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/) - generates recommended server configurations
- [ACME Protocol (RFC 8555)](https://datatracker.ietf.org/doc/html/rfc8555) - the specification behind Let's Encrypt's automation

---

**Previous:** [TLS/SSL Fundamentals](tls-ssl-fundamentals.md) | [Back to Index](README.md)
