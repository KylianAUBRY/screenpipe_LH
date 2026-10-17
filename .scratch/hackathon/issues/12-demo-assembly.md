# 12: Assemble and rehearse the 3-minute demo

Spec: `.scratch/hackathon/automation-flows-spec.md` (demo script and acceptance list in `SPEC.md`).

**What to build:** The full journey runs on the demo machine: notification →
Task Page with evidence → two answers → "Créer l'automatisation" → Review
Screen with graph → View graph in n8n → Activate → a bug email sent live
becomes the right ticket → chat change → Needs Review → re-activate. The
bundled fixture is the final export from the demo n8n instance (credentials
bound, ScreenPipe tool wired). Demo and reset scripts restore the start
state between runs.

**Blocked by:** 01, 04, 05, 06, 07, 08, 13, 14, 15, 16.

**Status:** ready-for-agent

- [ ] Every item of the acceptance list in `SPEC.md` is checked with its observed result.
- [ ] Three consecutive rehearsals fit in 3 minutes.
- [ ] Reset between rehearsals restores the start state (no leftover Flow, answers or unread demo emails).
- [ ] A fallback is written down if the live chat change fails rehearsal (e.g. a recorded clip).
