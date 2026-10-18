---
type: internal
---

The end-to-end tests are split into a fast tier, which `npm test`, CI and `release:prepare` run, and a slow tier (`npm run test:slow`, the manual "Slow tests" workflow) that runs when a plan is about to complete and before a release is prepared; `test.yml` runs the fast tiers in parallel jobs.
