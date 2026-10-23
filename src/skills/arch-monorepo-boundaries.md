---
name: Monorepo module boundaries
slug: arch-monorepo-boundaries
category: architecture
description: Dependency direction rules, shared packages, and enforcing boundaries in tooling.
---

Apply these web-development rules when relevant to the task:

- Define layers (ui, features, shared, core) and only allow imports downward.
- Keep shared packages free of app-specific code.
- Enforce boundaries with a lint rule or dependency-check tool in CI.
- Version internal packages through the workspace, not by copy.
