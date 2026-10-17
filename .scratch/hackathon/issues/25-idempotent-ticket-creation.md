# 25: The same email never creates two tickets

Spec: `.scratch/hackathon/SPEC.md` D20.

**What to build:** The demo workflow gives every ticket it creates a label
derived from the email's identity (`mail-` + the first 8 hex characters of a
hash of its Message-ID) and, before creating, searches the Jira project for
that label. If a ticket already carries it, creation is skipped and the Run
ends successfully. Replaying an email (a retried Run, a restored inbox) is
therefore always safe. The review material (node sentences, summary) says so
in plain language.

**Blocked by:** None (can start immediately).

**Status:** done — merged into `hackathon/failure-handling` (review fixes `073ee5704`); live check pending human (steps below).

- [x] Outside-in workflow test: the label is computed deterministically from the Message-ID; the search happens before creation; a found label skips creation; an email without Message-ID falls back to a stable hash of sender + date + subject.
- [x] Prompt-injection guards and every existing workflow test still pass.
- [ ] Live check (pending human): the same email processed twice gives one ticket.

## What was built

- « Préparer le ticket » adds `mailLabel` =
  `'mail-' + <id>.hash('sha256').slice(0, 8)`, where `<id>` is the trimmed
  `metadata['message-id']` of the IMAP item, or, when it is missing or blank,
  `sans-message-id\n<from>\n<date>\n<subject>`. `.hash()` is n8n's own string
  extension (no Code node). Checked with n8n-workflow 2.42.2's expression
  engine inside the container: same labels as Node's SHA-256 for 4 cases.
- New « Chercher un ticket existant » (HTTP Request 4.5, Jira credential):
  `GET https://kylianaubry.atlassian.net/rest/api/2/search/jql` with
  `jql=project = NOVA AND labels = "mail-xxxxxxxx"`, `maxResults=1`
  (`/rest/api/2/search` is removed on Jira Cloud). An HTTP error fails the Run.
- New IF « Aucun ticket pour cet email »: true (no issue found) → « Créer le
  ticket Jira »; false → the Run ends, successfully, without a ticket. An
  answer without an `issues` array fails the IF (« Wrong type: 'réponse de
  recherche Jira inattendue' ») instead of being read as "none found": n8n
  swallows a TypeError in an expression, so `$json.issues.length` alone would
  silently skip.
- « Créer le ticket Jira » reads « Préparer le ticket » by name and sends
  `labels: [ t.label, t.mailLabel ]`.
- Review material: two node sentences updated, two new, summary sentence on
  doublons; app fixture, and the chat skill's « auto » example (it quoted the
  old `jsonBody`), pinned by tests.

## Live check (pending human)

Needs the dev build running and n8n up (see `HANDOFF.md`).

1. Switch the Flow off (Review Screen), then run
   `infra/automation-flows/import-workflow.sh` from this branch.
2. Review and activate the Flow in ScreenPipe.
3. Send one bug email to the support inbox; wait for its NOVA ticket. In Jira,
   check the ticket has two labels: `back`/`front` and `mail-xxxxxxxx`.
4. Wait one minute (Jira's JQL search is eventually consistent), then in n8n
   → Executions, open that Run and click Retry (or mark the email unread in
   Gmail).
5. Expected: the new Run succeeds and stops at « Aucun ticket pour cet email »
   (false branch); « Chercher un ticket existant » shows `issues` with one
   entry; NOVA still holds one ticket for that email.

Known limit: two Runs of the same email within a few seconds can both miss the
label (search index lag) and create two tickets; a Retry is never that fast.
