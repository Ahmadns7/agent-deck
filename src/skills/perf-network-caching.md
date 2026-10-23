---
name: Network caching and request waterfalls
slug: perf-network-caching
category: performance
description: Cache headers, request waterfalls, prefetching, and deduplicating requests.
---

Apply these web-development rules when relevant to the task:

- Find and flatten waterfalls: start independent requests in parallel with Promise.all.
- Set Cache-Control per asset type: long immutable cache for hashed files, short or no-cache for HTML.
- Deduplicate identical in-flight requests in your data layer.
- Prefetch likely next routes or data on hover or idle, not on every link.
