---
name: TypeScript types for API data
slug: ts-api-types
category: typescript
description: Validate external data at runtime and derive types from the validator, not from casts.
---

Apply these web-development rules when relevant to the task:

- Never cast JSON responses with 'as'; parse them with a schema validator (for example zod) first.
- Derive the TypeScript type from the schema with z.infer so they cannot drift.
- Keep request and response types separate.
- Surface validation failures as typed errors rather than throwing raw parse errors into the UI.
