---
name: React server and client components
slug: react-server-components
category: react
description: Server vs client component boundaries, serialization limits, and data fetching placement.
---

Apply these web-development rules when relevant to the task:

- Default to server components; add 'use client' only where state, effects, or browser APIs are needed.
- Push the client boundary down to the smallest interactive leaf.
- Only pass serializable props across the server to client boundary.
- Fetch data on the server close to where it is rendered, not in client effects.
