# 09: AI abstains when unsure (D18)

**What to build:** When the AI's confidence is low, the demo Flow creates no ticket and sends a ScreenPipe notification « À trier à la main » with the email's sender, subject and the AI's reason.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Low confidence takes a branch that creates no ticket.
- [ ] That branch posts a notification to ScreenPipe's notify server with sender, subject and reason.
- [ ] The workflow contract test covers the branch.
- [ ] An ambiguous email produces the notification and no ticket (live, noted).
