# 23: Review fixes — Review Screen, Task Page, demo workflow, n8n nodes

Spec: stories 4–5, 16–22, 30, 47–48; `docs/DESIGN.md`; AGENTS.md (Review
Screen: « View in timeline »). From the independent code review of
2026-10-17. Runs in parallel with ticket 22 (engine), which adds
`Flow.nodes[].facts: string[]`, `Flow.sourceMoment: {frameId: number | null,
timestamp: string} | null`, `by: "api"` and the codes `flow_running`,
`n8n_failed` — code against that contract (mock it in tests); ticket 22 owns
`api.ts` types, so add only what you need and expect a merge.

**What to build:**

1. **DESIGN.md compliance** (`apps/screenpipe-app-tauri/components/automation-flows/`):
   no casing forced by CSS (`uppercase` in `common.tsx` `SectionLabel` /
   `ACTION_BUTTON`): labels in sentence case (« Activer », « Voir le
   graphe », …); the « Active » status badge is not phosphor (phosphor only
   while work is running); brand spelled « Screenpipe » in user-facing copy
   of the app (Flows UI, Task Page question block in
   `packages/workflows-ui/src/workflow-questions.tsx`, the n8n connection
   description in `crates/screenpipe-connect/src/connections/n8n.rs`). n8n
   node names (« ScreenPipe Trigger ») stay as specified.
2. **Activer publishes what the user read.** The Review Screen keeps the
   `versionId` of the user's last explicit load; when a background refresh
   (ticket 18) brings another version, show the « a changé » banner and keep
   sending the old id, so the engine answers 409 and the user reloads.
3. **Facts under each step.** Render `facts` under the node's sentence in the
   read-only graph (small, muted).
4. **« Voir dans la timeline ».** On the Review Screen, when `sourceMoment` is
   set, a « Voir dans la timeline » action opens that moment (same opening path
   the Task Page evidence uses). On the Task Page, the evidence play button
   shows the visible text « Voir dans la timeline » in creation mode.
5. **Jira description cannot carry markup** (`infra/automation-flows/workflows/novadesk-support-tickets.json`,
   « Préparer le ticket »): the email body goes inside `{noformat}` with any
   `{noformat}` removed from it, HTML stripped from the `textHtml` fallback,
   and the whole description capped (e.g. 20 000 chars) so Jira never refuses
   it. Keep `bun test infra/automation-flows` in sync (add injection cases).
   Keep the review JSON in sync if its sentence changes.
6. **AI Trigger** (`packages/n8n-nodes-screenpipe/nodes/ScreenPipeAiTrigger/`):
   the look-back starts at `max(now - lookback, lastFiredAt)` so one episode
   does not fire again after the cooldown; screen text is escaped so it
   cannot close the `<activity>` delimiter.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] Frontend tests for 1–4; `bun x tsc --noEmit -p .` clean.
- [ ] `bun test infra/automation-flows` and `cd packages/n8n-nodes-screenpipe && bun test` with the new cases.
