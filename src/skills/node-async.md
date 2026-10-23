---
name: Async correctness in Node
slug: node-async
category: node
description: Promise combinators, cancellation with AbortSignal, timeouts, and avoiding unhandled rejections.
---

Apply these web-development rules when relevant to the task:

- Use Promise.all for independent work that should fail fast; Promise.allSettled when partial success is fine.
- Pass AbortSignal through long-running calls so they can be cancelled.
- Put timeouts on every outbound network call.
- Never leave a promise floating; await it or handle its rejection.
