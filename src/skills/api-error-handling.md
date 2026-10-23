---
name: API error responses
slug: api-error-handling
category: node
description: A consistent error envelope with stable codes and no internal details leaked.
---

Apply these web-development rules when relevant to the task:

- Return one error shape everywhere, for example { error: { code, message, details } }.
- Use stable machine-readable codes that clients can switch on.
- Log the stack trace server-side; never send stack traces or SQL to clients.
- Map known failures explicitly and default unknown failures to a generic 500.
