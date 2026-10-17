# 29: ScreenPipe checks Flow health at start and every 15 minutes

Spec: `.scratch/hackathon/SPEC.md` D19.

**What to build:** A failure can happen while nothing can report it: the
ScreenPipe app (AI proxy and notification server) was closed, or n8n was
down. At app start and then every 15 minutes, ScreenPipe checks that n8n
answers and looks for Failed Runs since its last check. If n8n does not
answer, the Flows tab and Review Screen show a banner « n8n injoignable, tes
Flows ne tournent pas ». Failed Runs found by the check become the same
notifications as D16, once each (never twice for the same Run, across
restarts).

**Blocked by:** 24 (same notification content).

**Status:** ready-for-agent

- [ ] Tests: the check notifies each Failed Run once, remembers its position across restarts, and does nothing when there are no Flows; an unreachable n8n sets the banner state instead of failing.
- [ ] The check never blocks the app start or the recording hot path (runs in the background, bounded).
- [ ] Live check (pending human): quit the app, make a Run fail, reopen the app, get the notification.
