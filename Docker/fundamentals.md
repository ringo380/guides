# Docker Fundamentals

Docker provides a way to package and run an application in an isolated environment called a **container**. The isolation and security allow you to run many containers simultaneously on a given host.

## Understanding the Architecture

Docker uses a client-server architecture. The [**Docker client**](https://docs.docker.com/engine/reference/commandline/cli/) talks to the [**Docker daemon**](https://docs.docker.com/engine/reference/commandline/dockerd/), which does the heavy lifting of building, running, and distributing your Docker containers.

- **Docker Daemon (`dockerd`)**: Listens for Docker API requests and manages Docker objects such as images, containers, networks, and volumes.
- **Docker Client (`docker`)**: The primary way that many Docker users interact with Docker. When you use commands such as `docker run`, the client sends these commands to `dockerd`, which carries them out.
- **Docker Registries**: A Docker registry stores Docker images. [**Docker Hub**](https://hub.docker.com/) is a public registry that anyone can use, and Docker is configured to look for images on Docker Hub by default.

---

## Images and Containers

### Images
An **image** is a read-only template with instructions for creating a Docker container. Often, an image is based on another image, with some additional customization. For example, you may build an image which is based on the `ubuntu` image, but installs the Apache web server and your application, as well as the configuration details needed to make your application run.

### Containers
A **container** is a runnable instance of an image. You can create, start, stop, move, or delete a container using the Docker API or CLI. You can connect a container to one or more networks, attach storage to it, or even create a new image based on its current state.

By default, a container is relatively well isolated from other containers and its host machine.

---

## Basic Docker Commands

The `docker` CLI is the main tool for managing containers.

### Running a Container

The most common command is `docker run`, which pulls an image (if it's not already present), creates a container, and starts it.

```bash
docker run -d --name my-web-server -p 8080:80 nginx
```

- `-d`: Runs the container in **detached mode** (in the background).
- `--name`: Assigns a custom name to the container.
- `-p 8080:80`: Maps port 8080 on the host to port 80 in the container.
- `nginx`: The name of the image to use.

### Managing Containers

- `docker ps`: List running containers.
- `docker ps -a`: List all containers (including stopped ones).
- `docker stop <container_id>`: Stop a running container.
- `docker rm <container_id>`: Remove a container.
- `docker images`: List all images on the host.
- `docker rmi <image_id>`: Remove an image.

---

## Dockerfile: Building Your Own Image

To create your own image, you create a [**`Dockerfile`**](https://docs.docker.com/engine/reference/builder/) with a simple syntax for defining the steps needed to create the image and run it.

```dockerfile
# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define the command to run your app
CMD [ "node", "app.js" ]
```

To build an image from a Dockerfile:

```bash
docker build -t my-node-app .
```

---

## Interactive Quiz: Docker Basics

Test your knowledge of Docker fundamentals.

```quiz
questions:
  - question: "What is the primary difference between an image and a container?"
    options:
      - text: "Images are running instances of containers."
      - text: "A container is a read-only template, while an image is its running instance."
      - text: "An image is a read-only template, while a container is its runnable instance."
        correct: true
      - text: "There is no difference; the terms are interchangeable."
    explanation: "Think of an image as a blueprint (template) and a container as the actual building (instance) created from that blueprint."

  - question: "Which Docker command is used to list all containers, including those that are stopped?"
    options:
      - text: "docker ps"
      - text: "docker ps -a"
        correct: true
      - text: "docker list"
      - text: "docker containers --all"
    explanation: "`docker ps` only shows running containers. Adding the `-a` (or `--all`) flag includes stopped containers in the output."

  - question: "In the command `docker run -p 8080:80 nginx`, what does the `8080:80` part do?"
    options:
      - text: "Sets the container ID to 8080."
      - text: "Maps host port 80 to container port 8080."
      - text: "Maps host port 8080 to container port 80."
        correct: true
      - text: "Limits the container to 8080MB of RAM."
    explanation: "The port mapping syntax is `HOST_PORT:CONTAINER_PORT`. Here, it forwards traffic from the host's port 8080 to the container's port 80."
```

---

## Further Reading

- [**Docker Documentation**](https://docs.docker.com/)  
- [**Docker Hub**](https://hub.docker.com/)  
- [**Dockerfile Reference**](https://docs.docker.com/engine/reference/builder/)  

---

**Next:** [Docker Compose](compose.md) | [Back to Index](README.md)
