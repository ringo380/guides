# Docker and Containers

Docker is a platform for developing, shipping, and running applications in isolated environments called **containers**. It revolutionized software deployment by ensuring that an application runs the same way regardless of the host environment.

## Guides

<div class="topic-progression">
<a class="topic-card" href="fundamentals/" data-guide="fundamentals" data-topic="Docker">
<span class="topic-card__number">1</span>
<span class="topic-card__badge">Start Here</span>
<div class="topic-card__body">
<div class="topic-card__title">Docker Fundamentals</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Docker architecture, images, containers, Dockerfiles, volumes, and networking basics.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="compose/" data-guide="compose" data-topic="Docker">
<span class="topic-card__number">2</span>
<div class="topic-card__body">
<div class="topic-card__title">Docker Compose</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Define and run multi-container applications with compose.yml, service discovery, and single-command lifecycle management.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="dockerfile-best-practices/" data-guide="dockerfile-best-practices" data-topic="Docker">
<span class="topic-card__number">3</span>
<div class="topic-card__body">
<div class="topic-card__title">Dockerfile Best Practices</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Multi-stage builds, layer caching, security hardening, image minimization, and production-ready Dockerfile patterns.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
</div>

## Introduction

Containers allow you to package an application with all of its dependencies — libraries, configuration files, and runtime — into a single unit. Unlike Virtual Machines (VMs), containers share the host's OS kernel, making them lightweight, fast to start, and efficient in resource usage.

### Key Concepts

- **Image**: A read-only template with instructions for creating a Docker container.
- **Container**: A runnable instance of an image.
- **Dockerfile**: A text document that contains all the commands a user could call on the command line to assemble an image.
- **Registry**: A stateless, highly scalable server side application that stores and lets you distribute Docker images (e.g., Docker Hub).
