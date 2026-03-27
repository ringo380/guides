---
difficulty: intermediate
time_estimate: "45 min"
prerequisites: []
learning_outcomes:
  - "Configure Nginx server blocks, reverse proxying, and load balancing"
  - "Set up SSL/TLS termination with modern security defaults"
  - "Implement rate limiting and access controls for production deployments"
tags:
  - nginx
  - web-server
  - reverse-proxy
  - configuration
---
# Nginx Configuration

[**Nginx**](https://nginx.org/) is a high-performance HTTP server, reverse proxy, and load balancer. Its event-driven architecture handles thousands of concurrent connections with minimal memory overhead, making it the industry standard for serving static content, terminating TLS, and proxying to application servers.

---

## Configuration Structure

Nginx configuration is hierarchical. The main file is typically `/etc/nginx/nginx.conf`, which includes additional files for organization.

```
/etc/nginx/
├── nginx.conf              # Main config (worker processes, global settings)
├── conf.d/                 # General config snippets (loaded by default)
│   └── default.conf
├── sites-available/        # All virtual host configs (Debian/Ubuntu)
│   ├── default
│   └── example.com
├── sites-enabled/          # Symlinks to active configs
│   └── example.com -> ../sites-available/example.com
├── snippets/               # Reusable config fragments
│   └── ssl-params.conf
└── mime.types              # File extension to MIME type mappings
```

The `sites-available` / `sites-enabled` pattern (common on Debian/Ubuntu) keeps all configurations in one place while controlling which ones are active via symlinks. RHEL-based distributions typically use `conf.d/` exclusively.

!!! tip "Always test before reloading"
    Run `nginx -t` before applying any configuration change. It validates syntax and catches errors like missing semicolons or duplicate `server_name` directives without touching the running server. Reload with `sudo systemctl reload nginx` - reload is graceful (existing connections finish), while restart drops them.

---

## Server Blocks

**Server blocks** are Nginx's equivalent of Apache virtual hosts. Each block defines how Nginx handles requests for a specific domain or IP/port combination.

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /var/www/example.com;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

- **`listen`**: The port (and optionally IP address) to bind. `listen 80` binds to all interfaces on port 80.
- **`server_name`**: Domain names this block handles. Nginx matches the `Host` header from the request against these values.
- **`root`**: The filesystem directory containing the site's files.
- **`index`**: Default files to serve when a directory is requested.
- **`try_files`**: Attempts each path in order. Here it tries the exact URI, then the URI as a directory, then returns 404.

### How Nginx Selects a Server Block

When a request arrives, Nginx first matches the `listen` directive (IP + port), then matches `server_name` against the `Host` header. If no `server_name` matches, it falls back to the `default_server`:

```nginx
server {
    listen 80 default_server;
    server_name _;
    return 444;  # Close connection without response
}
```

This catch-all block drops requests for unknown domains - a basic security measure against scanners probing by IP address.

---

## Location Blocks and Matching

Location blocks define how Nginx handles requests to specific URL paths. The matching rules have a defined precedence:

| Modifier | Type | Priority | Example |
|----------|------|----------|---------|
| `=` | Exact match | 1 (highest) | `location = /health { ... }` |
| `^~` | Prefix (stops search) | 2 | `location ^~ /static/ { ... }` |
| `~` | Regex (case-sensitive) | 3 | `location ~ \.php$ { ... }` |
| `~*` | Regex (case-insensitive) | 3 | `location ~* \.(jpg|png)$ { ... }` |
| (none) | Prefix | 4 (lowest) | `location /api/ { ... }` |

Nginx evaluates locations in this order: exact matches first, then prefix matches (longest wins), then regex matches (first match in config order wins). The `^~` modifier on a prefix match prevents regex locations from overriding it.

```nginx
# Exact match for health checks (fastest - no further searching)
location = /health {
    return 200 "ok";
    add_header Content-Type text/plain;
}

# All static files - ^~ prevents regex locations from overriding
location ^~ /static/ {
    root /var/www;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# API requests proxied to the backend
location /api/ {
    proxy_pass http://localhost:3000;
}

# Everything else
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## Reverse Proxying

As a **reverse proxy**, Nginx sits between client browsers and backend application servers. It handles TLS termination, static file serving, and load distribution while your application focuses on business logic.

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

- **`proxy_pass`**: The backend address. A trailing slash matters: `proxy_pass http://backend/` strips the matched location prefix from the forwarded URI; without the slash, the full URI is forwarded.
- **`proxy_set_header`**: Passes original client information to the backend. Without these headers, the backend sees all requests as coming from 127.0.0.1.
- **Timeouts**: `proxy_connect_timeout` limits how long Nginx waits to establish a connection. `proxy_read_timeout` limits how long it waits for a response.

### WebSocket Proxying

WebSocket connections require Nginx to upgrade the HTTP connection:

```nginx
location /ws/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;  # Keep alive for up to 1 hour
}
```

---

## Load Balancing

The `upstream` block distributes requests across multiple backend servers.

```nginx
upstream api_servers {
    least_conn;  # Send to the server with fewest active connections
    server 10.0.0.1:3000 weight=3;
    server 10.0.0.2:3000;
    server 10.0.0.3:3000 backup;  # Only used if others are down
}

server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Load balancing algorithms:

| Algorithm | Directive | Behavior |
|-----------|-----------|----------|
| Round robin | (default) | Distributes requests evenly in order |
| Least connections | `least_conn` | Sends to the server with fewest active connections |
| IP hash | `ip_hash` | Routes the same client IP to the same server (session persistence) |
| Hash | `hash $request_uri` | Routes by a custom key (e.g., URI, cookie) |

---

## SSL/TLS Termination

Handling TLS at the Nginx layer is more efficient than doing it in the application. Nginx manages certificate negotiation and encryption while forwarding plain HTTP to the backend.

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Modern TLS configuration (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS - tell browsers to always use HTTPS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The first server block redirects all HTTP traffic to HTTPS. The second handles encrypted connections with modern cipher suites.

---

## Security Headers

A well-configured Nginx adds security headers that instruct browsers to enable protections against common attacks.

```nginx
# Add these in the server or http block
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

| Header | Purpose |
|--------|---------|
| `X-Frame-Options` | Prevents clickjacking by controlling iframe embedding |
| `X-Content-Type-Options` | Stops browsers from MIME-sniffing responses |
| `Strict-Transport-Security` | Forces HTTPS for the specified duration |
| `Content-Security-Policy` | Controls which sources can load scripts, styles, and other resources |
| `Referrer-Policy` | Controls how much URL information is sent in the Referer header |

!!! danger "Hide server version information"
    By default, Nginx exposes its version in response headers (`Server: nginx/1.25.3`) and error pages. Attackers use this to find known vulnerabilities for specific versions. Add `server_tokens off;` in the `http` block to suppress the version number.

---

## Rate Limiting

Rate limiting protects your application from brute-force attacks, credential stuffing, and abusive clients. Nginx uses a **leaky bucket** algorithm to control request rates.

```nginx
# Define the zone in the http block (10MB shared memory, 10 requests/second)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Stricter limit for authentication endpoints
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=1r/s;

server {
    listen 80;
    server_name example.com;

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }

    location /login {
        limit_req zone=login_limit burst=3;
        limit_req_status 429;
        proxy_pass http://localhost:3000;
    }
}
```

- **`limit_req_zone`**: Creates a shared memory zone that tracks request rates per key (usually client IP). 10MB stores about 160,000 IP addresses.
- **`burst`**: Allows short bursts above the rate limit. Excess requests queue up.
- **`nodelay`**: Processes queued burst requests immediately instead of spacing them out.
- **`limit_req_status`**: Sets the HTTP status code for rejected requests (default 503, but 429 Too Many Requests is more correct).

---

## Logging

Nginx produces two log types: **access logs** (one line per request) and **error logs** (server-side problems).

```nginx
# Custom log format with timing information
log_format detailed '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    'rt=$request_time urt=$upstream_response_time';

server {
    access_log /var/log/nginx/example.access.log detailed;
    error_log /var/log/nginx/example.error.log warn;

    # Disable logging for health checks (reduces noise)
    location = /health {
        access_log off;
        return 200 "ok";
    }
}
```

Key timing variables:
- `$request_time`: Total time from first client byte to last response byte (includes backend processing).
- `$upstream_response_time`: Time the backend took to respond. If this is high but `$request_time` is similar, the bottleneck is your application, not Nginx.

---

## Gzip Compression

Compression reduces bandwidth and speeds up page loads, especially for text-based assets.

```nginx
# In the http block
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 4;
gzip_min_length 256;
gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/xml
    image/svg+xml;
```

- **`gzip_vary`**: Adds `Vary: Accept-Encoding` so caches store compressed and uncompressed versions separately.
- **`gzip_comp_level`**: 1-9 (higher = smaller files, more CPU). Level 4-6 is the sweet spot for most workloads.
- **`gzip_min_length`**: Skip compression for tiny responses where the overhead isn't worth it.
- **`gzip_types`**: Only compress text-based formats. Images like JPEG and PNG are already compressed.

---

## Putting It Together: Production Configuration

```code-walkthrough
title: "Production Nginx Configuration"
description: "A complete reverse proxy configuration with TLS, security headers, rate limiting, and logging."
code: |
  server_tokens off;

  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

  upstream backend {
      least_conn;
      server 127.0.0.1:3000;
      server 127.0.0.1:3001;
  }

  server {
      listen 80;
      server_name example.com;
      return 301 https://$host$request_uri;
  }

  server {
      listen 443 ssl http2;
      server_name example.com;

      ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
      ssl_protocols       TLSv1.2 TLSv1.3;

      add_header Strict-Transport-Security "max-age=63072000" always;
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;

      location /api/ {
          limit_req zone=api burst=20 nodelay;
          proxy_pass http://backend;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      location /login {
          limit_req zone=login burst=3;
          limit_req_status 429;
          proxy_pass http://backend;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
      }

      location /static/ {
          root /var/www;
          expires 30d;
          add_header Cache-Control "public, immutable";
      }

      location = /health {
          access_log off;
          return 200 "ok";
      }
  }
annotations:
  - line: 1
    text: "Hides the Nginx version from response headers and error pages. Reduces information leakage to attackers."
  - line: 3
    text: "Two rate limit zones: a general API limit (10 req/s) and a strict login limit (1 req/s). The 10m zone stores ~160K client IPs."
  - line: 6
    text: "An upstream block with two backend servers. least_conn routes each request to the server with the fewest active connections."
  - line: 12
    text: "HTTP server block that redirects everything to HTTPS. The 301 tells browsers to remember the redirect permanently."
  - line: 18
    text: "The main HTTPS server block. http2 enables HTTP/2 for better performance (multiplexing, header compression)."
  - line: 24
    text: "Modern TLS: only TLSv1.2 and 1.3. Older protocols (SSLv3, TLSv1.0, TLSv1.1) have known vulnerabilities."
  - line: 26
    text: "HSTS tells browsers to always use HTTPS for this domain. max-age is in seconds (63072000 = 2 years)."
  - line: 30
    text: "API routes get the general rate limit with a burst of 20. nodelay processes burst requests immediately instead of queuing."
  - line: 39
    text: "Login gets an aggressive rate limit (1/s, burst 3) to slow brute-force attacks. Returns 429 instead of the default 503."
  - line: 47
    text: "Static files served directly from disk with a 30-day cache. 'immutable' tells browsers not to revalidate during the cache period."
  - line: 53
    text: "Health check endpoint for load balancers. access_log off prevents it from flooding logs with noise."
```

---

```terminal
scenario: "Set up an Nginx reverse proxy for a Node.js application"
steps:
  - command: "sudo apt install nginx"
    output: "Reading package lists... Done\nSetting up nginx (1.24.0-2ubuntu1) ..."
    narration: "Install Nginx from the distribution's package repository."
  - command: "sudo nginx -v"
    output: "nginx version: nginx/1.24.0"
    narration: "Verify the installation and check the installed version."
  - command: "cat /etc/nginx/sites-available/myapp"
    output: "server {\n    listen 80;\n    server_name myapp.example.com;\n\n    location / {\n        proxy_pass http://localhost:3000;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}"
    narration: "Create a server block configuration for the application. Requests to myapp.example.com are proxied to the Node.js app running on port 3000."
  - command: "sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/"
    output: ""
    narration: "Enable the site by creating a symlink in sites-enabled. This is the Debian/Ubuntu convention for activating configurations."
  - command: "sudo nginx -t"
    output: "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful"
    narration: "Always test the configuration before reloading. This catches syntax errors and duplicate server_name conflicts without affecting the running server."
  - command: "sudo systemctl reload nginx"
    output: ""
    narration: "Reload Nginx to apply the new configuration. Reload is graceful - existing connections are not dropped."
  - command: "curl -I http://myapp.example.com"
    output: "HTTP/1.1 200 OK\nServer: nginx\nContent-Type: text/html; charset=utf-8\nX-Powered-By: Express"
    narration: "The reverse proxy is working. Nginx receives the request and forwards it to the Node.js backend. The X-Powered-By header from Express confirms the backend is responding."
```

---

## Interactive Quizzes

```quiz
question: "Which location modifier has the highest matching priority?"
type: multiple-choice
options:
  - text: "~ (regex)"
    feedback: "Regex matches have lower priority than exact and ^~ prefix matches."
  - text: "^~ (prefix, stop search)"
    feedback: "^~ has second-highest priority. It prevents regex from overriding a prefix match, but exact (=) still wins."
  - text: "= (exact match)"
    correct: true
    feedback: "Correct! The = modifier matches only if the request URI is exactly equal to the specified string. It's the fastest match and has the highest priority."
  - text: "(none) regular prefix"
    feedback: "Plain prefix matches have the lowest priority. They can be overridden by regex matches."
```

```quiz
question: "What does `proxy_pass http://backend/` (with trailing slash) do differently from `proxy_pass http://backend` (without)?"
type: multiple-choice
options:
  - text: "Nothing - they are identical."
    feedback: "The trailing slash changes URI handling significantly."
  - text: "The trailing slash strips the matched location prefix from the forwarded URI."
    correct: true
    feedback: "Correct! With location /api/ and proxy_pass http://backend/, a request to /api/users is forwarded as /users. Without the slash, it's forwarded as /api/users. This is one of the most common sources of Nginx proxy bugs."
  - text: "The trailing slash enables HTTPS."
    feedback: "HTTPS is configured with ssl directives, not proxy_pass syntax."
  - text: "The trailing slash adds a port number."
    feedback: "Port numbers are specified explicitly in the URL, not implied by a trailing slash."
```

```quiz
question: "Why should you run `nginx -t` before `systemctl reload nginx`?"
type: multiple-choice
options:
  - text: "It's required by Nginx to unlock the reload command."
    feedback: "There's no locking mechanism - you can reload without testing. But testing first is a critical best practice."
  - text: "It validates the configuration syntax without affecting the running server."
    correct: true
    feedback: "Correct! nginx -t checks all configuration files for syntax errors and logical issues (like conflicting server names). If the test fails, you fix the error before reloading. Without this step, a bad reload can take your sites offline."
  - text: "It optimizes the configuration for faster reloading."
    feedback: "nginx -t only validates - it doesn't optimize or transform the configuration."
  - text: "It creates a backup of the current configuration."
    feedback: "nginx -t doesn't create backups. Use version control for configuration management."
```

---

```exercise
title: "Configure Nginx for a Multi-Application Setup"
scenario: |
  You are configuring Nginx for a company that has a static marketing site and an API backend on the same domain. Write the Nginx configuration to:

  1. Redirect all HTTP traffic to HTTPS
  2. Serve static files from `/var/www/marketing` at the root location with 7-day cache headers
  3. Proxy `/api/` requests to a backend running on `localhost:4000`
  4. Add rate limiting to `/api/auth/` at 2 requests per second with a burst of 5
  5. Include security headers: `X-Frame-Options`, `X-Content-Type-Options`, and HSTS
  6. Add a health check endpoint at `/health` that returns 200 with logging disabled
hints:
  - "Define the limit_req_zone in the http context (outside the server block) - you can put it in a separate conf.d/rate-limit.conf file"
  - "Use expires 7d and add_header Cache-Control 'public' for static file caching"
  - "Remember proxy_set_header directives to forward the real client IP to the backend"
  - "Place the = /health location first - exact matches are evaluated before prefix and regex matches regardless of order, but putting them first improves readability"
solution: |
  # /etc/nginx/conf.d/rate-limit.conf
  limit_req_zone $binary_remote_addr zone=auth:10m rate=2r/s;

  # /etc/nginx/sites-available/marketing
  server {
      listen 80;
      server_name example.com;
      return 301 https://$host$request_uri;
  }

  server {
      listen 443 ssl http2;
      server_name example.com;

      ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
      ssl_protocols       TLSv1.2 TLSv1.3;

      # Security headers
      add_header Strict-Transport-Security "max-age=63072000" always;
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;

      # Health check (no logging)
      location = /health {
          access_log off;
          return 200 "ok";
          add_header Content-Type text/plain;
      }

      # Rate-limited auth endpoint
      location /api/auth/ {
          limit_req zone=auth burst=5;
          limit_req_status 429;
          proxy_pass http://localhost:4000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # API proxy
      location /api/ {
          proxy_pass http://localhost:4000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # Static marketing site
      location / {
          root /var/www/marketing;
          index index.html;
          try_files $uri $uri/ =404;
          expires 7d;
          add_header Cache-Control "public";
      }
  }
```

---

## Further Reading

- [Nginx Documentation](https://nginx.org/en/docs/) - official reference for all directives and modules
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/) - generates secure TLS configurations for Nginx, Apache, and other servers
- [Nginx Admin's Handbook](https://github.com/trimstray/nginx-admins-handbook) - community-maintained guide covering performance tuning and security hardening
- [Let's Encrypt / Certbot](https://certbot.eff.org/) - free TLS certificates with automated Nginx configuration

---

[Back to Index](README.md)
