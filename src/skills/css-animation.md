---
name: CSS animation with reduced motion
slug: css-animation
category: css
description: Motion that animates transform and opacity and respects prefers-reduced-motion.
---

Apply these web-development rules when relevant to the task:

- Animate only transform and opacity; avoid animating layout properties like top, width, or height.
- Wrap non-essential motion in @media (prefers-reduced-motion: no-preference) or disable it under reduce.
- Keep durations short (150 to 300ms for UI) and use ease-out for entrances.
- Use will-change sparingly and only on elements that actually animate.
