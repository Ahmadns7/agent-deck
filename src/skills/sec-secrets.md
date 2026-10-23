---
name: Secrets and environment variables
slug: sec-secrets
category: security
description: Keep secrets server-side, handle env vars safely, and rotate anything leaked.
---

Apply these web-development rules when relevant to the task:

- Never ship secrets to the client; anything prefixed for the browser is public.
- Keep .env files out of git and provide a .env.example with placeholder values.
- If a key is committed or pasted publicly, rotate it immediately and treat the old one as compromised.
- Use least-privilege, scoped API keys with spending limits.
