---
name: React Testing Library
slug: test-react-testing-library
category: testing
description: Query by role and label, simulate real user events, and wait for async UI correctly.
---

Apply these web-development rules when relevant to the task:

- Query by role and accessible name first (getByRole, getByLabelText); avoid test ids unless needed.
- Use user-event for interactions instead of fireEvent.
- Use findBy or waitFor for async UI rather than fixed sleeps.
- Assert on what the user sees, not on component state.
