# 05: Read-only graph of the n8n workflow with one sentence per node

Spec: `.scratch/hackathon/automation-flows-spec.md`.

**What to build:** The Review Screen renders the Flow's nodes and edges as a
read-only graph with the graph library the app already ships, placed from the
n8n node positions. Each node shows its name and its one-sentence
explanation; a node without a sentence shows a neutral placeholder. The graph
is a picture of the workflow, not an editor.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Every non-sticky node appears once with its sentence; edges follow the n8n connections.
- [ ] The graph cannot be edited (no connecting, moving into new links or deleting).
- [ ] Works in the browser mock with the fixture Flow; frontend tests cover the rendering.
