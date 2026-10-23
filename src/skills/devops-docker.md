---
name: Docker images
slug: devops-docker
category: devops
description: Multi-stage builds, small images, non-root users, and health checks.
---

Apply these web-development rules when relevant to the task:

- Use multi-stage builds so the final image contains only runtime files.
- Pick a slim or distroless base image and pin its version.
- Run as a non-root user with USER.
- Add a HEALTHCHECK or a readiness endpoint and a .dockerignore file.
