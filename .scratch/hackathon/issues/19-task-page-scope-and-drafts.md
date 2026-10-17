# 19: Task Page — creation mode only where it works, answers never lost

Spec: `.scratch/hackathon/automation-flows-spec.md` (stories 6–10); ticket 06 (what exists). Found by the spec audit (`.scratch/hackathon/issues/` gaps 8, 9, 11).

**What to build:**

- Only a Detected Task that can become an Automation Flow gets the
  "required Clarification Questions + Créer l'automatisation" mode. Today
  `packages/workflows-ui/src/workflows-app.tsx` (~line 749) passes `createFlow`
  for every task, so other tasks lose their optional answers / "Not sure" and
  the button fails with 404. Add a platform predicate (e.g.
  `canCreateAutomationFlow(taskId)`); the desktop platform answers from what
  the Flow service can create (today: the demo task id, see
  `crates/screenpipe-engine/src/automation_flows.rs` `DEMO_TASKS`). Any other
  task renders exactly as before (story 10).
- Answers being typed survive leaving the page (story 9): save drafts as the
  user types (debounced, through the existing save path or a per-task draft
  restored on mount), not only on submit.
- The question block texts on the Task Page are French like the rest of the
  demo flow (today some labels are English, `workflow-questions.tsx` ~143–151).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Frontend tests: a non-creatable task keeps the old page (optional answers, "Not sure", no Créer button); the demo task keeps the required mode; a typed answer is restored after unmount/remount without pressing save.
- [ ] Existing workflows-ui and Task Page tests still pass.
