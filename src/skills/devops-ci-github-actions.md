---
name: CI with GitHub Actions
slug: devops-ci-github-actions
category: devops
description: Lint, test, and build gates with caching, matrix runs, and pinned actions.
---

Apply these web-development rules when relevant to the task:

- Run lint, typecheck, test, and build as separate steps that all must pass.
- Cache dependencies with the setup-node cache option keyed to the lockfile.
- Use npm ci, not npm install, in CI.
- Set least-privilege permissions on the GITHUB_TOKEN in each workflow.
