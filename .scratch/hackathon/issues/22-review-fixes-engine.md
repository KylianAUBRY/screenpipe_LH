# 22: Review fixes — Flow service (engine)

Spec: stories 12, 22–24, 31, 34–38, 44; AGENTS.md "nothing activates without
an explicit user action". From the independent code review of 2026-10-17
(standards, spec, correctness/security) and rehearsal 3. Includes ticket 21.

**What to build** (all in `crates/screenpipe-engine/src/automation_flows.rs`
+ its tests, the typed client `apps/screenpipe-app-tauri/components/automation-flows/api.ts`
for new codes/fields, and the `automation-flows` skill):

1. **Ticket 21** — see `21-pause-waits-for-running-executions.md`.
2. **Who deactivated.** `POST /:id/deactivate` logs `by: "user"` only when the
   request carries the UI activation credential (ticket 14's header);
   otherwise `by: "api"`. The client sends the header on Désactiver too.
3. **Activated outside the review.** `reviewOutdated` is also true when the
   workflow is active and its `activeVersionId` is not the
   `reviewedVersionId` (published in n8n, by the CLI or anyone, without the
   Review Screen's click). The existing banner and « Activer cette version »
   then show.
4. **The chat cannot wire secrets.** Chat creation (`POST /`) drops every
   node's `credentials`. Chat modification (`PUT /:id`) takes each node's
   `credentials` from the current n8n workflow for nodes that keep their
   name and type, and drops them on new or retyped nodes — never from the
   request.
5. **Fixed facts per step.** `Flow.nodes[].facts: string[]` lists what the
   AI did not write: the names of the n8n credentials the node uses, and for
   an HTTP Request node the method and the URL host. (Ticket 23 renders it.)
6. **Creation never takes over an existing Flow.** In `create_from_task`, if a
   local record already exists for the pre-imported fixed id, adopt it (set
   `sourceTaskId`, keep its history and reviewed version, do not unpublish);
   only a copy with no record is switched off and recorded as today.
7. **n8n errors are named right.** Connection failures/timeouts stay `502
   n8n_unreachable`; 401/403 stay `412 n8n_unauthorized`; any other non-2xx
   from n8n becomes `502 {error: "n8n_failed", detail}`.
8. **No MCP side door.** Drop `availableInMCP` from the settings the Flow
   service accepts (chat) and from the bundled demo workflow's settings.
9. **Where the task was seen.** `Flow.sourceMoment: {frameId: number | null,
   timestamp: string} | null`: for a Flow created from a Detected Task, the
   first evidence moment of that task in the workflow catalog (the engine
   already reads it for `/workflows/catalog`); `null` otherwise. (Ticket 23
   renders « Voir dans la timeline ».)

Skill: say chat changes cannot add credentials (the user picks them in n8n)
and what `flow_running` means (wait and retry once).

**Blocked by:** None. Ticket 23 runs in parallel on the frontend, the demo
workflow's Jira step and the n8n nodes; it codes against the contract above.

**Status:** ready-for-agent

- [ ] Engine tests (fake n8n) for each numbered item; existing tests pass.
- [ ] Client types/codes and messages for `flow_running`, `n8n_failed`, `by: "api"` (« Désactivé hors de Screenpipe »), `facts`, `sourceMoment`.
