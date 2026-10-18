# Demo runbook — Automation Flows (3 minutes)

Everything here was rehearsed on the demo machine on 2026-10-17; timings and
proofs are in `evidence/LIVE-CHECKS.md`.

## Before the slot (once)

1. Docker Desktop running; `docker compose -f infra/automation-flows/docker-compose.yml up -d`
   (n8n at http://localhost:5678, ScreenPipe nodes installed with
   `cd packages/n8n-nodes-screenpipe && bun run install-n8n`).
2. **Log into n8n in Safari** (the default browser): « Open in n8n »
   opens there, and without a session it shows n8n's sign-in page.
3. Quit the installed Screenpipe app (with « Keep search available after
   quitting » off). From macOS **Terminal**, run the dev build on the real
   profile (screen permissions come from Terminal):
   ```bash
   cd ~/dev/screenpipe_LH/apps/screenpipe-app-tauri && SCREENPIPE_DEV_USE_PROD_DATA=1 ./src-tauri/target/debug-dev/screenpipe-app
   ```
   Build it first with `bun run build:tauri:dev` (with
   `NEXT_PUBLIC_SCREENPIPE_WORKFLOWS_ROLLOUT=1` in
   `apps/screenpipe-app-tauri/.env.local` when the account lacks the
   `workflows` flag). Sign in; Connections → n8n holds `http://localhost:5678`
   and the n8n API key.
4. Keep the Mac awake (`caffeinate -dis &`) and the sound as you want it.

## Between rehearsals (start state)

From the repo root, Bun loads `N8N_API_KEY` (n8n → Settings → n8n API) and
`SCREENPIPE_LOCAL_API_KEY` (ScreenPipe → Settings → Privacy) from the
gitignored root `.env`:

```bash
bun infra/automation-flows/demo/reset.ts   # no demo Flow, no answers, no unread email
bun infra/automation-flows/demo/demo.ts --no-notify   # re-install the task (9/9 real captures)
```

Expected last line of reset: « Reset complete: no demo Flow, no saved
answers, no unread demo email. ». The notification server drops the same
alert twice within 90 s: wait 90 s after a previous run before `demo.ts`.

## On stage

| Time | Do | Observed in rehearsals |
|---|---|---|
| 0:00 | Problem (one sentence), then press **⌃⌥⌘D** (hidden global shortcut, works with ScreenPipe in the background), or run `bun infra/automation-flows/demo/demo.ts`. Both reinstall the task (answers cleared) and fire the same notification; when it is not shown (repeat within 90 s, pause, quiet hours) a toast says why and the Task Page opens. | not rehearsed live yet (round two 16) |
| 0:10 | Click « View task » on the notification. Task Page: 3 repetitions with the real captures (4:05–4:15), « View in timeline » on a capture. | Task Page in 4–7 s |
| 0:30 | Type the 2 answers; « Create automation » unlocks only at 2/2. Click it. | Review Screen in ~10 s |
| 0:50 | Review Screen: summary, « Learned from » captures, graph with one sentence per step; « Open in n8n » (n8n in Safari) for 5 s. | |
| 1:10 | Click « Turn on ». Send the bug email from the phone. | active in < 1 s |
| 1:20 | While the AI works (10–25 s), show the history line « Turned on by you ». | ticket at +20–30 s after the email |
| 1:45 | Jira: the ticket « Produit - résumé », right type, priority, label, quoted email, unassigned. | NOVA-39 at t+80 s |
| 2:00 | « Change it » → add « Add the auto label to every ticket it creates » → send. | Needs Review + switched off in ~15–20 s |
| 2:25 | « Review the Flow » → banner « changed since it was last on » → « Turn on ». | re-activated at t+105 s |
| 2:40 | (If time) a second email → ticket with labels `auto` + `back`. | NOVA-35 |

Total measured without narration: 105–110 s for the whole journey in
rehearsals 1–3 (`evidence/LIVE-CHECKS.md`). **Show the ticket in Jira before
starting the chat change** (row 1:45 before 2:00): a pause while an email is
being processed orphaned the run in rehearsal 3 (fixed by ticket 21; keep the
order anyway, it reads better).

## Fallback if the chat change does not finish (> 30 s)

Say what it does while it finishes, and show the result from rehearsal
instead: the Review Screen of a modified Flow shows « Needs review », the banner,
and the history lines « Paused for a change by the chat » /
« Changed by the chat » (screenshots/AX text in `evidence/LIVE-CHECKS.md`,
rehearsal 0). Then click « Turn on » on the current Flow and continue; the
Flow keeps working without the change.

## If something goes wrong

- **No ticket 60 s after the email:** the AI call is retried after 30 s; if
  n8n still shows the run as running, keep talking over the Review Screen and
  show the Jira ticket of a previous rehearsal (NOVA-42).
- **A rehearsal stopped mid-typing left text in the answers:** the draft lives
  in the app's session; clear the fields by hand or relaunch the app.

## Known limits

- The Workflows view needs the PostHog `workflows` flag or the local build
  override above.
- A failed run notifies « Échec du Flow … » with « Relancer »; an unsure AI
  sends « À trier à la main »; with n8n down the Flows tab shows « n8n
  injoignable ». None of these is rehearsed live yet (round two 16).
- Do not run the installed app and the dev build together (one DB writer).
