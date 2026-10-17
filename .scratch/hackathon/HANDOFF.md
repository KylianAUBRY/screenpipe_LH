# Handoff — Automation Flows (hackathon)

Last updated: 2026-10-17 ~16:10, integration tip after tickets 14–23 (pushed).
Read this first, then `AGENTS.md` (Hackathon mode), `CONTEXT.md`, `SPEC.md`,
`automation-flows-spec.md`, the ticket files in `issues/`, `DEMO.md` (runbook)
and `evidence/LIVE-CHECKS.md` (every live check with its observed result).

## Where the work is

- **Branch:** `hackathon/automation-flows` on `origin` (KylianAUBRY/screenpipe_LH).
  All tickets are merged there. Since 2026-10-17 `main` holds exactly this
  branch (user decision, see "Teammate divergence").
- **Process:** `/mattpocock-skills:implement-spec`: one implementer per ticket
  in its own worktree (`tdd` skill), merged `--no-ff` into the integration
  branch, pushed after every merge; then an independent code review (standards,
  spec, correctness/security) whose findings became tickets 21–23.

## Ticket state

| # | Ticket | State |
|---|---|---|
| 01–13 | Golden path, Flow service, Task Page, activation, graph, chat, nodes, proxy | done, **live-verified** on this Mac |
| 14 | Server-enforced user-only activation | done, live-verified |
| 15 | Task Page evidence from this Mac's real captures (9/9) | done, live-verified |
| 16 | Demo reset restores the start state | done, live-verified |
| 17 | NovaPlanning product; skill names CUSTOM.* node types and every parameter | done, live-verified |
| 18 | Flow service hardening (refused key, creation off, fresh screens) | done, live-verified |
| 19 | Task Page: creation mode only where it works, drafts | done, live-verified |
| 20 | Agent browser cannot open the app's own pages | done, live-verified |
| 21 | Switching a Flow off waits for the running execution | done, live-verified |
| 22 | Review fixes, engine (who deactivated, outside activation, credentials, facts, sourceMoment, n8n_failed, no MCP) | done, live-verified |
| 23 | Review fixes, UI/workflow/nodes (DESIGN.md, reviewed version, timeline link, Jira markup, AI trigger) | done, live-verified |
| 12 | Demo assembly + rehearsal | 5 rehearsals; journey 105–110 s; acceptance list checked in `SPEC.md`; see `DEMO.md` |

Also fixed from rehearsals: IMAP catch-up seed (an email arriving around
activation was missed), reset retries while n8n is still unpublishing, the AI
step times out after 30 s and retries (a hung proxy call held an email for 10
minutes).

## Gotchas (each cost time already)

- **Branch base:** agent worktrees are cut from `origin/main`. Since
  2026-10-17 `main` holds this branch's content, so that base is safe; still
  start implementers with
  `git switch -c hackathon/ticket-NN hackathon/automation-flows`.
- **Engine changes need the dev build.** The ScreenPipe running from
  `/Applications` does not contain our routes or the proxy fix. Live checks:
  quit the installed app, then `cd apps/screenpipe-app-tauri && bun run dev:tauri`
  on this branch, signed in (the AI proxy needs the cloud token).
- **Dev builds are isolated by default** (`~/.screenpipe-dev`, API on port
  3130). The n8n credentials point at port 3030 and the AI tool needs the real
  captures, so run the dev build with `SCREENPIPE_DEV_USE_PROD_DATA=1`, from
  macOS Terminal (screen permissions), never next to the installed app.
- **Workflows view needs the PostHog `workflows` flag.** The Task Page lives
  there. On a demo machine whose account lacks the flag, put
  `NEXT_PUBLIC_SCREENPIPE_WORKFLOWS_ROLLOUT=1` in
  `apps/screenpipe-app-tauri/.env.local` (gitignored) and rebuild. It only
  shows the view; background workflow AI still needs its explicit opt-in.
- **Docker Desktop** reports bind mounts as `/host_mnt/Users/…`;
  `install-n8n` strips that prefix (it refused to copy before).
- **n8n 2.42.2:** switch on/off = `publish`/`unpublish` with `versionId`
  (`activate`/`deactivate` are deprecated). CLI runs inside the container need
  `-e N8N_RUNNERS_BROKER_PORT=5690`. Polling triggers only run from the
  editor's "Fetch Test Event", not `n8n execute`.
- **Vitest on Node 26:** prefix with `NODE_OPTIONS=--no-experimental-webstorage`.
- **Custom nodes:** `cd packages/n8n-nodes-screenpipe && bun run install-n8n`
  builds, copies into `infra/automation-flows/custom-nodes/` (gitignored) and
  restarts n8n. Install from a branch that has all three nodes.

## Local environment (this Mac)

- n8n: `docker compose -f infra/automation-flows/docker-compose.yml up -d`,
  http://localhost:5678 (owner account exists; the human knows the login).
  Log into it in Safari (default browser) before a demo.
- Credentials in n8n (ids are referenced by the workflow), all filled and
  live-tested: `spNovaImap000001` Gmail IMAP, `spNovaJira000001` Jira,
  `spProxyOpenAI001` ScreenPipe AI proxy, `spScreenpipeApi1` ScreenPipe API.
- ScreenPipe Connections → n8n holds `http://localhost:5678` and an n8n API
  key.
- The dev build runs from Terminal with `SCREENPIPE_DEV_USE_PROD_DATA=1`
  (see `DEMO.md`); `apps/screenpipe-app-tauri/.env.local` sets
  `NEXT_PUBLIC_SCREENPIPE_WORKFLOWS_ROLLOUT=1`.
- `ZZ Probe - vérification des identifiants` in n8n: untagged, inactive,
  re-runs a credentials check (`n8n execute --id=spProbeVerify001`); safe to
  delete.
- Secrets never go in the repo.

## Known limits (not fixed, judged minor or team decisions)

- The Flows UI and the Task Page creation block are French in JSX, not
  through the app's localization (`useGT`): team decision for the demo.
- The « Flow runs » mode of the ScreenPipe Trigger fires once when several
  runs happen between two polls (it watches the last execution).
- The Flows list is the n8n workflows tagged `screenpipe-flow`: a workflow
  tagged by hand in n8n shows up too.
- The agent's browser can still open the n8n editor (no cookies unless the
  user shares browser sessions); a version published there is flagged on the
  Review Screen (« Activer cette version »).
- Task Page drafts live in the app session (lost on app restart; `reset.ts`
  cannot clear them).
- The Flow service holds its write lock while it waits for a running
  execution (up to ~90 s): other activations/creations queue meanwhile.
- HTML-only emails: numeric entities above U+FFFF (emoji) are garbled in the
  Jira description.
- A chat-created Flow that uses ScreenPipe nodes needs the « ScreenPipe API »
  credential picked in n8n before it runs (the chat cannot add credentials).
- Jira NOVA holds the rehearsal tickets NOVA-31…42.

## Open decisions

- **Failure handling (SPEC.md D16–D20) is ticketed on branch `hackathon/failure-handling`:** ticket 25 (idempotent ticket creation) is merged (`e732dc940`, live check pending human); ticket 24 (Failed Run notification) is merged (`cb2add87e`, live check pending human; its native panel unit test never compiled: no machine-wide sccache here); ticket 27 (Abstention) is merged (`114259cd0`, live check pending human); tickets 26, 29, 28 in progress; 26 (Retry) needs 24+25; 27 (Abstention) and 29 (health check) need 24; 28 (Activity) needs 27. Not built yet.
- **Teammate divergence (settled 2026-10-17):** `main` had another Review
  Screen ("Recommendations" tab, questions on the Review Screen, notification
  opens the Review Screen, demo backend) by a teammate, plus the « Find an
  automation » button and its `repeated-workflow-detector` Pipe. User
  decision: those four commits moved to
  `archive/main-before-automation-flows` (tip `1196dd10a`), and `main` took
  this branch's content unchanged (merge `-s ours`, no force-push, so their
  commits stay in `main`'s history). Pieces worth porting later from the
  archive: Flows grouped by state, the « if → then » rules with « de vous »
  for rules from the user's answers, choice pills for the questions.
- Whether the n8n trigger nodes appear in the 3-minute demo (D12).
