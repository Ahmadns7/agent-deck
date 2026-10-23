---
name: React state placement
slug: react-state
category: react
description: Choosing local, lifted, context, server-cache, or URL state without redundant copies.
---

Apply these web-development rules when relevant to the task:

- Start with the narrowest scope: local useState, then lift only when siblings need it.
- Keep server data in a cache layer, not copied into useState.
- Put shareable view state (filters, tabs, page) in the URL.
- Avoid storing values that can be computed from other state.
