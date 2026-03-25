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

## Interactive Quiz: Certificate Management

Test your practical knowledge.

```quiz
questions:
  - question: "How long are Let's Encrypt certificates valid for before they must be renewed?"
    options:
      - "30 days"
      - "90 days"
      - "1 year"
      - "10 years"
    answer: 1
    explanation: "Let's Encrypt certificates are short-lived (90 days) to encourage automation and minimize the damage if a key is compromised."

  - question: "If your server configuration uses `cert.pem` and clients are seeing 'Untrusted Authority' errors, what should you likely use instead?"
    options:
      - "privkey.pem"
      - "csr.pem"
      - "fullchain.pem"
      - "root.pem"
    answer: 2
    explanation: "Most servers need the certificate *plus* the intermediate certificates to establish a path to a trusted root. `fullchain.pem` contains both."

  - question: "Which Certbot challenge is best if you need to issue a wildcard certificate (e.g., `*.example.com`)?"
    options:
      - "HTTP-01"
      - "DNS-01"
      - "TLS-ALPN-01"
      - "Wildcard-01"
    answer: 1
    explanation: "Let's Encrypt requires the DNS-01 challenge for wildcard certificates, as it proves control over the entire DNS zone."
```

---

## Further Reading

- [**Let's Encrypt Documentation**](https://letsencrypt.org/docs/)  
- [**Certbot Instructions**](https://certbot.eff.org/instructions)  
- [**Electronic Frontier Foundation (EFF)**](https://www.eff.org/)  

---

**Previous:** [TLS/SSL Fundamentals](tls-ssl-fundamentals.md) | [Back to Index](README.md)
