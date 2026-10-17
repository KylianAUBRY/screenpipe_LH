# 11: Notification on a failed run (D16)

**What to build:** When a Flow run fails, an n8n Error Workflow alerts ScreenPipe: a notification names the email's sender and subject and opens the Flow's Review Screen; the Flow shows red in the list. Nothing is paused.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Flows get an Error Workflow that posts the Flow id, sender and subject to ScreenPipe's notify server.
- [ ] The notification deep-links to the Review Screen.
- [ ] A Flow whose last run failed is red in the list and stays active.
- [ ] Tests cover the error-workflow wiring, the notification input and the red state; a forced failure is checked live and noted.
