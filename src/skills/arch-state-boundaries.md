---
name: State boundaries
slug: arch-state-boundaries
category: architecture
description: Decide which state is server data, which is client UI state, and keep them apart.
---

Apply these web-development rules when relevant to the task:

- Treat server data as a cache with a query library, not as hand-managed client state.
- Keep UI-only state (open, selected, draft) in components or a small store.
- Name the owner of every piece of state in a comment or type.
- Avoid mirroring the same data in two stores.
