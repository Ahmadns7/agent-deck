---
name: API mocking with MSW
slug: test-msw-mocking
category: testing
description: Mock Service Worker for network-level mocks shared by tests and local dev.
---

Apply these web-development rules when relevant to the task:

- Mock at the network boundary with request handlers instead of mocking fetch or axios.
- Define default handlers once and override per test with server.use().
- Reset handlers after each test to avoid leaking state.
- Return realistic error responses (401, 500, timeouts) to test failure paths.
