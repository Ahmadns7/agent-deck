---
name: Tailwind utility conventions
slug: tailwind-utilities
category: css
description: Utility-first Tailwind usage, spacing scale discipline, and avoiding @apply sprawl.
---

Apply these web-development rules when relevant to the task:

- Use the theme spacing and color scale; avoid arbitrary values unless the design requires them.
- Extract repeated class lists into components, not into @apply blocks.
- Keep class order consistent (use the Prettier Tailwind plugin or equivalent).
- Use the tailwind config or CSS theme variables for brand tokens instead of hard-coded hex values.
