---
difficulty: intermediate
time_estimate: "35 min"
prerequisites:
  - fundamentals
learning_outcomes:
  - "Define multi-container applications in compose.yml with services, networks, and volumes"
  - "Manage full-stack environments with docker compose up, down, and build commands"
  - "Configure service dependencies, environment variables, and health checks"
tags:
  - docker
  - containers
  - orchestration
  - devops
---
# Docker Compose

[**Docker Compose**](https://docs.docker.com/compose/) is a tool for defining and running multi-container Docker applications. Instead of managing each container with separate `docker run` commands - each with its own flags for ports, volumes, networks, and environment variables - you declare everything in a single YAML file and bring the entire stack up or down with one command.

---

## Why Compose Exists

Running a web application typically means running at least three containers: the application itself, a database, and maybe a cache or message queue. Managing these by hand means remembering the exact `docker run` invocation for each one, creating networks, and starting them in the right order. Docker Compose solves this by letting you define the entire stack declaratively.

The benefits go beyond convenience:

- **Reproducible environments**: Every developer runs the same stack with `docker compose up`.
- **Service discovery**: Containers on a Compose network reach each other by service name - no IP addresses to manage.
- **Single-command lifecycle**: Start, stop, rebuild, and tear down the entire stack in one step.
- **Environment parity**: The same `compose.yml` works in development, CI, and staging.

---

## The Compose File

The core of Docker Compose is a YAML file named `compose.yml` (or `docker-compose.yml` for backward compatibility). It defines services, networks, and volumes.

### A Production-Style Example

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://admin:secret@db:5432/myapp
      REDIS_URL: redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d myapp"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  cache:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  pgdata:
```

!!! tip "`depends_on` does not wait for readiness"
    By default, `depends_on` only waits for a container to *start*, not for the service inside to be ready. A PostgreSQL container can take several seconds to initialize its database after the process starts. Use `condition: service_healthy` with a `healthcheck` to ensure the database is actually accepting connections before the web service starts.

### Key Directives

| Directive | Purpose |
|-----------|---------|
| `services` | Defines each container in your application stack. |
| `image` | Use a pre-built image from a registry. |
| `build` | Build an image from a Dockerfile in the specified context. |
| `ports` | Map host ports to container ports (`HOST:CONTAINER`). |
| `volumes` | Mount named volumes or bind paths into the container. |
| `environment` | Set environment variables. Supports both mapping and list syntax. |
| `depends_on` | Control startup order. Use with `condition` for health-based ordering. |
| `healthcheck` | Define a command to check if the service is healthy. |
| `restart` | Restart policy: `no`, `always`, `on-failure`, `unless-stopped`. |
| `networks` | Attach the service to specific networks. |
| `command` | Override the default CMD from the image. |
| `profiles` | Assign the service to a profile so it only starts when that profile is active. |

---

## Environment Variables and `.env` Files

Hardcoding secrets in `compose.yml` is fine for local development, but Compose supports `.env` files for separating configuration from the stack definition.

### Variable Substitution

Compose resolves `${VARIABLE}` references from the shell environment, a `.env` file in the same directory, or the `environment` directive.

```yaml
services:
  db:
    image: postgres:${POSTGRES_VERSION:-16}
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

```bash
# .env file (same directory as compose.yml)
POSTGRES_VERSION=16
DB_PASSWORD=supersecret
```

### The `env_file` Directive

For services that need many environment variables, you can point to a file instead of listing them inline:

```yaml
services:
  web:
    build: .
    env_file:
      - .env
      - .env.local
```

Files are loaded in order. Later files override earlier ones. Variables set directly in `environment` override everything.

---

## Volumes: Named vs Bind Mounts

Compose supports two primary volume strategies, and choosing the right one matters.

### Named Volumes (Production)

Named volumes are managed by Docker. They persist data across container restarts and removals, and they're the right choice for databases, file uploads, and any data that must survive a `docker compose down`.

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Bind Mounts (Development)

Bind mounts map a host directory into the container. They're essential for development because changes to files on the host appear immediately inside the container - no rebuild needed.

```yaml
services:
  web:
    build: .
    volumes:
      - .:/app           # Source code (live reloading)
      - /app/node_modules # Prevent host node_modules from overriding container's
    ports:
      - "3000:3000"
```

!!! warning "Named volumes survive `docker compose down`"
    Running `docker compose down` removes containers and networks but keeps named volumes. If you want to delete the data too, use `docker compose down -v`. This is destructive and irreversible - the database data is gone.

---

## Networking

Compose automatically creates a bridge network for each project. Every service can reach every other service by its service name as a hostname.

```yaml
services:
  web:
    build: .
    # Can connect to "db" at hostname "db" on port 5432
    # No port publishing needed for service-to-service communication
  db:
    image: postgres:16
    # Only publish if you need direct host access (e.g., for a GUI client)
    # ports:
    #   - "5432:5432"
```

For more complex setups, you can define multiple networks to isolate groups of services:

```yaml
services:
  web:
    networks:
      - frontend
      - backend
  db:
    networks:
      - backend
  nginx:
    networks:
      - frontend

networks:
  frontend:
  backend:
```

In this configuration, `nginx` can reach `web` but cannot reach `db` directly - the database is only accessible on the `backend` network.

---

## Common Compose Commands

```bash
# Start the stack (build images if needed)
docker compose up -d

# Rebuild images and start
docker compose up -d --build

# Stop and remove containers and networks
docker compose down

# Stop, remove containers, networks, AND volumes
docker compose down -v

# View logs from all services
docker compose logs -f

# View logs from a single service
docker compose logs -f web

# List running services
docker compose ps

# Run a one-off command in a service container
docker compose exec db psql -U admin -d myapp

# Run a command in a new container (doesn't attach to the running one)
docker compose run --rm web python manage.py migrate

# Scale a service to multiple replicas
docker compose up -d --scale worker=3
```

```terminal
scenario: "Bring up a three-service stack, verify connectivity, and tear it down"
steps:
  - command: "cat compose.yml"
    output: "services:\n  web:\n    build: .\n    ports:\n      - \"8000:8000\"\n    depends_on:\n      db:\n        condition: service_healthy\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready\"]\n      interval: 3s\n      retries: 5\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n  cache:\n    image: redis:7-alpine\nvolumes:\n  pgdata:"
    narration: "The compose file defines three services: a web app built from a local Dockerfile, a PostgreSQL database with a health check, and a Redis cache. The web service waits for the database to be healthy before starting."
  - command: "docker compose up -d --build"
    output: "[+] Building 8.2s\n[+] Running 4/4\n ✔ Network myproject_default  Created\n ✔ Volume myproject_pgdata    Created\n ✔ Container myproject-db-1    Healthy\n ✔ Container myproject-cache-1 Started\n ✔ Container myproject-web-1   Started"
    narration: "Compose builds the web image, creates a bridge network and a named volume, then starts containers in dependency order. The web container waits until the db health check passes."
  - command: "docker compose ps"
    output: "NAME                 SERVICE   STATUS    PORTS\nmyproject-cache-1    cache     running   6379/tcp\nmyproject-db-1       db        running   5432/tcp\nmyproject-web-1      web       running   0.0.0.0:8000->8000/tcp"
    narration: "All three services are running. Only the web service has a published port (8000). The cache and database ports are accessible to other containers on the network but not from the host."
  - command: "docker compose exec web python -c \"import redis; r = redis.Redis(host='cache'); print(r.ping())\""
    output: "True"
    narration: "The web container can reach Redis using the service name 'cache' as the hostname. Compose's built-in DNS handles the resolution."
  - command: "docker compose exec db psql -U postgres -c 'SELECT version();'"
    output: "                                                version\n---------------------------------------------------\n PostgreSQL 16.2 on x86_64-pc-linux-gnu, compiled by gcc"
    narration: "You can run commands directly inside the database container. This is useful for migrations, backups, and debugging."
  - command: "docker compose logs web --tail 5"
    output: "web-1  | INFO:     Application startup complete.\nweb-1  | INFO:     Uvicorn running on http://0.0.0.0:8000\nweb-1  | INFO:     172.20.0.1:54321 - \"GET / HTTP/1.1\" 200"
    narration: "Logs are namespaced by service. The --tail flag limits output to the last N lines."
  - command: "docker compose down"
    output: "[+] Running 4/4\n ✔ Container myproject-web-1    Removed\n ✔ Container myproject-cache-1  Removed\n ✔ Container myproject-db-1     Removed\n ✔ Network myproject_default    Removed"
    narration: "Containers and the network are removed, but the pgdata volume is preserved. Your database data is safe for the next 'docker compose up'."
```

---

## Override Files and Profiles

### Override Files

Compose automatically merges `compose.yml` with `compose.override.yml` if it exists. This is the standard pattern for separating production defaults from development customizations.

```yaml
# compose.yml (production defaults)
services:
  web:
    image: my-app:latest
    restart: unless-stopped

# compose.override.yml (development overrides)
services:
  web:
    build: .
    volumes:
      - .:/app
    environment:
      DEBUG: "true"
```

In development, `docker compose up` merges both files - building from source with a bind mount. In production, deploy with `docker compose -f compose.yml up` to skip the override.

### Profiles

Profiles let you include optional services that only start when explicitly requested.

```yaml
services:
  web:
    build: .
  db:
    image: postgres:16
  adminer:
    image: adminer
    ports:
      - "8080:8080"
    profiles:
      - debug
```

```bash
# Normal startup (adminer is NOT started)
docker compose up -d

# Start with the debug profile (includes adminer)
docker compose --profile debug up -d
```

---

## Interactive Quizzes

```quiz
question: "Which command removes containers and networks but preserves named volumes?"
type: multiple-choice
options:
  - text: "docker compose stop"
    feedback: "stop only pauses the containers; it doesn't remove them or their networks."
  - text: "docker compose down"
    correct: true
    feedback: "Correct! docker compose down removes containers and networks but keeps named volumes intact. Use docker compose down -v to also delete volumes."
  - text: "docker compose down -v"
    feedback: "The -v flag deletes volumes too. Without -v, volumes are preserved."
  - text: "docker compose rm"
    feedback: "rm removes stopped containers but doesn't handle networks. Use docker compose down for a clean teardown."
```

```quiz
question: "How do containers in a Compose stack communicate with each other?"
type: multiple-choice
options:
  - text: "Through published ports on the host."
    feedback: "Published ports are for host-to-container access. Container-to-container communication uses the internal network directly."
  - text: "By using the service name as a hostname on the shared Compose network."
    correct: true
    feedback: "Correct! Compose creates a bridge network where each service is reachable by its service name. A web service can connect to a database service at hostname 'db' without any port publishing."
  - text: "By writing to a shared volume."
    feedback: "Volumes share files, not network connections. Services communicate over the network using hostnames."
  - text: "They cannot communicate unless you set up an external network."
    feedback: "Compose automatically creates a network for the project. All services are connected to it by default."
```

```quiz
question: "What does `depends_on` with `condition: service_healthy` do?"
type: multiple-choice
options:
  - text: "It health-checks the dependent service."
    feedback: "The health check is defined on the dependency (e.g., the database), not the dependent service."
  - text: "It waits for the dependency to start, but not necessarily be ready."
    feedback: "That's what plain depends_on does. Adding condition: service_healthy waits for the health check to pass."
  - text: "It waits for the dependency's health check to pass before starting the dependent service."
    correct: true
    feedback: "Correct! Unlike plain depends_on (which only waits for the container to start), service_healthy waits until the healthcheck reports the service is actually ready to accept connections."
  - text: "It restarts the dependency if it becomes unhealthy."
    feedback: "Restart behavior is controlled by the restart policy, not depends_on."
```

---

```exercise
title: "Build a Three-Service Development Stack"
scenario: |
  You need a development stack for a Node.js API with PostgreSQL and Redis. Create a `compose.yml` that meets these requirements:

  1. Define a `web` service that builds from the current directory and maps port 3000
  2. Define a `db` service using `postgres:16` with a named volume for data persistence
  3. Define a `cache` service using `redis:7-alpine`
  4. Add a health check to the `db` service using `pg_isready`
  5. Make the `web` service wait for `db` to be healthy before starting
  6. Use a `.env` file for the database password instead of hardcoding it
  7. Add a bind mount on the `web` service for live code reloading in development
hints:
  - "The healthcheck test for PostgreSQL is: [\"CMD-SHELL\", \"pg_isready -U postgres\"]"
  - "Use ${DB_PASSWORD} syntax in compose.yml and define DB_PASSWORD in a .env file"
  - "For the bind mount, use .:/app for the source code, but add /app/node_modules as an anonymous volume to prevent host modules from overriding container modules"
  - "Named volumes are declared both under the service (as a mount) and at the top level under 'volumes:'"
solution: |
  # compose.yml
  services:
    web:
      build: .
      ports:
        - "3000:3000"
      volumes:
        - .:/app
        - /app/node_modules
      environment:
        DATABASE_URL: postgres://postgres:${DB_PASSWORD}@db:5432/myapp
        REDIS_URL: redis://cache:6379
      depends_on:
        db:
          condition: service_healthy
        cache:
          condition: service_started
      restart: unless-stopped

    db:
      image: postgres:16
      volumes:
        - pgdata:/var/lib/postgresql/data
      environment:
        POSTGRES_DB: myapp
        POSTGRES_PASSWORD: ${DB_PASSWORD}
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres -d myapp"]
        interval: 5s
        timeout: 3s
        retries: 5
      restart: unless-stopped

    cache:
      image: redis:7-alpine
      restart: unless-stopped

  volumes:
    pgdata:

  # .env
  # DB_PASSWORD=your-secure-password-here
```

---

```command-builder
description: Build docker compose commands for common stack operations
base: "docker compose"
options:
  - flag: ""
    type: select
    label: "Action"
    explanation: "The primary compose operation to perform"
    choices:
      - ["up -d", "Start stack (detached)"]
      - ["down", "Stop and remove stack"]
      - ["logs -f", "View logs (follow)"]
      - ["ps", "List services"]
      - ["exec", "Run command in service"]
      - ["up -d --build", "Rebuild and start"]
  - flag: ""
    type: select
    label: "Additional option"
    explanation: "Optional flags to modify the command behavior"
    choices:
      - ["", "(none)"]
      - ["-v", "Remove volumes too (data loss!)"]
      - ["--profile debug", "Include debug profile"]
      - ["--scale worker=3", "Scale workers to 3 replicas"]
      - ["--force-recreate", "Force recreate containers"]
```

---

## Further Reading

- [Docker Compose Documentation](https://docs.docker.com/compose/) - official getting-started guide and concepts
- [Compose File Reference](https://docs.docker.com/compose/compose-file/) - complete specification of every directive
- [Awesome Compose](https://github.com/docker/awesome-compose) - sample Compose files for common application stacks
- [Docker Compose in Production](https://docs.docker.com/compose/production/) - guidelines for deploying Compose stacks beyond development

---

**Previous:** [Docker Fundamentals](fundamentals.md) | **Next:** [Dockerfile Best Practices](dockerfile-best-practices.md) | [Back to Index](README.md)
