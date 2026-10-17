# 07: ScreenPipe node gives the AI Agent the user's memory

Spec: `.scratch/hackathon/automation-flows-spec.md` (decisions D11, D12 in `SPEC.md`).

**What to build:** A new n8n node package with a shared "ScreenPipe API"
credential (base URL, API key) and a ScreenPipe node with two operations,
search content and activity summary, usable both as a step and as an AI
Agent tool. The package is built and mounted into the local n8n. The demo
n8n workflow's AI Agent gets it as its tool and uses it to find how the user
handled similar emails before (the captures of the earlier ticket creations),
so the tickets follow those conventions.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Package tests against a fake ScreenPipe API: parameters and auth header are sent as expected; results are returned; HTTP errors surface as node errors.
- [ ] The node appears in the local n8n palette and as a tool option of the AI Agent.
- [ ] On the demo machine, the agent's tool call returns captures of the earlier tickets, and a new ticket follows the observed conventions.
- [ ] A build step copies the node into the mounted custom-nodes folder; built output is never committed.
- [ ] The demo fixture (from 01) is re-exported with the tool wired in.
