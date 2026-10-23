---
name: GraphQL API design
slug: api-graphql
category: node
description: Schema design, avoiding N+1 queries with batching, and limiting query cost.
---

Apply these web-development rules when relevant to the task:

- Design the schema around client use cases, with explicit types rather than generic JSON blobs.
- Batch related lookups with a DataLoader to avoid N+1 queries.
- Limit query depth and complexity to protect the server.
- Use non-null types only where a value is guaranteed.
