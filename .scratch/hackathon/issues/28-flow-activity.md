# 28: The Review Screen shows the Flow's Activity

Spec: `.scratch/hackathon/SPEC.md` D18; glossary `CONTEXT.md` (Activity).

**What to build:** The Review Screen gains an Activity section: the recent
Runs of the Flow, newest first, and for each handled email its sender and
subject, the outcome (ticket created with its key, ignored, abstained,
failed) and the reason. The user can spot a wrong « ignored » at a glance.
The data comes from n8n's executions through the Flow service; the demo
workflow's last step exposes a stable outcome record for each item.

**Blocked by:** 27 (the « abstained » outcome must exist).

**Status:** done in code (branch `hackathon/ticket-28`); live check pending human.

- [x] Flow service tests against the fake n8n: the Activity route maps executions to outcomes and reasons, newest first, limited in size; a Run without an outcome record shows as failed or unknown, never as success.
- [x] Frontend tests: each outcome renders with its reason; an empty Activity says so.
- [ ] Live check (pending human): one bug, one idea, one ambiguous and one security-alert email give the four expected lines.

## What was built

- No workflow change. Instead of adding an outcome node to every branch, the
  Flow service reads each item's outcome from the last step it reached in
  n8n's `runData` (following n8n's `pairedItem` and each step's `source` back
  to the trigger's email). A step's own `outcome` field wins (« À trier à la
  main » answers `outcome: "abstained"`; any Flow can name its outcomes this
  way); a Jira issue `key` → `ticket_created`; a Jira search hit
  (`issues[0].key`, « Aucun ticket pour cet email » false) → `already_exists`
  with that key; an item left on a condition's false output (« Ticket
  nécessaire » false) → `ignored`. Anything else is `unknown`, or `failed`
  with the failing step in a failed Run: never a success.
- Engine: `GET /automation-flows/:id/activity` (`automation_flows.rs`,
  section « Activity »): last 10 Runs (`includeData=true&limit=10`), newest
  first, at most 50 lines; `reason` = the AI's `output.reason` found on the
  way back (one line, ≤ 240 chars); sender ≤ 120, subject ≤ 160. Never the
  email body (the ticket description holds it: not read) nor the error
  message. A Run with no recorded item (data too large) gives one line,
  `unknown` or `failed`.
- App: `flowsApi.activity(id)`, `ActivityItem` type; `flow-activity.tsx`
  (Activity section under the graph, before the activation history: one
  block per Run « Passage du … », one line per email: subject · sender,
  outcome in words — « Ticket NOVA-51 créé », « Déjà un ticket : NOVA-12 »,
  « Ignoré », « À trier à la main », « Échec à l'étape « … » », « Résultat
  inconnu » — and « Raison de l'IA : … »; refreshes with the Review Screen's
  background reads); browser mock serves `activity-fixture.ts`.
- Not verified against a real n8n: the exact `runData` shape (`source`,
  `pairedItem`) of n8n 2.42.2 for the AI agent and IF nodes. The fake mirrors
  n8n's documented format; the live check below confirms it.

## Live check (pending human)

Needs the dev build of this branch running (`bun run dev:tauri` with
`SCREENPIPE_DEV_USE_PROD_DATA=1`, see `DEMO.md`), n8n up, the Flow imported
from a branch that has tickets 25 and 27, and activated.

1. From another address, send the support inbox, within one minute, three
   emails: a clear bug (« L'export des contacts de NovaCRM est vide »), an
   idea (« Idée : export PDF des paiements NovaPay »), an ambiguous one
   (subject « Question rapide », body « Bonjour, est-ce normal que ça fasse
   ça depuis hier ? Merci »). Also mark one Google security alert in that
   inbox as unread.
2. Wait for the Run(s) to finish (n8n → Executions shows success).
3. In ScreenPipe, open the Flow's Review Screen and scroll to « Activité ».
4. Expected, newest Run first: the bug « Ticket NOVA-xx créé » (the key of
   the new Jira ticket); the idea « Ticket NOVA-yy créé » (or « Déjà un
   ticket : NOVA-yy » if it was ticketed before); the security alert
   « Ignoré » with the AI's reason; the ambiguous email « À trier à la main »
   with the AI's reason. Each line shows sender and subject, never the body.
5. Optional: make one Run fail (ticket 24, step 2) and send a bug email: its
   line reads « Échec à l'étape « Créer le ticket Jira » ».

If a line reads « Résultat inconnu »: open that Run in n8n and note the last
step the email reached and its output; that shape is not recognized yet.
