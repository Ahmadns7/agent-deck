---
name: Strict TypeScript types
slug: ts-strict-types
category: typescript
description: Strict typing: avoid any, narrow with guards, use unknown at boundaries, discriminated unions.
---

Apply these web-development rules when relevant to the task:

- Never use any; use unknown and narrow it with type guards.
- Model states as discriminated unions so impossible states cannot be represented.
- Use exhaustive switch statements with a never check.
- Prefer readonly data and const assertions where values should not change.
