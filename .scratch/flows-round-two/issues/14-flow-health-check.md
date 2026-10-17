# 14: Flow health check (D19)

**What to build:** At app start and every 15 minutes, ScreenPipe checks its Flows: when n8n is unreachable a banner says « n8n injoignable, tes Flows ne tournent pas »; failed runs since the last check become notifications (catching failures that happened while the app or n8n was down); drafts left under construction more than 24 hours without a change are deleted.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** 07, 11

**Status:** ready-for-agent

- [ ] The check runs at start and every 15 minutes.
- [ ] An unreachable n8n shows the banner; it disappears once n8n answers.
- [ ] Failed runs since the last check produce one notification each, never twice.
- [ ] Building drafts unchanged for 24 hours are deleted.
- [ ] Engine integration and component tests cover each part.
