---
name: React error boundaries and Suspense
slug: react-error-boundaries
category: react
description: Error boundaries, Suspense fallbacks, and graceful degradation for failed sections.
---

Apply these web-development rules when relevant to the task:

- Wrap independently failing sections in their own error boundary so one failure does not blank the page.
- Provide a useful fallback with a retry action.
- Place Suspense boundaries around the data that loads, with skeletons that match the final layout.
- Log caught errors to your error tracker with component context.
