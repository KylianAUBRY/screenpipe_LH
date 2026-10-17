# Handoff — Automation Flows (hackathon)

Last updated: 2026-10-17, integration tip after the ticket 08 merge (pushed).
Read this first, then `AGENTS.md` (Hackathon mode), `CONTEXT.md`, `SPEC.md`,
`automation-flows-spec.md`, and the ticket files in `issues/`.

## Where the work is

- **Branch:** `hackathon/automation-flows` on `origin` (KylianAUBRY/screenpipe_LH).
  All finished tickets are merged there. It is deliberately **not merged into
  `main`** (user decision, see "Teammate divergence").
- **Process:** `/mattpocock-skills:implement-spec` over
  `.scratch/hackathon/automation-flows-spec.md`. One implementer per ticket in
  its own worktree, built with the `tdd` skill, then a merger merges it with
  `--no-ff` into the integration branch, then push (the user asked to push
  after every merge).
- **Integration worktree (local):** `.claude/worktrees/integration`
  (gitignored). Merges happen there, never in the main checkout.

## Ticket state (true state; some ticket `Status:` lines are stale)

| # | Ticket | State |
|---|---|---|
| 01 | Golden path n8n workflow | merged; live email→Jira test pending human |
| 02 | Flow service routes + Flows tab | merged |
| 03 | Demo Detected Task + evidence + notification | merged |
| 04 | Activate / deactivate | merged; live check pending human |
| 05 | Read-only graph | merged |
| 06 | Questions unlock "Créer l'automatisation" | merged |
| 07 | ScreenPipe node as AI Agent tool | merged; live tool check pending human |
| 08 | Chat modification (pause → Needs Review) | merged (`9d9d4c952`); live rehearsal pending human (steps in the ticket) |
| 09 | Chat creation (Add) | merged (`572075ef1`); live chat creation pending human (steps in the ticket) |
| 10 | ScreenPipe Trigger (deterministic) | merged; manual check pending human |
| 11 | ScreenPipe AI Trigger | merged; manual check pending human |
| 12 | Demo assembly + rehearsal | todo, unblocked (needs the human live checks) |
| 13 | AI proxy returns OpenAI-shaped tool calls | merged; live check pending human |
| — | Prompt-injection hardening of the demo workflow | merged |
| 14 | Server-enforced user-only activation (security review finding) | todo, ready-for-agent |

Remaining implement-spec steps: 14 (security), 12 (needs the human live checks), then `/code-review` on
the integration branch, fix findings in one implementer, set every ticket's
`Status:` to done, clean up implementer worktrees.

## Gotchas (each cost time already)

- **Branch base:** agent worktrees are cut from `origin/main`, which has a
  teammate commit `658549edb` that conflicts with this branch (same files
  under `components/automation-flows/`). Every implementer must start with
  `git switch -c hackathon/ticket-NN hackathon/automation-flows`, and every
  merger checks `git merge-base --is-ancestor 658549edb <branch>` fails.
- **Engine changes need the dev build.** The ScreenPipe running from
  `/Applications` does not contain our routes or the proxy fix. Live checks:
  quit the installed app, then `cd apps/screenpipe-app-tauri && bun run dev:tauri`
  on this branch, signed in (the AI proxy needs the cloud token).
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
- Credentials in n8n (ids are referenced by the workflow): `spNovaImap000001`
  Gmail IMAP (filled, tested), `spNovaJira000001` Jira (filled, tested),
  `spProxyOpenAI001` ScreenPipe AI proxy (filled, works; its red `/models`
  test error is expected), `spScreenpipeApi1` ScreenPipe API (**key still
  empty** — the human pastes the ScreenPipe API key from Settings → Privacy).
- n8n currently holds the **ticket-01 version** of `spNovaFlow000001` (no
  ScreenPipe tool), inactive, so the golden-path test can run on the installed
  app. Re-import the current version with `infra/automation-flows/import-workflow.sh`
  once the dev build (proxy fix) is running.
- Probe workflows `spProbeAgent0001`, `spProbeTool00001`, `spProbeProxy0001`:
  untagged, inactive, safe to delete in the n8n UI.
- n8n MCP registered in Claude Code (local scope) at
  `http://localhost:5678/mcp-server/http`.
- Secrets never go in the repo, and agents never type Gmail/Jira secrets.

## Pending human checks (in order)

1. Golden path (ticket 01): mark old inbox mails read → Publish
   `spNovaFlow000001` in n8n → send a bug email to
   `servicedesk.novadesk@gmail.com` → one Bug ticket in NOVA → Unpublish.
2. Paste the ScreenPipe API key into `spScreenpipeApi1`.
3. Switch to the dev build, re-import the workflow, run the live steps written
   in tickets 04, 07, 13 (and 10, 11 for the triggers).
4. Re-record the 3 repetitions with ScreenPipe on this Mac (the AI tool looks
   them up; this Mac has no captures of NOVA tickets yet).

## Open decisions

- **Failure handling decided, not yet ticketed:** SPEC.md D16–D20 (failure notification, Retry of a Failed Run, AI Abstention + Activity list, health check at app start and every 15 min, idempotent Retry via a `mail-<hash>` Jira label). Turn them into tickets with `/to-tickets` before building.
- **Teammate divergence:** `origin/main` has another Review Screen
  ("Recommendations" tab, questions on the Review Screen, notification opens
  the Review Screen, demo backend) by a teammate. Our branch follows the
  user's decision: notification → Task Page → questions → creation → Review
  Screen. User decision: keep a separate branch for now; do not touch `main`
  or the teammate's files. Reconciling is a team discussion (their screen has
  pluggable `setFlowSource`/`setFlowBackend`, which our routes could feed).
- Whether the n8n trigger nodes appear in the 3-minute demo (D12).
