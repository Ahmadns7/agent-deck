---
name: Separating the API layer from UI
slug: arch-api-layer
category: architecture
description: Keep the API client and data access out of components.
---

Apply these web-development rules when relevant to the task:

- Put fetch calls in an API module or data hooks, not inline in components.
- Map API shapes to view models at the boundary so UI code stays simple.
- Centralize base URL, auth headers, and error normalization in one client.
- Keep the data-access interface small so it can be mocked in tests.
