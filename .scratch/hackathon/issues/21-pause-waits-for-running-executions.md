# 21: Switching a Flow off never orphans the execution in progress

Spec: stories 31 (each email processed once — never lost either), 36 (a change
to an active Flow switches it off first). Found in rehearsal 3 (2026-10-17).

**What happened:** the bug email arrived 5 s after « Activer »; n8n's IMAP
trigger fetched it, marked it read and started execution 22. Fifteen seconds
later the chat change unpublished the workflow. Execution 22 stayed `running`
with no node run, forever; the email, already read, was lost (no ticket).
Rehearsal 2 only escaped because its execution finished 2 s before the pause.

**What to build:** before the Flow service unpublishes an active workflow —
chat modification (`PUT /automation-flows/:id`) and deactivation
(`POST /:id/deactivate`) — it waits while n8n reports a running execution of
that workflow (`GET /executions?workflowId=<id>&status=running`), polling
about every second, up to a bounded time (≈90 s; the demo's AI step takes
10–25 s). If one is still running at the deadline, it changes nothing and
answers `409 {error: "flow_running", detail}`; the client and the
`automation-flows` skill say to try again in a moment. Activation is
unchanged.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] Engine tests (fake n8n): a running execution that finishes → the change/deactivation waits, then unpublishes; one still running at the deadline → 409 `flow_running`, no unpublish, no history entry; none running → immediate as today.
- [ ] Review Screen « Désactiver » and the chat show the `flow_running` message; skill updated.
- [ ] Live (orchestrator): bug email, then the chat change while it is processed → the ticket is created, then the Flow is paused.
