---
name: TypeScript configuration
slug: ts-config
category: typescript
description: tsconfig strictness, module resolution for Vite and Node, and path aliases.
---

Apply these web-development rules when relevant to the task:

- Enable strict and noUncheckedIndexedAccess.
- Use moduleResolution bundler for Vite apps and NodeNext for Node packages.
- Keep type-check (tsc --noEmit) as its own script and run it in CI.
- Avoid skipLibCheck as a fix for real type errors in your own code.
