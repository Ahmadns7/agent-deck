---
name: Feature-based folder structure
slug: arch-feature-folders
category: architecture
description: Feature folders, clear module boundaries, and no circular imports.
---

Apply these web-development rules when relevant to the task:

- Group code by feature (features/billing/...) with a small public index per feature.
- Shared code goes in a shared folder only when two or more features use it.
- Import across features only through their public index, never deep paths.
- Break any circular import by moving the shared piece into a lower-level module.
