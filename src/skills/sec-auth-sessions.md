---
name: Authentication and sessions
slug: sec-auth-sessions
category: security
description: Secure session cookies, token storage tradeoffs, and CSRF protection.
---

Apply these web-development rules when relevant to the task:

- Store session tokens in HttpOnly, Secure, SameSite cookies, not in localStorage.
- Protect state-changing requests against CSRF with SameSite cookies plus a CSRF token where needed.
- Expire sessions, rotate them on login, and invalidate them on logout.
- Hash passwords with argon2 or bcrypt, never with plain SHA.
