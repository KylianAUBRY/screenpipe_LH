# 08: Simplified AI step in the demo Flow

**What to build:** The demo Flow reads: email trigger → one AI agent with a short instruction and ScreenPipe tools (history search, activity summary) returning type, product, summary, priority, label and confidence → ticket needed? → Jira ticket created by a fixed node. The email-sanitizing expressions are gone; the instruction still treats the email as data. Its review material and the browser-mock fixture match.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The demo workflow has one agent with ScreenPipe tools, a short instruction and a structured output including `confidence`.
- [ ] The Jira ticket is created by a fixed node from the AI's fields.
- [ ] No sanitizing expressions remain; every node has its one-sentence note.
- [ ] The workflow passes the Flow check; the workflow contract test is updated.
- [ ] The pre-written summary, node sentences and browser-mock fixture match the new graph.
- [ ] A real support email still produces the right Jira ticket (live, noted).
