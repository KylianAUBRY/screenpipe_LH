# 10: Duplicate-safe ticket creation (D20)

**What to build:** Every ticket carries the label `mail-<first 8 hex of a hash of the email's Message-ID>`, and the demo Flow searches Jira for that label before creating; when a ticket already exists it skips creation and the run succeeds.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The label is computed from the Message-ID and set on every ticket.
- [ ] A JQL search runs before creation; a hit skips creation and ends the run successfully.
- [ ] The workflow contract test covers both paths.
- [ ] Running the same email twice creates one ticket (live, noted).
