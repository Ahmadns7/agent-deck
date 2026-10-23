---
name: Keyboard access and focus management
slug: a11y-keyboard-focus
category: accessibility
description: Keyboard operability, visible focus, focus trapping in dialogs, and skip links.
---

Apply these web-development rules when relevant to the task:

- Every interactive control must be reachable and operable with the keyboard alone.
- Never remove focus outlines without a visible replacement; use :focus-visible.
- Move focus into dialogs when they open, trap it inside, and return it to the trigger on close.
- Provide a skip-to-content link as the first focusable element.
