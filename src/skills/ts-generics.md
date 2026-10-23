---
name: TypeScript generics and utility types
slug: ts-generics
category: typescript
description: Generics with constraints, inference-friendly signatures, and restrained mapped or conditional types.
---

Apply these web-development rules when relevant to the task:

- Add a constraint to every generic parameter that needs properties.
- Let TypeScript infer types; annotate only at public API boundaries.
- Use Pick, Omit, Partial, and Record before writing custom mapped types.
- Keep conditional types simple; if a type needs a comment to read, simplify it.
