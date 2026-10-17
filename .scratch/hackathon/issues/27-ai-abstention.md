# 27: The AI abstains instead of guessing

Spec: `.scratch/hackathon/SPEC.md` D18; glossary `CONTEXT.md` (Abstention).

**What to build:** The demo workflow's AI step also returns its confidence
(high or low). A low-confidence answer creates no ticket: the user gets a
ScreenPipe notification « À trier à la main » with the email's sender,
subject and the AI's reason, and the Run ends successfully with the outcome
« abstained ». High-confidence answers behave as today. The deterministic
guard treats a missing or unexpected confidence as low.

**Blocked by:** 24 (reuses the n8n → ScreenPipe notification path).

**Status:** ready-for-agent

- [ ] Outside-in workflow test: low confidence never reaches Jira and produces the notification payload; a missing or unknown confidence counts as low; high confidence is unchanged.
- [ ] The review material explains the abstention in one sentence on the new node(s).
- [ ] Live check (pending human): an ambiguous email gives the notification and no ticket.
