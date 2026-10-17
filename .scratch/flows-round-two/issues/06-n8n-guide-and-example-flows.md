# 06: n8n reference guide and example Flows for the chat

**What to build:** The chat has a reference guide it reads on demand: n8n expressions, references to earlier nodes, IF/Switch/Merge, error handling, AI sub-nodes, and three or four complete example Flows (ScreenPipe trigger to action, email to AI to ticket, schedule to summary). The skill no longer hard-codes node versions.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The guide file ships with the skill and is linked from it.
- [ ] Every example Flow passes the Flow check (a test runs them through it).
- [ ] No node version is hard-coded in the skill; it points to the lookup instead.
- [ ] The skill's existing tests still pass.
