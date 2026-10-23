---
name: Deploying on Vercel
slug: devops-deploy-vercel
category: devops
description: Preview deployments, per-environment variables, cache headers, and rollback.
---

Apply these web-development rules when relevant to the task:

- Use preview deployments for every branch and test them before merging to main.
- Keep environment variables scoped per environment (preview vs production).
- Set cache headers in vercel.json or the framework config; keep hashed assets immutable.
- Roll back by promoting a previous known-good deployment rather than hot-fixing production.
