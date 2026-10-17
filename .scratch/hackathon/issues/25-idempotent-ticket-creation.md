# 25: The same email never creates two tickets

Spec: `.scratch/hackathon/SPEC.md` D20.

**What to build:** The demo workflow gives every ticket it creates a label
derived from the email's identity (`mail-` + the first 8 hex characters of a
hash of its Message-ID) and, before creating, searches the Jira project for
that label. If a ticket already carries it, creation is skipped and the Run
ends successfully. Replaying an email (a retried Run, a restored inbox) is
therefore always safe. The review material (node sentences, summary) says so
in plain language.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Outside-in workflow test: the label is computed deterministically from the Message-ID; the search happens before creation; a found label skips creation; an email without Message-ID falls back to a stable hash of sender + date + subject.
- [ ] Prompt-injection guards and every existing workflow test still pass.
- [ ] Live check (pending human): the same email processed twice gives one ticket.
