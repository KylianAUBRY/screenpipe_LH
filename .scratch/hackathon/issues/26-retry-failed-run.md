# 26: Retry a Failed Run

Spec: `.scratch/hackathon/SPEC.md` D17.

**What to build:** A Failed Run is never lost. The Review Screen shows a
« Relancer » action on the latest Failed Run, and the D16 notification offers
the same action. Retrying replays the Run with the same input (the email the
trigger already marked read) through n8n's retry, then the screen shows the
new outcome. Retrying an already successful or still running Run is refused
with a clear message.

**Blocked by:** 24 (the notification it adds an action to), 25 (makes a retry safe from duplicate tickets).

**Status:** done on `hackathon/ticket-26`; live check pending human.

- [x] Flow service tests against the fake n8n: retry of a failed Run calls n8n's retry and returns the new Run; a successful or running Run is refused; an unknown Run gives 404.
- [x] « Relancer » appears only on a Failed Run and refreshes the Review Screen (frontend tests).
- [ ] Live check (pending human): make a Run fail (e.g. Jira credential emptied), restore the credential, click « Relancer », get exactly one ticket.

## How it works

- `POST /automation-flows/:id/retry` `{executionId}` (engine): reads the Run in
  n8n; only a Run of this Flow (`404 run_not_found` otherwise) that stopped on
  an error and was never retried with success (`409 run_not_failed` + detail
  otherwise). Then n8n `POST /executions/{id}/retry`, waiting up to 120 s for
  the outcome, and answers `{run, flow}`. `loadWorkflow: true` only when the
  saved workflow is the reviewed version (a reviewed fix is used); otherwise
  the Run's own version is replayed, never an unreviewed one. Nothing is
  switched on or off.
- D16 notification: second action « Relancer », `type: "api"`, `POST` that
  route with `{executionId}`, `deeplink_url: screenpipe://flows/<id>` (the
  Review Screen opens once the retry answered OK). « Voir le Flow » stays
  primary.
- Review Screen (`components/automation-flows/flow-failed-run.tsx`): the
  Failed Run banner gets « Relancer » (disabled while n8n works, « Relance en
  cours… »), then « Relancé : le passage a réussi / a de nouveau échoué » and
  the Flow as the engine returns it. A refusal shows « Relance impossible »
  and re-reads the Flow.
- Browser mock: `?flowsState=failed` shows a Failed Run that « Relancer »
  replays once.
- Native macOS panel: an `api` action is forwarded to the overlay webview's
  `NotificationHandler`, which now opens `deeplink_url` after any successful
  api action (it did so only for `record-hd`). No Rust change.

## Live check (pending human)

Needs the dev build of this branch (`bun run dev:tauri` with
`SCREENPIPE_DEV_USE_PROD_DATA=1`, see `DEMO.md`), n8n running, the demo Flow
active with the error workflow attached (ticket 24 steps 1 and 3).

1. In n8n → Credentials → `spNovaJira000001`, save a wrong API token (keep the
   real one aside). Do not touch the workflow.
2. Send one bug email to the support inbox. Expected within about a minute:
   the « Échec du Flow » notification with « Voir le Flow » and « Relancer »;
   the Review Screen shows the red banner with « Relancer ».
3. Restore the real Jira token in n8n.
4. Click « Relancer » on the Review Screen. Expected: « Relance en cours… »,
   then « Relancé : le passage a réussi. », the red state disappears, and Jira
   has exactly one new ticket for that email.
5. The same Run cannot be replayed again: the banner is gone, and
   `curl -s -X POST -H 'content-type: application/json' -H "Authorization: Bearer <local API key>" localhost:3030/automation-flows/<flow id>/retry -d '{"executionId":"<failed execution id>"}'`
   answers `409 run_not_failed`.
6. Repeat 1–3, then use « Relancer » from the notification (native panel; if
   it was missed, the bell). Expected: the Review Screen opens on the new
   outcome, one ticket. If the native panel click does nothing, note it: the
   native `api` action relies on the overlay webview's listener.

## Not verified

- That n8n 2.42.2's retry answers once the new Run finished (its public API
  returns the new execution with its status; a `running` answer shows
  « est encore en cours » and the screen's 15 s refresh catches the outcome).
- The native macOS panel path (overlay webview listener alive when clicked).
