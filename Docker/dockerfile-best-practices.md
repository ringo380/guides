---
difficulty: intermediate
time_estimate: "45 min"
prerequisites:
  - fundamentals
learning_outcomes:
  - "Design multi-stage Dockerfiles that separate build tooling from minimal production images"
  - "Apply layer ordering and caching strategies to reduce build times from minutes to seconds"
  - "Harden container images using non-root users, read-only filesystems, and vulnerability scanning"
  - "Write .dockerignore files that prevent secrets and bloat from entering the build context"
tags:
  - docker
  - containers
  - security
  - devops
  - performance
---

# Dockerfile Best Practices

The [fundamentals guide](fundamentals.md) covered what Dockerfile instructions do. This guide covers how to use them well - producing images that are small, fast to build, secure, and ready for production. Every pattern here comes from real-world Dockerfiles running in production environments.

You will start with a naive Dockerfile and progressively optimize it, measuring the impact of each change along the way.

---

## Measuring What Matters

Before optimizing anything, you need a baseline. Three metrics define Dockerfile quality: **image size**, **build time**, and **layer efficiency**.

### Image Size

The simplest check is `docker images`:

```bash
docker images myapp
```

```
REPOSITORY   TAG       IMAGE ID       CREATED          SIZE
myapp        latest    a1b2c3d4e5f6   10 seconds ago   1.18GB
```

That SIZE column is uncompressed. When you push to a registry, layers are compressed individually - the transfer size is smaller, but the uncompressed size is what consumes disk on every host that pulls the image.

### Layer History

Every instruction in a Dockerfile creates a layer. You can inspect what each layer added with `docker history`:

```bash
docker history myapp:latest
```

```
IMAGE          CREATED          CREATED BY                                      SIZE
a1b2c3d4e5f6   10 seconds ago   CMD ["node" "server.js"]                        0B
<missing>      10 seconds ago   COPY . .                                        4.2MB
<missing>      15 seconds ago   RUN npm install                                 285MB
<missing>      2 minutes ago    COPY package*.json ./                           112kB
<missing>      2 minutes ago    WORKDIR /app                                    0B
<missing>      3 days ago       /bin/sh -c #(nop)  ENV NODE_ENV=production      0B
<missing>      3 days ago       ...                                             891MB
```

That last 891 MB layer is the base image. The `npm install` layer adds another 285 MB. These are your optimization targets.

### Dive

[**Dive**](https://github.com/wagoodman/dive) is a tool that lets you explore each layer interactively, showing exactly which files were added, modified, or removed. It also calculates an efficiency score - how much wasted space exists from files added in one layer and deleted in a later one.

```bash
dive myapp:latest
```

Dive reveals problems that `docker history` hides. A layer might show 50 MB, but if a previous layer added 200 MB of build tools that a later layer tried to `rm -rf`, those 200 MB are still in the image. Each layer is immutable - deleting files in a later layer only masks them, it does not reclaim space.

### The Starting Point

Here is the Dockerfile you will optimize throughout this guide. It builds a Node.js web application:

```dockerfile
FROM node:22
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

This works. It also produces a 1.18 GB image, rebuilds all dependencies on every code change, runs as root, and sends your entire project directory (including `node_modules`, `.git`, and `.env`) into the build context. Every section that follows addresses one of these problems.

!!! info "BuildKit is the default"
    All examples in this guide assume [**BuildKit**](https://docs.docker.com/build/buildkit/), which has been the default builder since Docker 23.0. If you are on an older version, set `DOCKER_BUILDKIT=1` before running `docker build`.

---

## Choosing the Right Base Image

The base image is the single largest contributor to final image size. Choosing the right one is the highest-leverage optimization you can make.

### Base Image Variants

Most official images on Docker Hub publish several variants:

| Variant | Example | Size | What's Included |
|---------|---------|------|-----------------|
| Full | `node:22` | ~1.1 GB | Debian with build tools, compilers, system libraries |
| Slim | `node:22-slim` | ~240 MB | Minimal Debian - runtime deps only, no compilers |
| Alpine | `node:22-alpine` | ~140 MB | Alpine Linux with musl libc, BusyBox utilities |
| Distroless | `gcr.io/distroless/nodejs22-debian12` | ~130 MB | No shell, no package manager, just the runtime |
| Scratch | `scratch` | 0 B | Empty filesystem - you bring everything |

!!! warning "Alpine compatibility"
    Alpine Linux uses **musl libc** instead of glibc. Some Node.js native modules (bcrypt, sharp, prisma), Python C extensions, and pre-built binaries fail on Alpine. If you hit segfaults or build failures, switch to a slim image - it uses glibc and has fewer surprises. Always test your application on Alpine before committing to it.

### Version Pinning

Always pin your base image to a specific version:

```dockerfile
# Bad - pulls whatever "latest" points to today
FROM node:latest

# Better - pins the major version
FROM node:22-slim

# Best - pins the exact release
FROM node:22.14-slim
```

Unpinned tags create builds that work on Tuesday and break on Thursday when the upstream image updates. Pinning to a specific release gives you reproducible builds and a clear audit trail for security reviews. When you are ready to update, you make a deliberate change to the version number and test the result.

### When to Use Each Variant

**Full images** (`node:22`) - Use only in build stages where you need compilers and system headers. Never use as your production runtime base.

**Slim images** (`node:22-slim`) - The default choice for most production workloads. They include glibc and enough of Debian to run standard applications without compatibility surprises.

**Alpine images** (`node:22-alpine`) - Good for simple applications with no native dependencies. The size savings over slim is meaningful (100 MB) but comes with musl compatibility risk.

**Distroless images** (`gcr.io/distroless/...`) - Ideal for production when you want no shell access in the container. Reduces attack surface dramatically. Debugging requires [ephemeral debug containers](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/#ephemeral-container) or a separate debug image.

**Scratch** (`scratch`) - For statically compiled binaries (Go, Rust). The final image contains only your binary and whatever files you `COPY` in. Nothing else.

Switching our example from `node:22` to `node:22-slim` drops the image from 1.18 GB to roughly 350 MB - a 70% reduction from a single line change.

---

## Layer Ordering and Cache Optimization

Docker caches each layer. When you rebuild, Docker reuses cached layers until it hits one where the input changed - then it rebuilds that layer and every layer after it. The order of your instructions directly controls how much of the cache survives each rebuild.

### The Cache Invalidation Rule

When any input to a layer changes, that layer and all layers below it in the Dockerfile are rebuilt from scratch. This means:

- Changing a `COPY` source file invalidates that COPY layer and everything after it
- Changing a `RUN` command (even whitespace) invalidates that layer and everything after it
- Changing a build argument used in a layer invalidates that layer and everything after it

The optimization strategy is straightforward: put things that change rarely at the top, and things that change frequently at the bottom.

### The Dependency-First Pattern

The most impactful cache optimization is copying dependency manifests before source code. This way, `npm install` (or equivalent) only reruns when dependencies actually change - not on every code edit.

**Node.js:**

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

**Python:**

```dockerfile
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

**Go:**

```dockerfile
COPY go.mod go.sum ./
RUN go mod download
COPY . .
```

**Rust:**

```dockerfile
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
COPY . .
RUN cargo build --release
```

**Java (Gradle):**

```dockerfile
COPY build.gradle settings.gradle ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon
COPY . .
```

In our running example, this single reordering means that editing `server.js` no longer triggers a full `npm install`. Rebuild time for a code change drops from minutes to seconds.

### Combining vs Splitting RUN Instructions

Each `RUN` instruction creates a layer. Combining commands reduces layer count and avoids a common trap - files created in one layer and deleted in the next are still stored in the image.

```dockerfile
# Bad - deleted files persist in the first layer
RUN apt-get update && apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# Good - cleanup happens in the same layer
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

But there is a tradeoff. Splitting RUN instructions gives you more granular caching. If you install system packages and application dependencies in separate RUN instructions, changing an app dependency does not re-download system packages.

The rule of thumb: combine commands that must be atomic (install + cleanup), split commands that change at different frequencies (system packages vs app dependencies).

### BuildKit Cache Mounts

[**BuildKit cache mounts**](https://docs.docker.com/build/cache/optimize/#use-cache-mounts) let you persist package manager caches between builds without including them in the final image. This is the best of both worlds - fast rebuilds and small images.

```dockerfile
# apt cache survives across builds
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt/lists \
    apt-get update && apt-get install -y --no-install-recommends build-essential

# npm cache survives across builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# pip cache survives across builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

The cached directories are stored on the build host, not in any image layer. Subsequent builds reuse downloaded packages without re-fetching from the network. This is especially valuable in CI where cold dependency installs are a major bottleneck.

```quiz
title: Layer Caching
questions:
  - question: "Your Dockerfile copies package.json, runs npm ci, then copies the rest of the source code. You change a single line in index.js. What gets rebuilt?"
    options:
      - text: "All layers from FROM onward"
        correct: false
        explanation: "Docker reuses cached layers up to the first change. The FROM, COPY package.json, and RUN npm ci layers are all unchanged."
      - text: "Only the COPY . . layer and everything after it"
        correct: true
        explanation: "The COPY . . layer detects changed source files, invalidating it and all subsequent layers. The dependency install layer is cached because package.json and package-lock.json have not changed."
      - text: "Nothing - Docker detects that dependencies have not changed"
        correct: false
        explanation: "The COPY . . layer copies all source files. Since index.js changed, this layer is invalidated. Docker does not analyze which files matter to which commands."
      - text: "Only the CMD layer"
        correct: false
        explanation: "CMD is rebuilt because it comes after the invalidated COPY layer. But the COPY layer itself is also rebuilt."
  - question: "You have a RUN instruction that installs curl with apt-get, followed by a separate RUN instruction that removes the apt cache. Does removing the cache in a separate layer reclaim disk space in the final image?"
    options:
      - text: "Yes - the deletion removes the files from the image"
        correct: false
        explanation: "Each layer is immutable. Deleting files in a later layer masks them in the union filesystem but does not remove them from the stored layers. The image still contains the full apt cache."
      - text: "No - files added in one layer persist even if deleted in a later layer"
        correct: true
        explanation: "Docker image layers are append-only. A deletion in layer N creates a 'whiteout' marker that hides the file, but the data remains in layer N-1. Cleanup must happen in the same RUN instruction as the install."
      - text: "Only if you use the --squash flag"
        correct: false
        explanation: "The --squash flag does merge all layers, but it is experimental, breaks layer sharing between images, and is not a substitute for writing efficient Dockerfiles."
```

---

## Multi-Stage Builds in Depth

The [fundamentals guide](fundamentals.md) introduced multi-stage builds with a two-stage pattern: build in one stage, copy the result into a smaller runtime stage. This section covers advanced patterns that make multi-stage builds a central part of your CI/CD workflow.

### Named Stages

Giving each stage a name makes the Dockerfile readable and enables targeting specific stages with `--target`:

```dockerfile
FROM node:22 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM build AS test
RUN npm run test

FROM node:22-slim AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

In CI, you can stop at any stage:

```bash
# Run tests only - don't build the production image
docker build --target test -t myapp:test .

# Build the production image (test stage runs as part of the build)
docker build --target production -t myapp:latest .
```

If the test stage fails, the build fails. Broken code never reaches the production image.

### Language-Specific Patterns

**Python** - Build wheels in a builder stage, install them in the runtime stage. No pip, no gcc, no header files in production:

```dockerfile
FROM python:3.13 AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
COPY . .
USER nobody
CMD ["gunicorn", "app:app", "-b", "0.0.0.0:8000"]
```

**Go** - Static binaries go straight to scratch. No runtime, no shell, no attack surface:

```dockerfile
FROM golang:1.24 AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server .

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /server /server
USER 65534
ENTRYPOINT ["/server"]
```

The `-ldflags="-s -w"` strips debug symbols and DWARF tables, reducing the binary size by 20-30%. Copying CA certificates from the builder enables HTTPS connections from the scratch container.

**Rust** - Similar to Go, static linking produces a standalone binary:

```dockerfile
FROM rust:1.85 AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
COPY --from=build /app/target/release/myapp /usr/local/bin/
USER nobody
CMD ["myapp"]
```

The dummy `main.rs` trick caches dependency compilation. When the real source is copied, only your code is recompiled.

### Copying from External Images

`COPY --from` is not limited to stages in your Dockerfile. You can copy files from any published image:

```dockerfile
# Grab a specific binary from another image
COPY --from=busybox:1.36-musl /bin/wget /usr/local/bin/wget

# Grab configuration from an official image
COPY --from=nginx:1.27-alpine /etc/nginx/nginx.conf /etc/nginx/nginx.conf
```

This is useful when you need a single utility in your production image without installing an entire package.

```code-walkthrough
title: Production Node.js Multi-Stage Dockerfile
description: A four-stage Dockerfile that separates dependency installation, building, testing, and production runtime.
language: dockerfile
code: |
  FROM node:22 AS deps
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm ci

  FROM deps AS build
  COPY tsconfig.json ./
  COPY src ./src
  RUN npm run build

  FROM build AS test
  RUN npm run test

  FROM node:22-slim AS production
  ENV NODE_ENV=production
  WORKDIR /app
  RUN addgroup --system --gid 1001 appgroup \
      && adduser --system --uid 1001 --ingroup appgroup appuser
  COPY --from=deps /app/node_modules ./node_modules
  COPY --from=build /app/dist ./dist
  COPY package.json ./
  RUN npm prune --omit=dev
  USER appuser
  EXPOSE 3000
  HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })"]
  CMD ["node", "dist/server.js"]
annotations:
  - line: 1
    text: "The deps stage uses the full Node.js image because npm ci may need to compile native modules. Named stages make COPY --from references readable."
  - line: 4
    text: "npm ci installs exact versions from package-lock.json and removes any existing node_modules first - safer and faster than npm install for CI/CD."
  - line: 6
    text: "The build stage inherits from deps, so node_modules is already available. Only TypeScript config and source code are copied - not the entire project."
  - line: 9
    text: "TypeScript compilation happens here. The build output goes to dist/. This stage has access to devDependencies (typescript, build tools) that production does not need."
  - line: 11
    text: "The test stage inherits from build, running tests against the compiled output. If tests fail, 'docker build --target production' never completes."
  - line: 14
    text: "The production stage starts fresh from node:22-slim - no compilers, no TypeScript, no test frameworks. Only ~240 MB of base image instead of 1.1 GB."
  - line: 17
    text: "A dedicated non-root user and group. Created with explicit UID/GID for consistency across container restarts and orchestrators."
  - line: 22
    text: "npm prune --omit=dev removes devDependencies from the copied node_modules, shrinking it significantly. Only production dependencies remain."
  - line: 23
    text: "USER switches to the non-root user. Every command after this line runs as appuser, including CMD."
  - line: 25
    text: "HEALTHCHECK tells Docker (and orchestrators like Kubernetes) how to verify the container is serving traffic. The --retries flag allows brief transient failures."
```

---

## Minimizing Image Size

Base image selection and multi-stage builds handle the bulk of size reduction. This section covers the remaining techniques that shave off the last hundred megabytes and keep images lean over time.

### Clean Up in the Same Layer

Package managers download caches, indexes, and temporary files during installation. These must be removed in the same `RUN` instruction - deleting them in a later layer does not reclaim space.

**apt (Debian/Ubuntu):**

```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

The `--no-install-recommends` flag skips suggested and recommended packages, which often include documentation, man pages, and utilities you do not need.

**apk (Alpine):**

```dockerfile
RUN apk add --no-cache curl ca-certificates
```

Alpine's `--no-cache` flag fetches the index, installs packages, and discards the index in one operation.

### Dependency Manager Flags

Every package manager has flags to skip caching:

```dockerfile
# Python - skip the pip download cache
RUN pip install --no-cache-dir -r requirements.txt

# Node.js - install production deps only
RUN npm ci --omit=dev

# Go - vendor dependencies to avoid downloading at build time
RUN go mod vendor
```

### Comprehensive .dockerignore

A `.dockerignore` file works exactly like `.gitignore` but for the build context. Without one, `docker build` sends your entire project directory to the Docker daemon - including `node_modules`, `.git`, test fixtures, IDE files, and potentially secrets.

Here is a comprehensive `.dockerignore` for a Node.js project:

```text
# Dependencies - installed fresh in the image
node_modules

# Build artifacts
dist
build

# Version control
.git
.gitignore

# IDE and editor files
.vscode
.idea
*.swp
*.swo

# Test and development files
coverage
*.test.js
*.spec.js
__tests__
.nyc_output

# Docker files - no need inside the image
Dockerfile*
docker-compose*.yml
.dockerignore

# Environment and secrets
.env
.env.*
*.pem
*.key

# Documentation
README.md
LICENSE
docs
```

For Python:

```text
__pycache__
*.pyc
*.pyo
.venv
venv
.git
.pytest_cache
.mypy_cache
htmlcov
*.egg-info
dist
build
.env
*.pem
```

For Go:

```text
.git
vendor
*_test.go
.env
README.md
docs
```

The impact of `.dockerignore` is twofold: it reduces the build context sent to the daemon (faster builds), and it prevents sensitive files from accidentally ending up in the image.

### Measuring Progress

Applying these techniques to our running example progressively reduces the image:

| Optimization | Image Size | Reduction |
|-------------|-----------|-----------|
| `FROM node:22` (baseline) | 1.18 GB | - |
| Switch to `node:22-slim` | 350 MB | -70% |
| Add `.dockerignore` | 345 MB | -1% (faster builds) |
| Dependency-first ordering | 345 MB | No size change (faster rebuilds) |
| Multi-stage build | 210 MB | -39% |
| `npm ci --omit=dev` | 165 MB | -21% |
| `--no-install-recommends` for apt deps | 158 MB | -4% |

From 1.18 GB to 158 MB - an 87% reduction.

```terminal
title: Progressive Image Optimization
description: Watch the image shrink as each best practice is applied.
steps:
  - command: cat Dockerfile
    output: |
      FROM node:22
      WORKDIR /app
      COPY . .
      RUN npm install
      EXPOSE 3000
      CMD ["node", "server.js"]
    narration: "Starting with the naive Dockerfile. No .dockerignore, no layer optimization, full base image."
  - command: docker build -t myapp:naive . 2>&1 | tail -1
    output: "myapp:naive   latest   a1b2c3d4e5f6   5 seconds ago   1.18GB"
    narration: "1.18 GB. The full node:22 image alone is over 1 GB, and npm install adds hundreds of megabytes of dependencies including devDependencies."
  - command: "sed -i 's/FROM node:22/FROM node:22-slim/' Dockerfile && docker build -t myapp:slim . 2>&1 | tail -1"
    output: "myapp:slim    latest   b2c3d4e5f6a7   3 seconds ago   350MB"
    narration: "Switching to node:22-slim drops 830 MB. The slim variant includes the Node.js runtime without compilers, build tools, or development libraries."
  - command: cat .dockerignore
    output: |
      node_modules
      .git
      .env
      coverage
      *.md
      Dockerfile*
      docker-compose*.yml
    narration: "Adding a .dockerignore keeps node_modules, .git history, and secrets out of the build context. The image size barely changes, but build speed improves because the daemon receives far less data."
  - command: cat Dockerfile.optimized
    output: |
      FROM node:22-slim AS production
      WORKDIR /app
      COPY package.json package-lock.json ./
      RUN npm ci --omit=dev
      COPY . .
      USER node
      EXPOSE 3000
      CMD ["node", "server.js"]
    narration: "Dependency-first ordering and --omit=dev. Now npm ci only reruns when package files change, and devDependencies are excluded entirely."
  - command: docker build -f Dockerfile.optimized -t myapp:optimized . 2>&1 | tail -1
    output: "myapp:optimized   latest   c3d4e5f6a7b8   2 seconds ago   165MB"
    narration: "165 MB. The combination of slim base, dependency-first ordering, and production-only dependencies takes us from 1.18 GB to 165 MB - an 86% reduction."
  - command: docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep myapp
    output: |
      myapp:optimized   165MB
      myapp:slim         350MB
      myapp:naive        1.18GB
    narration: "Side by side comparison. Every optimization is measurable. The naive image is 7x larger than the optimized version."
  - command: dive myapp:optimized --ci
    output: |
      Result: PASS [Total:3, Passed:3, Failed:0, Skipped:0]
        efficiency: 98.4% (passed)
        wastedBytes: 1.2 MB (passed)
        userWastedPercent: 0.7% (passed)
    narration: "Dive confirms 98.4% layer efficiency - almost no wasted space from files added in one layer and removed in another."
```

---

## Security Hardening

A working Dockerfile is not necessarily a safe one. Production images need to limit what an attacker can do if they compromise the running application.

### Non-Root Users

By default, containers run as root. If an attacker exploits a vulnerability in your application, they get root access inside the container. Combined with a misconfigured volume mount or a kernel exploit, this can escalate to host-level access.

The fix is a `USER` directive:

```dockerfile
# Debian-based images
RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

# Alpine-based images
RUN addgroup -S -g 1001 appgroup \
    && adduser -S -u 1001 -G appgroup appuser
USER appuser
```

Place the `USER` directive after all `RUN` instructions that need root (installing packages, creating directories, changing permissions) and before `CMD` or `ENTRYPOINT`. Everything after `USER` runs as the specified user, including your application.

Some official images provide a built-in non-root user. Node.js images include a `node` user:

```dockerfile
FROM node:22-slim
# ... install dependencies and copy files ...
USER node
CMD ["node", "server.js"]
```

### Read-Only Filesystems

Running the container with a read-only filesystem prevents an attacker from writing malicious scripts or modifying configuration:

```bash
docker run --read-only --tmpfs /tmp --tmpfs /var/run myapp:latest
```

The `--tmpfs` flags create writable in-memory filesystems for directories your application needs to write to (temp files, PID files). Everything else is immutable.

In Docker Compose:

```yaml
services:
  app:
    image: myapp:latest
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

### Secrets Handling

Secrets (database passwords, API keys, TLS certificates) must never appear in the image. Two common mistakes expose them:

**`ENV` and `ARG` are visible in image metadata:**

```dockerfile
# DANGEROUS - visible in docker history and docker inspect
ARG DB_PASSWORD
ENV DB_PASSWORD=${DB_PASSWORD}
```

Anyone with access to the image can run `docker history --no-trunc myapp:latest` and see the password in plain text.

**BuildKit secret mounts** solve this by making secrets available during build without persisting them in any layer:

```dockerfile
# Secret is mounted as a file, readable only during this RUN
RUN --mount=type=secret,id=db_password \
    DB_PASSWORD=$(cat /run/secrets/db_password) \
    && ./setup-database.sh
```

```bash
docker build --secret id=db_password,src=./secrets/db_password.txt -t myapp .
```

The secret file is mounted into the build container for that single `RUN` instruction and is never written to an image layer.

!!! danger "Never use ARG or ENV for secrets"
    `docker history` exposes every `ARG` and `ENV` value as plain text. BuildKit `--mount=type=secret` is the only safe way to use secrets during builds. For runtime secrets, use your orchestrator's secret management (Docker Swarm secrets, Kubernetes secrets, or a vault service).

### Vulnerability Scanning

Even a well-written Dockerfile can inherit vulnerabilities from base image packages. Scanning tools check every package against CVE databases:

**[Docker Scout](https://docs.docker.com/scout/)** (built into Docker Desktop and CLI):

```bash
docker scout cves myapp:latest
```

**[Trivy](https://trivy.dev/)** (open source, CI-friendly):

```bash
trivy image myapp:latest
```

**[Grype](https://github.com/anchore/grype)** (open source, fast):

```bash
grype myapp:latest
```

Run one of these in your CI pipeline on every build. Block deployments when critical or high-severity CVEs are found. Rebuild images periodically (even without code changes) to pick up base image security patches.

### HEALTHCHECK

The `HEALTHCHECK` directive tells Docker how to verify a container is functioning:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["curl", "-f", "http://localhost:3000/health" ]
```

Without a health check, Docker considers a container "healthy" as long as the process is running - even if it is deadlocked, out of memory, or returning errors. Orchestrators like Kubernetes and Docker Swarm use health checks to restart failing containers automatically.

If your image does not include `curl`, use a language-native check:

```dockerfile
# Node.js
HEALTHCHECK CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })"]

# Python
HEALTHCHECK CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
```

```quiz
title: Container Security
questions:
  - question: "Why is passing a database password via ARG DB_PASSWORD in a Dockerfile a security risk?"
    options:
      - text: "ARG values are slower than ENV values at runtime"
        correct: false
        explanation: "ARG and ENV have different scopes (build-time vs runtime), but performance is not the concern. The issue is visibility."
      - text: "ARG values are visible in docker history and stored in image metadata"
        correct: true
        explanation: "Anyone who can pull the image can run docker history --no-trunc and see every ARG value in plain text. BuildKit secret mounts (--mount=type=secret) are the safe alternative - they are never persisted in any image layer."
      - text: "ARG values cannot be used at runtime"
        correct: false
        explanation: "This is true (ARG is build-time only), but it is not the security risk. The risk is that the value is permanently embedded in the image layers."
      - text: "ARG values are transmitted unencrypted to the registry"
        correct: false
        explanation: "Registry communication uses TLS. The risk is that the secret is baked into the image itself, accessible to anyone with image access."
  - question: "A container runs as root by default. Running with --read-only prevents the container from writing to the filesystem. What additional flag is typically needed?"
    options:
      - text: "--privileged to allow read-only mode"
        correct: false
        explanation: "--privileged gives the container near-host-level access - the opposite of hardening."
      - text: "--tmpfs /tmp to provide a writable temporary directory"
        correct: true
        explanation: "Most applications need to write temporary files somewhere. --tmpfs mounts an in-memory filesystem at the specified path, allowing writes without compromising the rest of the read-only filesystem."
      - text: "--no-new-privileges to prevent privilege escalation"
        correct: false
        explanation: "--no-new-privileges is a good security practice but is unrelated to read-only filesystems. It prevents processes inside the container from gaining additional privileges via setuid binaries."
```

---

## Production-Ready Patterns

Here are complete, annotated Dockerfiles for four common ecosystems. Each includes the matching `.dockerignore` and the final image size.

### Node.js Full-Stack Application

```dockerfile
FROM node:22 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-slim AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY package.json ./
RUN npm prune --omit=dev
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })"]
CMD ["node", "dist/server.js"]
```

Final image size: ~170 MB

### Python FastAPI Service

```dockerfile
FROM python:3.13 AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.13-slim AS production
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* \
    && rm -rf /wheels
COPY . .
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

Final image size: ~180 MB

### Go Microservice

```dockerfile
FROM golang:1.24 AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /server /server
USER 65534
EXPOSE 8080
ENTRYPOINT ["/server"]
```

Final image size: ~12 MB

### Java Spring Boot

```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY gradle ./gradle
COPY gradlew build.gradle settings.gradle ./
RUN ./gradlew dependencies --no-daemon
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/build/libs/*.jar app.jar
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD ["wget", "-qO-", "http://localhost:8080/actuator/health"]
CMD ["java", "-jar", "app.jar"]
```

Final image size: ~200 MB

```command-builder
description: Build Docker images with optimization flags
base: "docker build"
options:
  - flag: "-t "
    type: text
    label: "Image tag"
    placeholder: "myapp:latest"
    explanation: "Name and optionally tag the image (repository:tag)"
  - flag: "--target "
    type: select
    label: "Target stage"
    explanation: "Stop building at a specific stage - useful for CI (testing) or local dev"
    choices:
      - ["", "(build all stages)"]
      - ["deps", "deps - dependency installation only"]
      - ["build", "build - compile/transpile step"]
      - ["test", "test - run test suite"]
      - ["production", "production - final runtime image"]
  - flag: "--platform "
    type: select
    label: "Target platform"
    explanation: "Build for a specific CPU architecture or multiple platforms"
    choices:
      - ["", "(native platform)"]
      - ["linux/amd64", "linux/amd64 (x86_64)"]
      - ["linux/arm64", "linux/arm64 (Apple Silicon, AWS Graviton)"]
      - ["linux/amd64,linux/arm64", "Both amd64 and arm64 (multi-platform)"]
  - flag: ""
    type: select
    label: "Cache strategy"
    explanation: "Control build cache behavior for CI or clean builds"
    choices:
      - ["", "(use local cache)"]
      - ["--no-cache", "No cache - rebuild everything from scratch"]
      - ["--cache-from type=registry,ref=registry.example.com/myapp:cache", "Pull cache from registry"]
  - flag: ""
    type: select
    label: "Build context"
    explanation: "The directory containing your Dockerfile and source code"
    choices:
      - [".", "Current directory"]
      - ["-f Dockerfile.prod .", "Custom Dockerfile name"]
```

```quiz
title: Production Readiness
questions:
  - question: "A Dockerfile uses FROM node:22, runs npm install (not npm ci), copies all source code before package.json, runs as root, and uses EXPOSE 3000. Which combination of changes has the MOST impact?"
    options:
      - text: "Change EXPOSE to a different port number"
        correct: false
        explanation: "EXPOSE is documentation only - it does not actually publish the port. Changing it has zero functional impact."
      - text: "Copy package.json first, switch to node:22-slim, use npm ci --omit=dev, and add USER node"
        correct: true
        explanation: "This addresses four problems at once: layer ordering (cache efficiency), base image bloat (70% size reduction), dependency management (reproducible, production-only installs), and security (non-root execution). Together these transform the image from a development convenience to a production asset."
      - text: "Switch to Alpine Linux for the smallest possible image"
        correct: false
        explanation: "Alpine is smaller but does not address the root execution, poor caching, or npm install vs npm ci issues. Size is one dimension - security and build efficiency matter equally."
      - text: "Add more RUN commands to install debugging tools like curl and vim"
        correct: false
        explanation: "Every additional package increases image size and attack surface. Debugging tools should live in a separate debug image or use ephemeral containers."
  - question: "In a multi-stage Dockerfile, why should you run tests in a dedicated stage rather than in the production stage?"
    options:
      - text: "Tests run faster in a separate stage"
        correct: false
        explanation: "Test execution speed is the same regardless of which stage runs them. The benefit is about what ends up in the final image."
      - text: "The production stage never contains test frameworks, test files, or devDependencies"
        correct: true
        explanation: "A test stage inherits from the build stage and has access to all devDependencies and test files. The production stage copies only what it needs from earlier stages. Test frameworks, fixtures, and development tools never enter the production image."
      - text: "Docker can run stages in parallel, so tests finish sooner"
        correct: false
        explanation: "BuildKit can parallelize independent stages, but a test stage typically depends on the build stage completing first, so it runs sequentially."
```

---

## CI/CD Integration

Dockerfiles do not exist in isolation. Integrating them into CI/CD pipelines requires strategies for caching across builds and supporting multiple architectures.

### Registry-Based Cache

Local build cache does not survive between CI runs. BuildKit can export and import cache layers to a container registry:

```bash
# Export cache alongside the image
docker build \
    --cache-to type=registry,ref=registry.example.com/myapp:cache,mode=max \
    --cache-from type=registry,ref=registry.example.com/myapp:cache \
    -t registry.example.com/myapp:latest .
```

The `mode=max` option caches all layers from all stages, not just the final image. Subsequent CI runs pull cached layers from the registry, skipping expensive steps like dependency installation and compilation.

In GitHub Actions:

```yaml
- name: Build and push
  uses: docker/build-push-action@v6
  with:
    push: true
    tags: registry.example.com/myapp:latest
    cache-from: type=registry,ref=registry.example.com/myapp:cache
    cache-to: type=registry,ref=registry.example.com/myapp:cache,mode=max
```

### Multi-Platform Builds

Applications need to run on both x86_64 servers and ARM machines (Apple Silicon laptops, AWS Graviton instances). BuildKit's `buildx` plugin handles this:

```bash
# Create a builder that supports multiple platforms
docker buildx create --name multiplatform --use

# Build for both architectures and push to registry
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t registry.example.com/myapp:latest \
    --push .
```

Docker creates a **manifest list** that points to platform-specific images. When someone pulls `myapp:latest`, Docker automatically selects the image matching their architecture.

### Tagging Strategy

A good tagging strategy gives you traceability and rollback capability:

```bash
# Semantic version for releases
docker build -t myapp:2.1.0 .

# Git SHA for traceability
docker build -t myapp:$(git rev-parse --short HEAD) .

# Both, plus latest
docker build \
    -t myapp:2.1.0 \
    -t myapp:$(git rev-parse --short HEAD) \
    -t myapp:latest .
```

The `latest` tag is not special - it is just a convention. It does not automatically update when you push a new version. Many teams avoid `latest` in production and deploy explicit version tags instead, making rollbacks a simple tag change rather than a guessing game about which build `latest` currently points to.

### Rebuild Triggers

Not every commit needs a new image. Efficient CI pipelines rebuild only when relevant files change:

- **Always rebuild**: changes to `Dockerfile`, `.dockerignore`, dependency lockfiles
- **Usually rebuild**: changes to source code
- **Skip rebuild**: changes to documentation, CI configuration for other services, README

Most CI systems support path-based triggers. In GitHub Actions:

```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'
      - 'package-lock.json'
      - 'Dockerfile'
      - '.dockerignore'
```

---

```exercise
title: Optimize a Production Dockerfile
difficulty: intermediate
scenario: |
  A team handed you this Dockerfile for a Python FastAPI application. It works, but it has at least six problems. Your task is to rewrite it following every best practice from this guide.

  ```dockerfile
  FROM python:3.13
  WORKDIR /app
  ENV DATABASE_URL=postgresql://admin:s3cretpass@db:5432/myapp
  COPY . .
  RUN pip install -r requirements.txt
  RUN apt-get update && apt-get install -y curl vim htop
  EXPOSE 8000
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

  The project directory contains: `app/`, `tests/`, `requirements.txt`, `.git/`, `.env`, `README.md`, `docker-compose.yml`, `__pycache__/`, and `.pytest_cache/`.

  Rewrite the Dockerfile and create a `.dockerignore` file. Your optimized image should:
  - Be under 200 MB (the current image is ~1.1 GB)
  - Not run as root
  - Not contain secrets in any layer
  - Not contain curl, vim, htop, or other debugging tools
  - Use multi-stage builds
  - Cache dependencies efficiently
  - Include a health check
hints:
  - "The DATABASE_URL contains a hardcoded password. Use environment variables at runtime (docker run -e) or an orchestrator's secret management instead of baking secrets into the image."
  - "The full python:3.13 base image includes compilers and development headers. Use it for building wheels, then switch to python:3.13-slim for the runtime stage."
  - "COPY . . before pip install means every code change reinstalls all dependencies. Copy requirements.txt first."
  - "curl, vim, and htop are debugging tools that increase attack surface. Remove them from the production image. If you need curl for a health check, use Python's urllib instead."
  - "Create a .dockerignore that excludes .git, __pycache__, .pytest_cache, .env, tests, README.md, docker-compose.yml, and Dockerfile itself."
solution: |
  **Optimized Dockerfile:**

  ```dockerfile
  FROM python:3.13 AS builder
  WORKDIR /app
  COPY requirements.txt .
  RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

  FROM python:3.13-slim AS production
  WORKDIR /app
  RUN addgroup --system --gid 1001 appgroup \
      && adduser --system --uid 1001 --ingroup appgroup appuser
  COPY --from=builder /wheels /wheels
  RUN pip install --no-cache-dir /wheels/* \
      && rm -rf /wheels
  COPY app ./app
  USER appuser
  EXPOSE 8000
  HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
      CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

  **`.dockerignore`:**

  ```text
  .git
  __pycache__
  .pytest_cache
  .env
  tests
  README.md
  docker-compose.yml
  Dockerfile*
  .dockerignore
  *.pyc
  *.pyo
  .mypy_cache
  htmlcov
  ```

  **What changed and why:**
  1. **Multi-stage build** - wheels are compiled in the full image, installed in slim. No compilers in production.
  2. **No hardcoded secrets** - DATABASE_URL removed from the Dockerfile entirely. Pass it at runtime with `docker run -e DATABASE_URL=...` or through your orchestrator.
  3. **Dependency-first ordering** - requirements.txt is copied and installed before application code. Code changes do not trigger reinstallation.
  4. **No debugging tools** - curl, vim, and htop removed. Health check uses Python's stdlib.
  5. **Non-root user** - appuser with explicit UID/GID.
  6. **Selective COPY** - only the `app/` directory is copied, not the entire project.
  7. **Health check** - uses Python's urllib, no external dependencies needed.
  8. **.dockerignore** - excludes VCS, caches, tests, secrets, and Docker files from the build context.
```

---

## Further Reading

- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/) - complete specification of every Dockerfile instruction
- [Build Best Practices](https://docs.docker.com/build/building/best-practices/) - official Docker optimization guide
- [BuildKit Cache Documentation](https://docs.docker.com/build/cache/) - cache mounts, registry cache, and export modes
- [Docker Scout Quickstart](https://docs.docker.com/scout/quickstart/) - vulnerability scanning integrated into Docker CLI
- [Dive](https://github.com/wagoodman/dive) - explore Docker image layers and find wasted space
- [Distroless Images](https://github.com/GoogleContainerTools/distroless) - minimal container base images from Google
- [Trivy](https://trivy.dev/) - comprehensive open-source vulnerability scanner for container images

---

**Previous:** [Docker Compose](compose.md) | [Back to Index](README.md)
