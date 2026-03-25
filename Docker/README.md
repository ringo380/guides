# Docker and Containers

Docker is a platform for developing, shipping, and running applications in isolated environments called **containers**. It revolutionized software deployment by ensuring that an application runs the same way regardless of the host environment.

## Guides

- [**Docker Fundamentals**](fundamentals.md)  
  An introduction to the Docker architecture, images, containers, and basic management commands.
- [**Docker Compose**](compose.md)  
  Learn how to define and run multi-container applications using YAML configuration.

## Introduction

Containers allow you to package an application with all of its dependencies — libraries, configuration files, and runtime — into a single unit. Unlike Virtual Machines (VMs), containers share the host's OS kernel, making them lightweight, fast to start, and efficient in resource usage.

### Key Concepts

- **Image**: A read-only template with instructions for creating a Docker container.
- **Container**: A runnable instance of an image.
- **Dockerfile**: A text document that contains all the commands a user could call on the command line to assemble an image.
- **Registry**: A stateless, highly scalable server side application that stores and lets you distribute Docker images (e.g., Docker Hub).
