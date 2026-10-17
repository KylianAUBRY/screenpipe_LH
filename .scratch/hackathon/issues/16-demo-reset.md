# 16: Demo reset restores the start state

Spec: `.scratch/hackathon/automation-flows-spec.md` (story 50); ticket 12 ("Reset between rehearsals restores the start state (no leftover Flow, answers or unread demo emails)").

**What to build:** `bun infra/automation-flows/demo/reset.ts` (today it only
clears the saved answers) brings the demo machine back to the state before the
first click, so rehearsals can repeat:

- every Flow created from the demo task (`sourceTaskId`
  `wf-novadesk-support-tickets` in `<data dir>/automation-flows.json`) and the
  pre-imported copy (fixed id in the bundled workflow) is switched off and
  deleted in n8n, and its local record removed, so the Flows list is empty and
  "Créer l'automatisation" creates the Flow again;
- the Task Page answers are cleared (existing behavior);
- unread messages in the demo inbox are marked read, so the next activation
  only processes the email sent live. Use the IMAP credential already stored
  in n8n (`spNovaImap000001`) from inside the n8n container; never print,
  log or keep a secret outside a temporary file that is removed.

It prints what it did and fails loudly (non-zero exit) on anything it could
not restore. Workflows that are not demo Flows are never touched. The n8n API
key comes from ScreenPipe's n8n connection or an environment variable; never
from the repo.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Tests against fake n8n / ScreenPipe servers: demo Flows are switched off then deleted and their records removed; other workflows untouched; answers cleared; a failure exits non-zero with the reason.
- [ ] On the demo machine (agent-verified by the orchestrator): after a full rehearsal, reset leaves an empty Flows list, empty answers and zero unread demo emails, and the next "Créer l'automatisation" works.
