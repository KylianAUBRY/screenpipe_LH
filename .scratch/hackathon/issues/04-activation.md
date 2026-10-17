# 04: Activate and deactivate a Flow from the Review Screen

Spec: `.scratch/hackathon/automation-flows-spec.md` (Flow model and status derivation in `SPEC.md`).

**What to build:** The Review Screen gets Activate and Deactivate. They switch
the n8n workflow on and off through the Flow service. Activation records the
activated version; both actions append to the activation history. The
Review Screen and the Flows list show the derived status (Draft, Active,
Paused, Needs Review), the last run from n8n's executions, and the activation
history (when, what, which version, by whom).

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Flow service tests against a fake n8n: activate records the version and a history entry; deactivate adds a history entry; status derivation covers Draft, Active, Paused, Needs Review and the "edited in n8n" flag; the last execution is mapped.
- [ ] Review Screen buttons call the typed client and refresh; status, last run and history render (frontend tests).
- [ ] No code path activates a Flow without a user click.
- [ ] Against the local n8n: activating from the app makes the workflow process a new email; deactivating stops it.
