# 15: Every spec feature has an automated test

**What to build:** Every feature of the hackathon spec and of ticket 27 is mapped to the automated test that covers it, at the highest seam (Flow service routes against the fake n8n, app components in the browser-mock, the workflow JSON contract, the demo trigger function), and the missing tests are written.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14

**Status:** ready-for-agent

- [ ] A feature → test table is committed next to the spec.
- [ ] Every row names a passing automated test; gaps are filled.
- [ ] All suites pass: engine, n8n nodes, workflow and catalog tests, app vitest suites touched by the spec.
