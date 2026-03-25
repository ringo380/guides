# Security and TLS/SSL

This section covers essential security practices for system administrators, focusing on certificate management, TLS/SSL termination, and secure communication.

## Guides

- [**TLS/SSL Fundamentals**](tls-ssl-fundamentals.md)  
  Learn about public key infrastructure (PKI), certificate chains, and how to use OpenSSL for common tasks.
- [**Certificate Management**](certificate-management.md)  
  A practical guide to obtaining and managing certificates with Let's Encrypt, Certbot, and common troubleshooting steps.

## Introduction

Transport Layer Security (TLS) is a cryptographic protocol designed to provide communications security over a computer network. It is the successor to Secure Sockets Layer (SSL). In modern web administration, ensuring that all services are encrypted is no longer optional.

### Key Concepts

- **CA (Certificate Authority)**: An entity that issues digital certificates.
- **CSR (Certificate Signing Request)**: A message sent from an applicant to a certificate authority in order to apply for a digital certificate.
- **Root Certificate**: A public key certificate that identifies a root certificate authority.
- **Intermediate Certificate**: A certificate that acts as a link between the root certificate and the end-entity certificate.
- **Private Key**: A secret key that is used to decrypt data and sign certificates; it must never be shared.
