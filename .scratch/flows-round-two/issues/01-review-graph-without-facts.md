# 01: Review graph without the facts block

**What to build:** On the Review Screen, every graph card shows only its one-sentence explanation. No n8n credential name and no called host appear anywhere in the app; the user still sees them in n8n (« Voir le graphe »). The Flow the service returns no longer carries per-node facts.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Flow service no longer returns per-node facts for any Flow (chat-built or from a task).
- [ ] Graph cards render only the sentence; no extra block appears under any node, including credentialed and HTTP Request nodes.
- [ ] Engine integration tests and graph component tests that asserted facts now assert their absence.
- [ ] Browser-mock fixtures carry no facts.
