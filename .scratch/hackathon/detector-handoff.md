# Repeated Workflow Detector and the automation handoff

Status: done on `main` (bundled Pipe `repeated-workflow-detector`). The n8n
builder that consumes the handoff is not built yet.

## Why a new detector

ScreenPipe's own detection did not find the staged Gmail → Jira work on the demo
machine:

- **Workflows view** (`workflow-discover/deepen/review`): hidden unless the
  `workflows` PostHog flag is on for the account, and it needs a Business/Pro
  plan. The switcher (`components/workflows/product-switcher.tsx`) returns null
  without the flag.
- **Automate My Work** pipe: ran three times and answered "No safe opportunity
  yet". With the `auto` model it stopped after one or two searches, the 7-day
  activity summary timed out (504), and it asked for "2 different days" although
  its own rule is "2 days OR 3 separate occasions". A `model:` line in the Pipe
  is ignored: without `preset:`, the user's default AI preset is used.
- Before any of this, every Pipe failed at startup: the app had installed
  `pi-subagents` 0.77.0, which needs Pi ≥ 0.86.1 while the app bundles Pi
  0.84.1. Fixed locally by installing 0.70.0; upstream already pins and repairs
  it (commit `91f1a17fe`), not yet in app 2.7.109.

So the detector is deterministic code built on the local API, run as a Pipe.

## Detection rule (`detect.ts`)

1. Read input events (window focus, clicks) with
   `GET /search?content_type=input`, in 30-minute chunks, for the requested
   range (default: today since midnight).
2. Turn window titles into visits and classify each page without app-specific
   rules:
   - **record**: title carries a key like `[ABC-123]`;
   - **hub** (inbox, board, home): a page the user leaves for many different
     pages of the same app (at least 3, and at least half as many as that app's
     busiest page), or the only page of a single-window app;
   - **item**: anything else (a message, a document), even when revisited later.
3. A record is **new** when its key appears for the first time right after a
   "Create/Créer/Submit/Save/Add" click in the same app.
4. Each new record is linked to an item of another app opened in the 8 minutes
   before it (and after the previous creation), preferring the item whose title
   is closest to the record, else the latest one.
5. A pattern "item in app A → new record in app B" is kept from **3 separate
   occasions or 2 different days**. Starred sessions are used as preferred
   examples.

On the demo data it finds Gmail → Jira, 7 occurrences (NOVA-24 to NOVA-30; NOVA-24
is a test ticket created before the sessions), in about 5 seconds.

## Outputs (`~/.screenpipe/pipes/repeated-workflow-detector/output/`)

| File | Content |
|---|---|
| `result.md` / `result.json` | Patterns, occurrences, evidence (frame ids), pages considered for each source |
| `handoff.json` | The problem for the automation builder (format below) |
| `handoff.md` | The same, readable, with short excerpts |
| `warnings.log` | Screen text that could not be found, failed requests |

## `handoff.json` (`screenpipe.automation-handoff/v1`)

| Field | Content |
|---|---|
| `problem` | One paragraph: what the user does by hand, how often |
| `trigger` | Source app, event, account (e.g. `servicedesk.novadesk@gmail.com`), URL |
| `target` | Target app, action, key prefix (`NOVA`), site URL, record URL pattern (`…/browse/{KEY}`) |
| `evidence` | Occurrences (and starred), sessions, days, median minutes, returns to source, created keys |
| `observedSteps` | Repeated actions in order (e.g. Créer, Résumé, Description, Étiquettes, priority) |
| `examples[]` | Real pairs: `input` = captured message text, `output` = captured ticket page (type, summary, description, assignee, labels, priority, dates) |
| `openQuestions` | Field rules, incomplete messages, human validation, reply to sender, credentials |
| `acceptanceTest` | How to check the built automation |
| `detector` | Method, sources, range, rule |

No credentials are ever included; screen text has email addresses masked by
ScreenPipe.

## Getting the handoff to the n8n builder

- In the app: `detectedHandoff(flowId)` (`lib/automation-flows/detected.ts`)
  returns the handoff of a detected Flow.
- Outside the app: set a webhook in the Pipe folder's `config.json`
  (`{"webhook": "https://…"}`), or `SCREENPIPE_HANDOFF_WEBHOOK`, or `--webhook`;
  the script POSTs `handoff.json` there. Not tested yet (no endpoint).

## Running it

- From the app: **Find an automation** (see `find-automation.md`), or run the
  Pipe from the Automations list.
- From a shell with a local API key:
  `SCREENPIPE_LOCAL_API_KEY=… bun ./detect.ts --out ./output --handoff`
  Options: `--start`, `--end`, `--min-occurrences`, `--window-minutes`,
  `--webhook`, `--notify` (the script's own notification; the button sends the
  review notification instead), `--debug` (writes `visits.json` with every
  window title of the range: private, delete after use).

## Limits

- Only creations preceded by a create-like click and identified by a key in the
  window title are detected.
- Times come from event timestamps, not measured working time.
- One day of data on the demo machine: recurrence over several days is not
  established.
- Field mapping (type, priority, labels) is left to the builder: the examples
  show the values the user chose by hand.
