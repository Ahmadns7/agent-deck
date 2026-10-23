---
name: Accessible forms and status messages
slug: a11y-forms-feedback
category: accessibility
description: Labels, error association, and live regions for status and async feedback.
---

Apply these web-development rules when relevant to the task:

- Every input needs a visible label; placeholder text is not a label.
- Link error messages to their input with aria-describedby and set aria-invalid.
- Announce async status (saved, failed, loading) through a polite aria-live region.
- Use autocomplete attributes on personal data fields.
