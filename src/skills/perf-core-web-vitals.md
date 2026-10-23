---
name: Core Web Vitals optimization
slug: perf-core-web-vitals
category: performance
description: Improve LCP, INP, and CLS by fixing measured causes, not guessing.
---

Apply these web-development rules when relevant to the task:

- Measure first (Lighthouse, web-vitals, or field data) and name the metric you are fixing.
- LCP: preload the hero image, avoid render-blocking CSS and JS, and serve the server response fast.
- INP: break up long tasks, defer non-urgent work, and avoid heavy synchronous handlers.
- CLS: reserve space with width and height or aspect-ratio for images, embeds, and async content.
