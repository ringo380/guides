# Security and TLS/SSL

This section covers essential security practices for system administrators, focusing on certificate management, TLS/SSL termination, and secure communication.

## Guides

<div class="topic-progression">
<a class="topic-card" href="tls-ssl-fundamentals/" data-guide="tls-ssl-fundamentals" data-topic="Security">
<span class="topic-card__number">1</span>
<span class="topic-card__badge">Start Here</span>
<div class="topic-card__body">
<div class="topic-card__title">TLS/SSL Fundamentals</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Public key infrastructure, certificate chains, the TLS handshake, and using OpenSSL for common tasks.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="certificate-management/" data-guide="certificate-management" data-topic="Security">
<span class="topic-card__number">2</span>
<div class="topic-card__body">
<div class="topic-card__title">Certificate Management</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Obtaining and renewing certificates with Let's Encrypt and Certbot, building internal CAs, and troubleshooting failures.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
</div>

## Introduction

Transport Layer Security (TLS) is a cryptographic protocol designed to provide communications security over a computer network. It is the successor to Secure Sockets Layer (SSL). In modern web administration, ensuring that all services are encrypted is no longer optional.

### Key Concepts

- **CA (Certificate Authority)**: An entity that issues digital certificates.
- **CSR (Certificate Signing Request)**: A message sent from an applicant to a certificate authority in order to apply for a digital certificate.
- **Root Certificate**: A public key certificate that identifies a root certificate authority.
- **Intermediate Certificate**: A certificate that acts as a link between the root certificate and the end-entity certificate.
- **Private Key**: A secret key that is used to decrypt data and sign certificates; it must never be shared.
