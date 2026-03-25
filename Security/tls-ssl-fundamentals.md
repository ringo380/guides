# TLS/SSL Fundamentals

Understanding the basics of Transport Layer Security (TLS) is critical for any systems administrator. This guide covers Public Key Infrastructure (PKI), the handshake process, and common certificate formats.

## Public Key Infrastructure (PKI)

PKI is a system of processes, technologies, and policies that allow for the secure transfer of information. It relies on **Asymmetric Cryptography**, which uses two different but mathematically related keys:

- **Public Key**: Can be shared with anyone. It is used to encrypt data.
- **Private Key**: Must be kept secret. It is used to decrypt data that was encrypted with the matching public key.

### Certificate Chains

A digital certificate is not just a public key; it is signed by a **Certificate Authority (CA)** to prove its authenticity. Most certificates are part of a chain:

1. **Root CA**: The anchor of trust, pre-installed in browsers and OSs.
2. **Intermediate CA**: Signed by the Root CA, used to sign end-entity certificates (for better security).
3. **End-Entity Certificate**: The certificate used by your server (e.g., `example.com`).

---

## Working with OpenSSL

[**OpenSSL**](https://www.openssl.org/) is the industry-standard tool for managing certificates and keys.

### Generating a Private Key and CSR

To apply for a certificate, you first need a private key and a Certificate Signing Request (CSR).

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out example.key 2048

# Create a CSR using the private key
openssl req -new -key example.key -out example.csr
```

### Inspecting Certificates

You often need to verify the contents of a certificate or check its expiration date.

```bash
# View the details of a certificate
openssl x509 -in cert.pem -text -noout

# Check the expiration date only
openssl x509 -in cert.pem -enddate -noout
```

### Common Certificate Formats

- **PEM (`.pem`, `.crt`, `.key`)**: Base64 encoded ASCII. Most common on Linux/Nginx/Apache.
- **DER (`.der`, `.cer`)**: Binary format. Common in Java and Windows environments.
- **PKCS#12 (`.p12`, `.pfx`)**: A password-protected container that can hold both the certificate and its private key.

---

## Interactive Quizzes: TLS Fundamentals

Test your knowledge of TLS and OpenSSL.

```quiz
question: "What is the purpose of an Intermediate Certificate in a certificate chain?"
type: multiple-choice
options:
  - text: "It replaces the Root Certificate for better performance."
    feedback: "Root certificates are still necessary to anchor the trust chain."
  - text: "It acts as a buffer to avoid using the Root CA's private key for every signature."
    correct: true
    feedback: "Correct! Intermediate CAs allow Root CAs to remain offline and highly secure, as they only sign a few intermediate certificates rather than every end-user certificate."
  - text: "It encrypts the private key on the server."
    feedback: "Encryption of private keys is handled by password protection (e.g., in PKCS#12)."
  - text: "It is used for internal network traffic only."
    feedback: "Intermediate certificates are used for both public and private traffic."
```

```quiz
question: "Which OpenSSL command is used to view the human-readable details of a PEM-encoded certificate?"
type: multiple-choice
options:
  - text: "openssl req -in cert.pem"
    feedback: "The req command is for Certificate Signing Requests (CSRs)."
  - text: "openssl rsa -in cert.pem"
    feedback: "The rsa command is for managing RSA private keys."
  - text: "openssl x509 -in cert.pem -text -noout"
    correct: true
    feedback: "Correct! The `x509` command is for certificate management. `-text` displays the readable version, and `-noout` prevents printing the encoded certificate itself."
  - text: "openssl verify cert.pem"
    feedback: "The verify command checks if a certificate is valid against a trust store, but doesn't show its details."
```

```quiz
question: "If you have a `.key` file and a `.crt` file, which certificate format are you likely using?"
type: multiple-choice
options:
  - text: "DER"
    feedback: "DER is a binary format and doesn't usually use .key or .crt extensions."
  - text: "PEM"
    correct: true
    feedback: "Correct! PEM is a text-based format (Base64 ASCII) typically stored in files with extensions like `.pem`, `.crt`, `.cer`, or `.key`."
  - text: "PKCS#12"
    feedback: "PKCS#12 usually combines the key and cert into a single .p12 or .pfx file."
  - text: "PFX"
    feedback: "PFX is another name for PKCS#12, which stores keys and certs in one file."
```

---

## Further Reading

- [**OpenSSL Official Documentation**](https://www.openssl.org/docs/)  
- [**Mozilla SSL Configuration Generator**](https://ssl-config.mozilla.org/)  
- [**SSL Labs: Best Practices**](https://www.ssllabs.com/projects/best-practices/)  

---

**Next:** [Certificate Management](certificate-management.md) | [Back to Index](README.md)
