# Nginx Configuration

Nginx is a high-performance HTTP server, reverse proxy, and load balancer. Its event-driven architecture allows it to handle thousands of concurrent connections with minimal memory overhead, making it the industry standard for serving static content and proxying to application servers.

---

## Server Blocks (Virtual Hosts)

Nginx uses **server blocks** to host multiple domains on a single IP address. Each block defines how Nginx should respond to requests for a specific domain name or port.

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

- **`listen`**: The port Nginx should monitor for incoming connections.
- **`server_name`**: The domain names this block should respond to.
- **`root`**: The directory on the filesystem containing the static files.
- **`index`**: The default file to serve if a directory is requested.

---

## Reverse Proxying

As a **reverse proxy**, Nginx sits between client browsers and backend application servers (like Node.js, Python/Django, or Go). It handles client connections and forwards requests to the appropriate backend.

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
    }
}
```

- **`proxy_pass`**: Specifies the backend server address.
- **`proxy_set_header`**: Forwards original client headers (like IP and protocol) so the backend knows who the actual client is.

---

## SSL/TLS Termination

Handling SSL/TLS at the Nginx layer is more efficient than doing it in the application. Modern Nginx configurations should always redirect HTTP to HTTPS and use strong encryption settings.

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

    # Modern SSL configuration (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        root /var/www/example.com;
    }
}
```

---

## Rate Limiting

Rate limiting protects your application from abuse, brute-force attacks, and DDoS. Nginx uses **leaky bucket** algorithms to control the rate of incoming requests.

```nginx
# Define the limit zone (10MB shared memory, 1 request per second)
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=1r/s;

server {
    listen 80;
    server_name example.com;

    location /login {
        # Apply the limit with a burst of 5
        limit_req zone=mylimit burst=5 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

- **`limit_req_zone`**: Sets up the memory zone to track client IP addresses.
- **`burst`**: Allows clients to exceed the rate for a short period.
- **`nodelay`**: Processes burst requests immediately instead of queuing them.

---

```quiz
title: Nginx Configuration Quiz
questions:
  - question: "Which directive is used to host multiple domains on a single IP address?"
    options:
      - text: "proxy_pass"
      - text: "server_name"
      - text: "listen"
      - text: "root"
    answer: 1
    explanation: "The `server_name` directive tells Nginx which domain names a specific server block should handle."
  - question: "What is the purpose of the `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` directive?"
    options:
      - text: "To encrypt the request"
      - text: "To speed up the connection"
      - text: "To pass the original client's IP address to the backend"
      - text: "To set the domain name"
    answer: 2
    explanation: "`X-Forwarded-For` is a standard header used by proxies to tell the backend server the IP address of the original client."
  - question: "In rate limiting, what does the `burst` parameter do?"
    options:
      - text: "It completely blocks the user if they exceed the limit"
      - text: "It allows a certain number of requests to exceed the base rate"
      - text: "It resets the limit every minute"
      - text: "It increases the bandwidth"
    answer: 1
    explanation: The `burst` parameter defines how many requests beyond the rate limit a client can make before they are rejected.
```

---

## Further Reading

- [Official Nginx Documentation](https://nginx.org/en/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt / Certbot](https://certbot.eff.org/)

---

**Next:** [Back to Index](README.md)
