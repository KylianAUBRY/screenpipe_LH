# 08: Ask the chat to change a Flow; it pauses and needs review

Spec: `.scratch/hackathon/automation-flows-spec.md` (decisions D5, D7 in `SPEC.md`).

**What to build:** "Demander une modification" on the Review Screen opens the
existing ScreenPipe chat with the Flow id in a prefilled prompt. A new
`automation-flows` skill teaches the agent to read the Flow, edit its n8n
workflow while keeping a one-sentence note on every node, update the summary
if needed, and send the result to the Flow service's update route; it never
activates and ends with the Review Screen link. The update route switches an
active Flow off first, updates the same n8n workflow in place and records
both events in the history. The Review Screen shows a Needs Review banner
until the user activates again.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] Flow service tests against a fake n8n: updating an active Flow switches it off first and records "paused for edit" then "modified"; the status becomes Needs Review; updating a Draft keeps it Draft.
- [ ] The banner and the button render and behave as expected (frontend tests).
- [ ] The rehearsed request « Ajoute l'étiquette `auto` à chaque ticket créé » changes the workflow in n8n, leaves the Flow Needs Review and switched off; after re-activation, the next ticket carries the label.
- [ ] The skill never calls activate.
