# 24: A Failed Run notifies the user

Spec: `.scratch/hackathon/SPEC.md` D16; glossary `CONTEXT.md` (Run, Failed Run).

**What to build:** When a Run of any Flow stops on an error, the user gets a
ScreenPipe notification that names the Flow, the failing step and, when the
Run handled an email, its sender and subject; clicking it opens the Flow's
Review Screen. The Flow shows in red in the Flows list and on the Review
Screen until a later Run succeeds. Every Flow gets this without extra setup:
ScreenPipe installs one n8n error workflow (tagged, not a Flow itself) and
attaches it to each Flow it creates, imports or updates. No automatic pause.

**Blocked by:** None (can start immediately).

**Status:** done on `hackathon/ticket-24`; live check pending human.

- [x] Flow service tests: create, import and chat update attach the error workflow to the Flow; the error workflow is installed once and never listed as a Flow.
- [ ] A Run made to fail in the local n8n produces one notification that opens the right Review Screen (manual check, steps below). **Pending human.**
- [x] The Flows list and Review Screen show the failed state until the next successful Run (frontend tests).
- [x] The notification never contains the email body or any secret (engine tests: body, error message and token absent; sender and subject escaped, one line, cut).

## How it works

- `infra/automation-flows/workflows/screenpipe-flow-errors.json`: Error Trigger →
  HTTP Request `POST http://host.docker.internal:3030/automation-flows/failed-runs`
  `{executionId, workflowId}` with the `ScreenPipe API (local)` credential
  (`spScreenpipeApi1`). Only ids leave n8n.
- The Flow service installs it once (tag `screenpipe-flow-errors`, switched off:
  an Error Trigger needs no activation) and sets `settings.errorWorkflow` on every
  Flow it creates (chat, from-task import), adopts (the import script's copy, a
  Draft) or updates (chat). A Flow already known to the store and re-linked by
  `from-task` is left untouched (no new n8n version for an active Flow).
  Installing it is best-effort: on failure the Flow is still created, a warning is
  logged, and the next create/update retries.
- `POST /automation-flows/failed-runs` reads the execution in n8n
  (`includeData=true`), checks it failed (`error`/`crashed`) and belongs to a Flow,
  then posts once to `http://localhost:11435/notify`: title « Échec du Flow « name » »,
  the failing step, « E-mail de <from> : « <subject> » » when the start node emitted
  a `subject`, action `deeplink` `screenpipe://flows/<id>`. Dedupe by execution id
  in `automation-flows.json` (`notifiedFailedRuns`, last 500). Answers
  `notified: false` + reason for no Run (trigger failure), not failed, not a Flow,
  already notified; 404 for an unknown execution; 503 `notify_failed` when
  `/notify` does not take it (the error workflow retries 3 times).
- `FlowSummary.failedRun: {executionId, startedAt} | null`: the latest finished Run
  (success/error/crashed among the last 20) when it failed; running or canceled
  Runs neither set nor clear it. UI: red marker + « En échec » in the list and on
  the Review Screen, banner on the Review Screen; the status is unchanged.
- `screenpipe://flows/<id>` from a notification: webview router
  (`lib/notifications/actions.ts`), Home `navigate` forwarding
  (`lib/workflows/flow-links.ts`), macOS native panel
  (`src-tauri/src/commands/native_actions.rs`).

## Manual check (pending human)

Needs the dev build of this branch (`bun run dev:tauri` with
`SCREENPIPE_DEV_USE_PROD_DATA=1`, see `DEMO.md`), n8n running, Connections → n8n
filled.

1. In ScreenPipe, create the Flow from the Task Page (after
   `bun infra/automation-flows/demo/reset.ts` if it already exists). In n8n,
   check that « ScreenPipe : échecs des Flows » (tag `screenpipe-flow-errors`)
   exists exactly once and that the Flow's Settings → Error workflow names it.
2. In n8n, change the URL of the step « Créer le ticket Jira » to
   `https://invalid.example/rest/api/2/issue` and save (test only).
3. In ScreenPipe, open the Flow's Review Screen (it needs review), click Activer,
   then send one bug email to the support inbox.
4. Expected within about a minute: one notification « Échec du Flow « NovaDesk :
   emails support → tickets Jira » » naming « Créer le ticket Jira », the sender
   and the subject, without the email body. Click « Voir le Flow »: the Flow's
   Review Screen opens with the red marker, « En échec » and the banner; the
   Flow is still « Active ».
5. Restore the URL in n8n, activate again from the Review Screen, send another
   bug email: once that Run succeeds the red state disappears from the list and
   the Review Screen.
6. If nothing arrives: n8n runs error workflows only for production Runs, not
   for editor test runs. Open n8n → Executions of « ScreenPipe : échecs des
   Flows »: the HTTP step's answer gives the reason (`notified: false` + reason,
   404, 503). Not verified on this instance: that n8n 2.42.2 runs an Error
   Trigger workflow that was never published.

## Not verified

- Native panel routing (`native_actions.rs`): unit test written, but
  `bun run test:tauri flow_notification_deeplink` is blocked on this machine
  (« machine-wide sccache is required; refusing local compilation »).
