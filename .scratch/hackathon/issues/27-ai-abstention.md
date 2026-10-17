# 27: The AI abstains instead of guessing

Spec: `.scratch/hackathon/SPEC.md` D18; glossary `CONTEXT.md` (Abstention).

**What to build:** The demo workflow's AI step also returns its confidence
(high or low). A low-confidence answer creates no ticket: the user gets a
ScreenPipe notification « À trier à la main » with the email's sender,
subject and the AI's reason, and the Run ends successfully with the outcome
« abstained ». High-confidence answers behave as today. The deterministic
guard treats a missing or unexpected confidence as low.

**Blocked by:** 24 (reuses the n8n → ScreenPipe notification path).

**Status:** done in code (branch `hackathon/ticket-27`); live check pending human.

- [x] Outside-in workflow test: low confidence never reaches Jira and produces the notification payload; a missing or unknown confidence counts as low; high confidence is unchanged.
- [x] The review material explains the abstention in one sentence on the new node(s).
- [ ] Live check (pending human): an ambiguous email gives the notification and no ticket.

## What was built

- AI step: the structured output gains `confidence` (`high`|`low`) and
  `reason` (1–160 chars), both required; the system message says when to
  answer « low » (ambiguous email, unsure type or product, missing
  information) and asks for a reason that does not copy the email.
- New IF « IA sûre d'elle » right after the AI step:
  `($json.output || {}).confidence === 'high'` with n8n's strict boolean
  « is true ». Anything else (`low`, missing, `High`, `true`, a number, an
  array, no output at all) goes to the false output. The existing « Ticket
  nécessaire » allowlists still guard the true output.
- New HTTP Request « À trier à la main » (false output, last step):
  `POST http://host.docker.internal:3030/automation-flows/abstentions` with the
  `ScreenPipe API (local)` credential (`spScreenpipeApi1`), body
  `{workflowId: $workflow.id, executionId: $execution.id, from, subject, reason}`,
  each text field cut at 300 chars in n8n. Never the email body. Retries 3
  times (5 s apart); if ScreenPipe stays down, the Run fails and ticket 24's
  Failed Run path takes over.
- Flow service `POST /automation-flows/abstentions` (engine): checks the
  workflow is a Flow (tag or local record), builds the notification
  « À trier à la main » (Flow name, sender, subject, the AI's reason; each
  field one line, cut at 120/160/240 chars, markdown escaped), deeplink
  `screenpipe://flows/<id>`, dedupes per email of a Run
  (`notifiedAbstentions`, last 500), answers
  `{notified, outcome: "abstained"}`. That answer is the step's output, so
  the Run's last step names its outcome (for ticket 28).
- Review material: two new node sentences, the AI and parser sentences
  updated, one summary sentence; app fixture updated (drift test).

## Live check (pending human)

Needs the dev build of this branch running (`bun run dev:tauri` with
`SCREENPIPE_DEV_USE_PROD_DATA=1`, see `DEMO.md`) and n8n up.

1. Switch the Flow off from the Review Screen, then run
   `infra/automation-flows/import-workflow.sh` from this branch.
2. In ScreenPipe, review and activate the Flow.
3. From another address, send the support inbox an ambiguous email, e.g.
   subject « Question rapide », body « Bonjour, est-ce normal que ça fasse
   ça depuis hier ? Merci ».
4. Expected within about a minute: one notification « À trier à la main »
   naming the Flow, the sender, the subject and the AI's reason, without the
   body; « Voir le Flow » opens the Review Screen. No new NOVA ticket in Jira.
5. In n8n → Executions, the Run is a success and ends on « À trier à la
   main », whose output reads `outcome: "abstained"`.
6. Send one clear bug email: a ticket is created as before, no notification.

If the AI answers « low » for clear bug emails too, the prompt needs tuning:
note the reason it gave (step 5) before changing anything.
