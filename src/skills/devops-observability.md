---
name: Logging, errors, and health checks
slug: devops-observability
category: devops
description: Structured logs, error tracking, metrics, and health endpoints.
---

Apply these web-development rules when relevant to the task:

- Emit structured JSON logs with a request id, level, and error code.
- Report unhandled errors to an error tracker with release and environment tags.
- Expose a cheap /health endpoint and a deeper readiness check separately.
- Alert on user-visible symptoms (error rate, latency) rather than every log line.
