# 06: Mandatory Clarification Questions unlock "Create automation"

Spec: `.scratch/hackathon/automation-flows-spec.md` (decision D3 in `SPEC.md`).

**What to build:** On the Task Page, when the host can create Automation
Flows, the Clarification Questions become required and a "Créer
l'automatisation" action appears. It stays disabled until every question is
answered. Clicking it saves the answers, asks the host to create the Flow
from the task (a new optional platform capability; the desktop host calls the
Flow service's create-from-task) and navigates to the Flow's Review Screen.
Hosts without the capability keep today's page unchanged.

**Blocked by:** 02, 03.

**Status:** ready-for-agent

- [ ] The action is disabled with zero or one answer and enabled with both (frontend tests).
- [ ] Clicking it creates exactly one Flow and opens its Review Screen; clicking again opens the same Flow.
- [ ] Answers are persisted.
- [ ] Pages rendered without the capability are unchanged; existing workflows UI tests pass.
