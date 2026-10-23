---
name: Dependency and supply-chain security
slug: sec-dependency-audit
category: security
description: Audit dependencies, commit lockfiles, and keep the dependency surface small.
---

Apply these web-development rules when relevant to the task:

- Commit the lockfile and install with npm ci in CI.
- Run npm audit or an equivalent scanner in CI and triage high-severity findings.
- Prefer fewer, well-maintained dependencies; check download and maintenance health before adding one.
- Pin GitHub Actions and other tooling to versions or commit SHAs you have reviewed.
