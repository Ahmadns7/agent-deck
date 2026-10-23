---
name: React rendering performance
slug: perf-rendering
category: performance
description: Avoid needless re-renders, memoize only when measured, and virtualize long lists.
---

Apply these web-development rules when relevant to the task:

- Profile with the React DevTools profiler before adding memo, useMemo, or useCallback.
- Move state down so only the components that use it re-render.
- Virtualize lists longer than a few hundred rows.
- Avoid creating new objects or arrays in props on every render when a child depends on referential equality.
