---
name: JavaScript bundle size
slug: perf-bundle-size
category: performance
description: Code splitting, lazy routes, tree shaking, and checking what actually ships.
---

Apply these web-development rules when relevant to the task:

- Lazy-load routes and heavy components with dynamic import().
- Import from specific module paths instead of barrel files that pull in whole libraries.
- Check bundle composition with a visualizer before adding a dependency.
- Prefer lighter alternatives for small utilities and remove unused dependencies.
