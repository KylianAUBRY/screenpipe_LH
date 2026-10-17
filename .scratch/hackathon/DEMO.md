# Demo runbook — Automation Flows (3 minutes)

Everything here was rehearsed on the demo machine on 2026-10-17; timings and
proofs are in `evidence/LIVE-CHECKS.md`.

## Before the slot (once)

1. Docker Desktop running; `docker compose -f infra/automation-flows/docker-compose.yml up -d`
   (n8n at http://localhost:5678, ScreenPipe nodes installed with
   `cd packages/n8n-nodes-screenpipe && bun run install-n8n`).
2. **Log into n8n in Safari** (the default browser): « Voir le graphe »
   opens there, and without a session it shows n8n's sign-in page.
3. Quit the installed Screenpipe app (with « Keep search available after
   quitting » off). From macOS **Terminal**, run the dev build on the real
   profile (screen permissions come from Terminal):
   ```bash
   cd apps/screenpipe-app-tauri && SCREENPIPE_DEV_USE_PROD_DATA=1 ./src-tauri/target/debug-dev/screenpipe-app
   ```
   Build it first with `bun run build:tauri:dev` (with
   `NEXT_PUBLIC_SCREENPIPE_WORKFLOWS_ROLLOUT=1` in
   `apps/screenpipe-app-tauri/.env.local` when the account lacks the
   `workflows` flag). Sign in; Connections → n8n holds `http://localhost:5678`
   and the n8n API key.
4. Keep the Mac awake (`caffeinate -dis &`) and the sound as you want it.

## Between rehearsals (start state)

```bash
export N8N_API_KEY=…            # n8n → Settings → n8n API
bun infra/automation-flows/demo/reset.ts   # no demo Flow, no answers, no unread email
SCREENPIPE_LOCAL_API_KEY=… bun infra/automation-flows/demo/demo.ts --no-notify   # re-install the task (9/9 real captures)
```

Expected last line of reset: « Reset complete: no demo Flow, no saved
answers, no unread demo email. ». The notification server drops the same
alert twice within 90 s: wait 90 s after a previous run before `demo.ts`.

## On stage

| Time | Do | Observed in rehearsals |
|---|---|---|
| 0:00 | Problem (one sentence), then run `bun infra/automation-flows/demo/demo.ts` (or have it fired just before). | — |
| 0:10 | Click « Voir la tâche » on the notification. Task Page: 3 repetitions with the real captures (4:05–4:15), « Voir dans la timeline » on a capture. | Task Page in 4–7 s |
| 0:30 | Type the 2 answers; « Créer l'automatisation » unlocks only at 2/2. Click it. | Review Screen in ~10 s |
| 0:50 | Review Screen: summary, graph with one sentence per step; « Voir le graphe » (n8n in Safari) for 5 s. | |
| 1:10 | Click « Activer ». Send the bug email from the phone. | active in < 1 s |
| 1:20 | While the AI works (10–25 s), show the history line « Activé par vous ». | ticket at +20–30 s after the email |
| 1:45 | Jira: the ticket « Produit - résumé », right type, priority, label, quoted email, unassigned. | NOVA-39 at t+80 s |
| 2:00 | « Demander une modification » → add « Ajoute l'étiquette auto à chaque ticket créé » → send. | Needs Review + switched off in ~15–20 s |
| 2:25 | « Revoir le Flow » → banner « a changé » → « Activer ». | re-activated at t+105 s |
| 2:40 | (If time) a second email → ticket with labels `auto` + `back`. | NOVA-35 |

Total measured without narration: 105–110 s for the whole journey in
rehearsals 1–3 (`evidence/LIVE-CHECKS.md`). **Show the ticket in Jira before
starting the chat change** (row 1:45 before 2:00): a pause while an email is
being processed orphaned the run in rehearsal 3 (fixed by ticket 21; keep the
order anyway, it reads better).

## Fallback if the chat change does not finish (> 30 s)

Say what it does while it finishes, and show the result from rehearsal
instead: the Review Screen of a modified Flow shows « À revoir », the banner,
and the history lines « Mis en pause pour modification par le chat » /
« Modifié par le chat » (screenshots/AX text in `evidence/LIVE-CHECKS.md`,
rehearsal 0). Then click « Activer » on the current Flow and continue; the
Flow keeps working without the change.

## Known limits

- The Workflows view needs the PostHog `workflows` flag or the local build
  override above.
- A chat-created Flow that uses ScreenPipe nodes needs the « ScreenPipe API »
  credential picked in n8n before it can run.
- Do not run the installed app and the dev build together (one DB writer).
