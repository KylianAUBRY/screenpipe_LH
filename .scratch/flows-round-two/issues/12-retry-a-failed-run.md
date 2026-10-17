# 12: Retry a failed run (D17)

**What to build:** The user retries a failed run from the Review Screen or from the failure notification. The email was already marked read and its run and input are kept in n8n, so nothing is lost; with duplicate-safe creation, a retry never makes a second ticket.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 10, 11

**Status:** ready-for-agent

- [ ] A retry route calls n8n's execution retry for the Flow's failed run.
- [ ] The Review Screen and the failure notification offer « Relancer ».
- [ ] Engine integration and component tests cover retry and its errors.
- [ ] A forced failure, fixed then retried, ends in exactly one ticket (live, noted).
