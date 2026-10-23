---
name: End-to-end testing with Playwright
slug: test-e2e-playwright
category: testing
description: Stable locators, web-first assertions, fixtures, and CI-friendly retries.
---

Apply these web-development rules when relevant to the task:

- Use role-based and text locators; avoid brittle CSS chains and nth-child selectors.
- Use web-first assertions (expect(locator).toBeVisible()) which auto-retry.
- Isolate tests with fresh browser contexts and seed data through fixtures or API calls.
- Keep E2E tests to critical user journeys; push edge cases down to unit tests.
