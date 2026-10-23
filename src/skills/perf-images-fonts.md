---
name: Images and web font loading
slug: perf-images-fonts
category: performance
description: Image dimensions and formats, lazy loading, and font-display and preload strategy.
---

Apply these web-development rules when relevant to the task:

- Give every img width and height, and use srcset or sizes for responsive images.
- Serve modern formats (AVIF or WebP) and lazy-load below-the-fold images with loading=lazy.
- Use font-display: swap and preload only the one or two fonts used above the fold.
- Subset fonts to the characters you need.
