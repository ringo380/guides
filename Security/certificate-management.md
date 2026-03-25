# Certificate Management

Modern certificate management relies heavily on automation. This guide focuses on [**Let's Encrypt**](https://letsencrypt.org/) and [**Certbot**](https://certbot.eff.org/), the tools that revolutionized how the web is secured.

## Let's Encrypt and Certbot

Let's Encrypt is a free, automated, and open certificate authority. To use it, you typically use a client like Certbot to automate the certificate issuance and renewal process.

### Installing Certbot

On most Linux distributions, you can install Certbot via `snap` or your package manager.

```bash
# Ubuntu/Debian example
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

---

## Obtaining a Certificate

Certbot uses **challenges** to prove you control the domain. The two most common are:

1. **HTTP-01 Challenge**: Certbot places a file at a specific path on your web server and Let's Encrypt verifies it.
2. **DNS-01 Challenge**: You add a TXT record to your DNS zone and Let's Encrypt verifies it.

### Automatic Configuration (Nginx/Apache)

If you use Nginx or Apache, Certbot can automatically update your configuration.

```bash
# Obtain and install certificate for Nginx
sudo certbot --nginx -d example.com -d www.example.com
```

### Manual/Standalone Mode

If you don't want Certbot to touch your config files, or you are running a different service:

```bash
# Standalone mode (requires port 80 to be free)
sudo certbot certonly --standalone -d example.com
```

---

## Renewing Certificates

Let's Encrypt certificates are valid for **90 days**. Certbot handles renewal automatically via a cron job or systemd timer.

- **Dry Run**: Verify that renewal works without actually issuing a new cert.
  ```bash
  sudo certbot renew --dry-run
  ```
- **Manual Renewal**:
  ```bash
  sudo certbot renew
  ```

---

## Troubleshooting TLS Errors

When things go wrong, these tools can help identify the issue:

### Certificate Mismatch

Ensure your certificate matches your private key. The modulus of both must be identical.

```bash
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
```

### Chain Issues

If a browser says "Connection is not private" but the certificate is valid, you might be missing the **Intermediate Certificate**.

- **Fix**: Use the `fullchain.pem` provided by Certbot in your server configuration instead of just `cert.pem`.

### Protocol/Cipher Support

Older servers might use insecure protocols (like SSLv3 or TLS 1.0). Use [**SSL Labs Server Test**](https://www.ssllabs.com/ssltest/) to scan your domain for vulnerabilities.

---

## Interactive Quizzes: Certificate Management

Test your practical knowledge.

```quiz
question: "How long are Let's Encrypt certificates valid for before they must be renewed?"
type: multiple-choice
options:
  - text: "30 days"
    feedback: "30 days is too short; the actual validity is 90 days."
  - text: "90 days"
    correct: true
    feedback: "Correct! Let's Encrypt certificates are short-lived (90 days) to encourage automation and minimize the damage if a key is compromised."
  - text: "1 year"
    feedback: "Commercial certificates often last 1 year, but Let's Encrypt uses 90 days."
  - text: "10 years"
    feedback: "Root certificates can last 10 years, but end-entity certificates are much shorter."
```

```quiz
question: "If your server configuration uses `cert.pem` and clients are seeing 'Untrusted Authority' errors, what should you likely use instead?"
type: multiple-choice
options:
  - text: "privkey.pem"
    feedback: "privkey.pem is your secret private key, not for public distribution."
  - text: "csr.pem"
    feedback: "csr.pem is a Certificate Signing Request, used only during issuance."
  - text: "fullchain.pem"
    correct: true
    feedback: "Correct! Most servers need the certificate *plus* the intermediate certificates to establish a path to a trusted root. `fullchain.pem` contains both."
  - text: "root.pem"
    feedback: "Root certificates are already in the browser's trust store. You need the intermediate chain."
```

```quiz
question: "Which Certbot challenge is best if you need to issue a wildcard certificate (e.g., `*.example.com`)?"
type: multiple-choice
options:
  - text: "HTTP-01"
    feedback: "HTTP-01 cannot be used for wildcard certificates with Let's Encrypt."
  - text: "DNS-01"
    correct: true
    feedback: "Correct! Let's Encrypt requires the DNS-01 challenge for wildcard certificates, as it proves control over the entire DNS zone."
  - text: "TLS-ALPN-01"
    feedback: "TLS-ALPN-01 is for specific port 443 challenges, not for wildcards."
  - text: "Wildcard-01"
    feedback: "There is no 'Wildcard-01' challenge; it's just a DNS-01 challenge for a wildcard name."
```

---

## Further Reading

- [**Let's Encrypt Documentation**](https://letsencrypt.org/docs/)  
- [**Certbot Instructions**](https://certbot.eff.org/instructions)  
- [**Electronic Frontier Foundation (EFF)**](https://www.eff.org/)  

---

**Previous:** [TLS/SSL Fundamentals](tls-ssl-fundamentals.md) | [Back to Index](README.md)
