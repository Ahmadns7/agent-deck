---
name: Preventing XSS
slug: sec-xss
category: security
description: Escape output, avoid raw HTML injection, sanitize user HTML, and set a strict CSP.
---

Apply these web-development rules when relevant to the task:

- Rely on React's escaping; never pass untrusted strings to dangerouslySetInnerHTML.
- If you must render HTML, sanitize it with a vetted library such as DOMPurify.
- Validate and encode URLs; block javascript: URLs in href and src.
- Set a Content-Security-Policy that disallows inline scripts where possible.
