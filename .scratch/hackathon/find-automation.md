# "Find an automation" button (detection → notification → review)

Status: done on `main` (commit `560eec203`). Tested with unit tests, the browser
mock loop, and the fork app on real recorded work (Gmail → Jira, 7 occurrences).

This is the detection side of the reference case: ScreenPipe finds that the user
turns support emails into Jira tickets, proposes an Automation Flow, and hands
the full problem to the AI that will build the n8n workflow (not built yet).

## What the user sees

1. **Automations** tab: a **Find an automation** button next to the notification
   bell (visible on every tab of the page).
2. Click: the button shows "Searching today's work…" for about 10–20 s.
3. The **New automation** notification appears, for example
   "New automation: create a jira ticket for each email in gmail — Learned from
   7 times you did it, Oct 17. **3 questions** to answer before it runs."
4. **Open** shows the existing review screen (Recommendations tab) with the
   detected Flow: summary, checks, 3 questions, rules, steps.

Errors are shown as a toast with the detector's own message. "No automation
found" means nothing repeated often enough today.

## How it works

```
Find an automation (button)
  → POST /pipes/bundled/repeated-workflow-detector/install   (no-op if installed)
  → POST /pipes/repeated-workflow-detector/run → poll /executions/{id}
      Pipe runs detect.ts (deterministic, no AI judgment) over GET /search
      and writes output/handoff.json + handoff.md + result.md
  → read <data dir>/pipes/repeated-workflow-detector/output/handoff.json (Tauri fs)
  → handoffToFlow() → AutomationFlow (id "detected-gmail-jira")
  → saved in localStorage with its handoff, catalog reloaded
  → sendFlowProposalNotification() (the team's "New automation" notification)
```

The detector and the handoff format are described in `detector-handoff.md`.

## Files

| File | Role |
|---|---|
| `apps/screenpipe-app-tauri/components/automation-flows/find-automation-button.tsx` | The button and its states |
| `apps/screenpipe-app-tauri/components/pipe-store.tsx` | Places the button next to the bell |
| `apps/screenpipe-app-tauri/lib/automation-flows/detection.ts` | Runs the Pipe, reads the handoff, `handoffToFlow()` |
| `apps/screenpipe-app-tauri/lib/automation-flows/detected.ts` | Handoff types; detected Flows kept in localStorage; `detectedHandoff(flowId)` |
| `apps/screenpipe-app-tauri/lib/automation-flows/source.ts` | Default FlowSource now lists detected Flows first |
| `apps/screenpipe-app-tauri/lib/automation-flows/detection.test.ts` + `__fixtures__/example-handoff.ts` | Tests on a neutral Mail → Tracker example |
| `apps/screenpipe-app-tauri/lib/dev/browser-*-mock.ts` | Browser dev loop: fake detector run and handoff |
| `crates/screenpipe-core/assets/pipes/repeated-workflow-detector/` | The bundled Pipe: `pipe.md`, `detect.ts`, `README.md` |
| `crates/screenpipe-core/src/pipes/mod.rs` | Registers the Pipe; `BUNDLED_PIPE_FILES` installs extra files beside `pipe.md` |

## Handoff → Flow mapping (`handoffToFlow`)

| Flow field | From the handoff |
|---|---|
| `id` | `detected-<source app>-<target app>` |
| `title` | "Create a {target} ticket for each email in {source}" (ticket when records have keys like `NOVA-12`, else record) |
| `learnedFrom` | number of occurrences and day range |
| `summary` | trigger account (inbox) and target project key |
| `checks` | occurrences/sessions/starred, examples whose text was reused, returns to the source app |
| `questions` | review before creating; incomplete requests (context says when the user asked the sender for details, detected from a quoted reply in the thread); reply with the ticket number |
| `rules` | short "if → then" lines (the review screen sizes the "then" column to its text, so keep them short) |
| `steps` | trigger, read, create ticket, optional reply |
| `n8n.workflowId` | `null` until the builder creates the workflow |

The full handoff stays next to the Flow: `detectedHandoff("detected-gmail-jira")`
returns it for the n8n step.

## How to test

- Unit tests:
  `cd apps/screenpipe-app-tauri && bun x vitest run lib/automation-flows components/automation-flows lib/notifications lib/dev components/__tests__/pipe-store-recommendations.test.tsx components/__tests__/pipe-store-error-state.test.tsx`
  (62 passed), and `cargo test -p screenpipe-core --lib pipes::`.
- Browser mock (`bun run dev:web`, then `/home?section=pipes&tab=recommendations`):
  the detector is mocked; the button opens the review screen of the neutral
  example Flow. Dismiss the mock's "Upgrade your history storage" dialog first.
- Real data: run the fork build instead of the installed app (next section).

## Running the fork on real data (demo machine)

The detector needs the user's recorded history, so the fork must replace the
installed app; they must never run at the same time (one DB writer only).

1. Installed app → Settings → General → turn off **Keep search available after
   quitting**. Otherwise Quit keeps it running in search-only mode as the DB
   owner.
2. Quit the installed app.
3. From macOS Terminal (TCC permissions are attributed to the launching app):
   `cd apps/screenpipe-app-tauri && SCREENPIPE_DEV_USE_PROD_DATA=1 ./src-tauri/target/debug-dev/screenpipe-app`
   and grant Screen Recording and Accessibility. Without them the engine does
   not start.
4. After the demo: Cmd+Q the fork, relaunch the installed app, turn the setting
   back on.

There is no DB migration between app 2.7.109 and this fork, so switching back is
safe. Build with `bun run build:tauri:dev` (not `build:tauri:e2e`, see below).

## Gotchas found on the way

- **Do not launch the E2E build by hand.** `build:tauri:e2e` drops the
  single-instance plugin but also the dev isolation; it expects the E2E harness
  to set `SCREENPIPE_DATA_DIR`/ports. Launched alone it used `~/.screenpipe`,
  and the installed app received a terminate and stopped recording (about
  3.5 min, recovered by reopening it).
- **The normal dev build cannot run next to the installed app**: the macOS
  single-instance plugin hands off to it and exits.
- **A Pipe always runs through an AI agent** (Pi or ACP); there is no
  script-only Pipe. The agent only runs the command, but it needs the user's AI
  access, and it must end with a short final message: relaying a 16 KB file hit
  the output limit and the run was marked "finished without producing a
  verifiable result". `pipe.md` now asks for the summary lines only.
- **The Pipe manager caches `pipe.md`** until the app restarts; `detect.ts` is
  read on every run.
- **Free-plan limit**: only 2 user Pipes load on a free plan. A bundled Pipe
  whose local `pipe.md` is byte-identical to the bundled one does not count.
- The button and Flow texts are English, like the rest of the review screen.

## Relation to the demo contract

`AGENTS.md` (Hackathon mode) says the demo notification and proposal are
scripted and no detection runs for the demo. This button adds a real,
deterministic detection that produces the same notification and review screen.
The team decides which one the demo uses; both end on the same review screen.
