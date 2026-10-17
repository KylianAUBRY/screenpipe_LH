# 09: Create a Flow from the chat (Add)

Spec: `.scratch/hackathon/automation-flows-spec.md` (decision D5 in `SPEC.md`). Not on the demo path.

**What to build:** The "Ajouter" button of the Flows list opens the ScreenPipe
chat with a prefilled creation prompt. The `automation-flows` skill gains a
creation section: describe the automation, build an n8n workflow with a
one-sentence note per node and a summary, and send it to the Flow service's
create route, which imports it switched off and tagged and stores the
summary. The agent ends with the Review Screen link; the user activates
explicitly, like any Flow.

**Blocked by:** 08 (same skill).

**Status:** ready-for-agent

- [ ] Flow service tests against a fake n8n: create imports switched off and tagged and stores the summary; a workflow without nodes is rejected.
- [ ] The Add button opens the chat with the prefilled prompt.
- [ ] A chat-created Flow appears in the list as Draft and runs only after an explicit activation.
