---
name: Unit testing with Vitest
slug: test-unit-vitest
category: testing
description: Arrange-act-assert unit tests, boundary mocking, and testing behavior not internals.
---

Apply these web-development rules when relevant to the task:

- Structure tests as arrange, act, assert, with one behavior per test.
- Test observable outputs and side effects, not private implementation details.
- Mock only at boundaries (network, clock, storage), not the module under test.
- Name tests as sentences describing the behavior.
