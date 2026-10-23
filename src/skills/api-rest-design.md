---
name: REST API design
slug: api-rest-design
category: node
description: Resource naming, status codes, pagination, filtering, and idempotent writes.
---

Apply these web-development rules when relevant to the task:

- Use plural nouns for resources (/projects/{id}/tasks) and HTTP verbs for actions.
- Return 201 for created, 204 for empty success, 404 for missing, 409 for conflicts, and 422 for validation errors.
- Paginate list endpoints with cursor or limit parameters and return a next cursor.
- Make PUT and DELETE idempotent; accept an Idempotency-Key header on payment-like POSTs.
