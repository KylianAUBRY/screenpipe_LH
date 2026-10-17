# 02: Workflows view follows the app theme

**What to build:** The Workflows view (detected tasks, the Task Page, the evidence timeline, the clarification questions and « Créer l'automatisation ») is dark when the app is dark and light when it is light, with no white surface left in dark mode.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every hard-coded light colour in the view is replaced by theme tokens that follow the app's `dark` class.
- [ ] No forced light colour scheme remains on inputs or selects.
- [ ] A component test renders the view under the dark class and finds no hard-coded light surface.
- [ ] Before/after screenshots in dark and light mode are added to the ticket.
