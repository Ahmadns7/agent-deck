---
name: Input validation and injection
slug: sec-input-validation
category: security
description: Validate all external input on the server with allowlists and parameterized queries.
---

Apply these web-development rules when relevant to the task:

- Validate every external input on the server; client validation is only for UX.
- Prefer allowlists (known values, length limits, formats) over blocklists.
- Use parameterized queries or an ORM; never build SQL by string concatenation.
- Limit request body size and reject unexpected fields.
