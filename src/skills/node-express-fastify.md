---
name: Node HTTP server structure
slug: node-express-fastify
category: node
description: Middleware ordering, request validation, and graceful shutdown for Express or Fastify.
---

Apply these web-development rules when relevant to the task:

- Order middleware: security headers, body parsing with limits, auth, routes, then the error handler last.
- Validate request params, query, and body at the route edge with a schema.
- Handle SIGTERM by stopping new connections, finishing in-flight requests, then exiting.
- Keep route handlers thin; put business logic in services.
