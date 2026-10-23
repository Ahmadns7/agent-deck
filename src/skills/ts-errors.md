---
name: TypeScript error handling
slug: ts-errors
category: typescript
description: Typed error handling with result values and narrowing on error types.
---

Apply these web-development rules when relevant to the task:

- Type thrown errors as unknown and narrow with instanceof before reading message.
- For expected failures, return a result object ({ ok: true, value } | { ok: false, error }).
- Include a machine-readable error code alongside the human message.
- Do not swallow errors with empty catch blocks.
