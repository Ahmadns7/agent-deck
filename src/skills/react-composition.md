---
name: React composition patterns
slug: react-composition
category: react
description: Composition over prop drilling and boolean-prop explosion; compound components.
---

Apply these web-development rules when relevant to the task:

- Pass children or slot components instead of adding boolean flags like isCompact or hasIcon.
- Use compound components (Tabs.Tab, Tabs.Panel) for related pieces that share state.
- Use context only for truly shared state, wrapped in a typed hook that throws if misused.
- Keep components small and focused on one responsibility.
