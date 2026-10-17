# 07: Chat builds a Flow step by step

**What to build:** The chat starts a hidden draft in n8n, changes it step by step and, after each step, reads the state of every node: complete, or exactly what is missing (empty required parameters, missing credentials, unlinked nodes, no trigger), and which credential ScreenPipe wired. A step using an invented or switched-off node type or an unknown version is refused at once. « Terminer » is refused while anything is missing, listing every problem; once accepted, the Flow appears in ScreenPipe as a Draft to review, switched off. A draft under construction is invisible in the Flows list and cannot be activated. The chat deletes a draft it abandons.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Routes: start a draft, update it, read its state, finish it.
- [ ] Drafts carry an under-construction mark in n8n and a building state in ScreenPipe; they are excluded from the list and from activation.
- [ ] Updates refuse only invented or switched-off types and unknown versions; the state lists the other problems per node and the wired credentials.
- [ ] Finish runs the full ticket-26 check; on success the Flow becomes a Draft.
- [ ] Changing an existing Flow keeps today's route and rules.
- [ ] The skill documents the building procedure, including deleting an abandoned draft.
- [ ] Engine integration tests cover each step, the state, a refused and an accepted finish, hiding and non-activation.
