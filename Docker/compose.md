# Docker Compose

[**Docker Compose**](https://docs.docker.com/compose/) is a tool for defining and running multi-container Docker applications. With Compose, you use a YAML file to configure your application’s services. Then, with a single command, you create and start all the services from your configuration.

## Why Use Docker Compose?

Managing multiple containers manually using `docker run` becomes complex very quickly. You have to remember specific network settings, volumes, and environment variables for each container. Docker Compose centralizes this configuration, allowing you to:

- **Define service dependencies**: Start your database before your web application.
- **Manage networks and volumes**: Automatically create networks for service-to-service communication.
- **Standardize environments**: Ensure everyone on the team is running the same stack with the same configuration.

---

## The `docker-compose.yml` File

The core of Docker Compose is the YAML configuration file.

```yaml
version: "3.9"

services:
  db:
    image: postgres
    volumes:
      - ./data/db:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
  web:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/code
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_NAME=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    depends_on:
      - db
```

### Key Components

- **`services`**: Defines the different containers that make up your application.
- **`image`**: Specifies the image to start the container from.
- **`build`**: Configuration options that are applied at build time (usually points to a directory containing a `Dockerfile`).
- **`ports`**: Maps host ports to container ports.
- **`volumes`**: Mounts paths on the host to paths in the container.
- **`depends_on`**: Expresses dependency order between services.

---

## Common Compose Commands

Docker Compose commands are run from the directory containing the `docker-compose.yml` file.

- `docker-compose up`: Create and start containers.
- `docker-compose up -d`: Start containers in the background.
- `docker-compose down`: Stop and remove containers, networks, and images created by `up`.
- `docker-compose ps`: List containers managed by Compose.
- `docker-compose logs -f`: View tailing logs from all services.
- `docker-compose exec <service_name> <command>`: Execute a command in a running service container.

---

## Interactive Quiz: Docker Compose

Verify your understanding of Docker Compose.

```quiz
questions:
  - question: "Which command is used to stop and remove all resources (containers, networks) created by Docker Compose?"
    options:
      - "docker-compose stop"
      - "docker-compose rm"
      - "docker-compose down"
      - "docker-compose delete"
    answer: 2
    explanation: "`docker-compose down` stops containers and also removes them along with the networks created for the project. `stop` only pauses them."

  - question: "In a `docker-compose.yml` file, what does the `depends_on` directive do?"
    options:
      - "It links the container to an external network."
      - "It ensures services are started in a specific order."
      - "It copies files from one service to another."
      - "It merges two Docker images into one."
    answer: 1
    explanation: "`depends_on` defines the order in which services are started and stopped. For example, a web app might depend on a database service."

  - question: "What is the primary format used for Docker Compose configuration files?"
    options:
      - "JSON"
      - "XML"
      - "YAML"
      - "TOML"
    answer: 2
    explanation: "Docker Compose uses YAML (`.yml` or `.yaml`) for its configuration files due to its readability and support for HTML structure."
```

---

## Further Reading

- [**Docker Compose Documentation**](https://docs.docker.com/compose/)  
- [**Compose File Reference**](https://docs.docker.com/compose/compose-file/)  
- [**Docker Compose Samples**](https://docs.docker.com/compose/samples-for-compose/)  

---

**Previous:** [Docker Fundamentals](fundamentals.md) | [Back to Index](README.md)
