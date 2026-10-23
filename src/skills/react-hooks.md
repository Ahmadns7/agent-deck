---
name: React hooks
slug: react-hooks
category: react
description: Hook rules, dependency arrays, custom hooks, and avoiding effects for derived state.
---

Apply these web-development rules when relevant to the task:

- Call hooks only at the top level of function components or custom hooks.
- Derive values during render instead of storing them in state and syncing with useEffect.
- Keep effect dependency arrays honest; fix the code rather than suppressing the lint rule.
- Extract reusable logic into custom hooks named useSomething, returning stable values.
- Clean up subscriptions, timers, and listeners in the effect's return function.
