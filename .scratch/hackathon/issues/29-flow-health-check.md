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

**Status:** done on `hackathon/ticket-29`; live check pending human.

- [x] Tests: the check notifies each Failed Run once, remembers its position across restarts, and does nothing when there are no Flows; an unreachable n8n sets the banner state instead of failing (engine tests against the fake n8n; frontend tests for the banner).
- [x] The check never blocks the app start or the recording hot path (runs in the background, bounded).
- [ ] Live check (pending human): quit the app, make a Run fail, reopen the app, get the notification. Steps below.

## How it works

- `crates/screenpipe-engine/src/automation_flows/health.rs`. The engine spawns
  the check from the Flow service router (`SCServer::flow_health_check`, default
  30 s after start, then every 15 min). It is a tokio task, one check at a time,
  each capped at 5 min, and it stops when the router is dropped. Without an n8n
  connection it does nothing.
- A check lists the Flows (tag `screenpipe-flow`) and reads each Flow's last 100
  Runs. Every `error`/`crashed` Run that stopped after the position minus 2 min
  (clock drift, a Run stopping during a check) and was never notified goes
  through `notify_failed_run`. That is ticket 24's notification and execution-id
  dedupe (`notified_failed_runs`), shared with `POST /failed-runs`, so a Run is
  notified once, whoever finds it first.
- Position: `health_checked_at` in `automation-flows.json`, the check's start
  time. It moves only when every Failed Run found was handled. If n8n does not
  answer, a Runs read fails, or `/notify` refuses (the app is still starting),
  it stays and the next check retries. The first check ever (no position)
  starts from now and does not notify older failures.
- `GET /automation-flows/health` probes n8n (5 s). The Flows list and the Review
  Screen read it on open, on focus and every 15 s, and show the banner
  « n8n injoignable, tes Flows ne tournent pas » while it says `unreachable`.
  When the screen's own load fails with `n8n_unreachable`, the error box uses
  the same words, once.
- `POST /automation-flows/health/check` runs one check now (tests, manual
  check).

## Manual check (pending human)

Needs the dev build of this branch (`bun run dev:tauri` with
`SCREENPIPE_DEV_USE_PROD_DATA=1`, see `DEMO.md`), n8n running, Connections → n8n
filled, and ticket 24's error workflow installed (the Flow created from the
Task Page).

1. Start ScreenPipe and leave it open for at least 1 minute. The first check
   records its position (`health_checked_at` in
   `~/.screenpipe/automation-flows.json`).
2. In n8n, change the URL of the step « Créer le ticket Jira » to
   `https://invalid.example/rest/api/2/issue` and save (test only). In
   ScreenPipe, open the Flow's Review Screen and click Activer.
3. Quit ScreenPipe completely (tray → Quit).
4. Send one bug email to the support inbox. Wait until n8n → Executions shows
   the Flow's Run in error. The error workflow's call to ScreenPipe fails too:
   nothing is listening.
5. Start ScreenPipe again. Expected about 30 s after start: one notification
   « Échec du Flow « NovaDesk : emails support → tickets Jira » » naming
   « Créer le ticket Jira », the sender and the subject. « Voir le Flow » opens
   its Review Screen. No second notification for that Run, now or at later
   checks.
6. Banner: with the Review Screen open, run
   `docker compose -f infra/automation-flows/docker-compose.yml stop n8n`.
   Expected within 15 s: « n8n injoignable, tes Flows ne tournent pas » above
   the Flow. « Tous les Flows » shows the same words. Then run `... start n8n`:
   the banner goes away within 15 s.
7. Restore the URL in n8n and activate again from the Review Screen.

## Not verified

- The live steps above (no dev build run from this worktree).
- n8n's public API answer for `crashed` Runs in a list without a status filter:
  the check reads `status` from each Run, so it relies on n8n listing them.
