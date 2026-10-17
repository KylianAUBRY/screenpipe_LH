# 13: Flow Activity on the Review Screen (D18)

**What to build:** The Review Screen lists the Flow's Activity: for each handled email, the outcome (ticket, ignored, abstained, failed) and the reason, read from n8n's executions.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 09, 11

**Status:** ready-for-agent

- [ ] The service derives each run's outcome and reason from n8n execution data.
- [ ] The Review Screen shows the Activity list, newest first.
- [ ] Engine integration tests cover each outcome; a component test covers the list.
