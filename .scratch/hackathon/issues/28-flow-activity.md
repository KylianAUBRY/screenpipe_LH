# 28: The Review Screen shows the Flow's Activity

Spec: `.scratch/hackathon/SPEC.md` D18; glossary `CONTEXT.md` (Activity).

**What to build:** The Review Screen gains an Activity section: the recent
Runs of the Flow, newest first, and for each handled email its sender and
subject, the outcome (ticket created with its key, ignored, abstained,
failed) and the reason. The user can spot a wrong « ignored » at a glance.
The data comes from n8n's executions through the Flow service; the demo
workflow's last step exposes a stable outcome record for each item.

**Blocked by:** 27 (the « abstained » outcome must exist).

**Status:** ready-for-agent

- [ ] Flow service tests against the fake n8n: the Activity route maps executions to outcomes and reasons, newest first, limited in size; a Run without an outcome record shows as failed or unknown, never as success.
- [ ] Frontend tests: each outcome renders with its reason; an empty Activity says so.
- [ ] Live check (pending human): one bug, one idea, one ambiguous and one security-alert email give the four expected lines.
