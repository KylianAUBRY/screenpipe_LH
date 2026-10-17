# Automation Flows — hackathon spec

Status: ready for implementation (grilled 2026-10-17). Direction lives in
`AGENTS.md`; vocabulary in `CONTEXT.md`; build order and risks in
`BUILD_SPEC.md`; problem, user stories and test seams in
`automation-flows-spec.md` (the `ready-for-agent` ticket). This file holds the decisions and contracts the implementation
follows. Where it conflicts with `CONVERSATION_NOTES.md`, this file wins.

## User journey

1. A notification (scripted for the demo) announces a Detected Task.
2. Clicking it opens the Task Page (existing detected-workflow page): what was
   detected, Evidence timeline, "View in timeline", Clarification Questions.
3. All Clarification Questions must be answered; this enables "Créer
   l'automatisation".
4. Creating the Flow imports the n8n workflow inactive (scripted for the demo)
   and opens the Review Screen in the Automations tab.
5. The user reviews, optionally opens the n8n workflow in n8n, and activates.
6. Optional: the user asks the chat for a change; the Flow pauses, is updated,
   needs review, and is re-activated by the user.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | The Flow backend is Rust routes in `screenpipe-engine` under `/automation-flows/*` (port 3030). They are the only code that talks to the n8n API. | User choice: most integrated; reuses local auth and SecretStore. Cost: the engine is linked into the Tauri app, so route changes need `bun run dev:tauri`; iterate with `cargo test -p screenpipe-engine`. |
| D2 | Review material storage is hybrid (default; the user did not object): one AI sentence per node in the n8n node `notes` field; summary, source Detected Task id, activation log and reviewed n8n `versionId` in a ScreenPipe-side JSON file. | n8n stays the source of truth for the workflow; n8n has no activation-event API. |
| D3 | The Task Page reuses `WorkflowDetail` (`packages/workflows-ui/src/workflows-app.tsx:658`) and the existing `screenpipe://workflows?workflow=wf-…` deeplink (`src-tauri/src/notifications/workflow.rs:328`). Clarification Questions are mandatory only for Flow creation; the rest of the page is unchanged. | Detection UI already exists; AGENTS.md forbids rebuilding it. |
| D4 | Demo Flow creation is fully scripted: answers are saved but ignored; the pre-built n8n workflow and its pre-written review material are imported as is. | User choice: maximum reliability. |
| D5 | Creation chat (Add) and modification chat use the existing ScreenPipe chat (Pi agent) plus an `automation-flows` skill that calls `/automation-flows/*`. | Live AI with no new chat UI. |
| D6 | Frontend: a "Flows" tab in the Automations section (`components/pipe-store.tsx:380`), all code in `apps/screenpipe-app-tauri/components/automation-flows/`; its only seam is one typed client over `/automation-flows/*`. Plain and basic, built to be replaced. | User request: simple, easily replaceable frontend. |
| D7 | One Flow = one n8n workflow. A chat modification of an active Flow unpublishes it and updates the same n8n workflow in place; the "version" is n8n's `versionId`. Edits made directly in the n8n editor are not auto-paused; the app only flags them. Verified on n8n 2.42.2: switch on = `POST /api/v1/workflows/{id}/publish` with `{versionId}` (publishes exactly the reviewed version); switch off = `POST …/unpublish` (`activate`/`deactivate` still exist but are deprecated). A workflow carries `versionId` (latest draft) and `activeVersionId` (the published one): an edit creates a new draft while the published version keeps running, so `reviewOutdated` = `active && versionId !== activeVersionId`. | User choice: simplest version model. |
| D8 | Task Page Evidence is key frames extracted from the team's screen recording (`.mov`, 2026-10-17 04:05–04:15), embedded in the demo fixture. Implementation note: `packages/workflows-ui/src/screenshots.ts:19` strips `dataUrl` for positive `frameId`s and `:9` drops non-positive ones, so the fixture images must go through `loadWorkflowScreenshot` (or that serialization needs a narrow exception). | User choice. |
| D9 | The demo n8n workflow: IMAP trigger (unread only, marks read — this is the dedupe) → one n8n AI Agent with a structured output `{type: Bug\|Tâche\|none, product, summary, priority, label: back\|front}` → stop if `none` → deterministic title `<product> - <summary>`, description = quoted email, unassigned → Jira create issue in `NOVA`. | AI only for judgment (AGENTS.md "keep AI minimal"). |
| D10 | Two scripted Clarification Questions: « Les idées d'amélioration (comme NOVA-27) doivent-elles aussi devenir des tickets ? » (expected: oui, en Tâche) and « Comment choisis-tu la priorité ? » (expected: bloquant = Highest, contournement possible = Medium, idée = Low). Free-text answers in the existing UI. | User choice: keep the demo short. |
| D11 | The AI Agent has one tool: the custom **ScreenPipe** node (`usableAsTool`), used to find how the user handled similar emails before (the screen captures of the ticket creations) and copy those conventions. Chat model: n8n OpenAI Chat Model with base URL `http://host.docker.internal:3030/v1` and the local ScreenPipe API key. | User choice. The proxy forwards the body verbatim (`routes/cloud_proxy.rs:25`), so `tools` should pass. Consequence: the demo machine must hold those ScreenPipe captures. |
| D12 | Custom n8n nodes live in one package `packages/n8n-nodes-screenpipe` with a shared "ScreenPipe API" credential: **ScreenPipe** (action + tool), **ScreenPipe Trigger** (deterministic) and **ScreenPipe AI Trigger**. Whether the triggers are shown in the demo is not decided. | AGENTS.md requires the two triggers; the demo needs the data node. |
| D13 | The n8n API URL and API key are two new fields (`api_url`, `api_key` secret) on ScreenPipe's existing n8n connection (`crates/screenpipe-connect/src/connections/n8n.rs`); the routes read them from there. | User choice: Connections UI and SecretStore for free. |
| D14 | n8n runs from `infra/automation-flows/docker-compose.yml`, image pinned to `n8nio/n8n:2.42.2`, bound to `127.0.0.1:5678`. Built custom nodes are copied into `infra/automation-flows/custom-nodes/` (gitignored). | Pinned instance: n8n credentials are not portable. |
| D15 | Demo: 3 minutes on stage + 2 minutes Q&A. The modification chat is shown live if it passes rehearsal. | User answer. |

## Demo data (from the team's recording)

Dedicated Gmail inbox (`servicedesk.novadesk@gmail.com`, IMAP app password
entered by a human in n8n only) and Jira Cloud project `NOVA` ("NovaDesk —
Équipe technique"). Three recorded repetitions:

| # | Email (sender, subject) | Ticket created by hand |
|---|---|---|
| 1 | Arthur Noteris, "Export des contacts vide dans NovaCRM" (04:04) | NOVA-25, Bug, "NovaCRM - Export CSV des contacts filtres vide (en-tetes seuls)", Highest, assignee Nils Laeremans, label `back` |
| 2 | Loris Omont, "NovaPay refuse les montants avec centimes" (04:09) | NOVA-26, Bug, "NovaPay - Montant avec virgule refuse dans une note de frais", Medium, assignee Arthur Noteris, label `back` |
| 3 | Nils L., "Idée : filtrer les clients par date de dernière relance" (04:12) | NOVA-27, Tâche, "NovaCRM - Filtre "Derniere relance" enregistrable dans la liste clients", Low, assignee Arthur Noteris, label `front`, Demandeur Nils Laeremans |

Observed conventions: summary is `<Product> - <short summary>`; Bug for a
defect, Tâche for an improvement idea; the description quotes the email; the
inbox also holds a Google security alert that gets no ticket.

Detected Task fixture id: `wf-novadesk-support-tickets`.

## Contract: `/automation-flows/*` (screenpipe-engine)

Auth: the existing local API auth. n8n access: `api_url` + `api_key` from the
n8n connection (D13), header `X-N8N-API-KEY`, n8n public API `/api/v1`. Flows
are the n8n workflows tagged `screenpipe-flow`.

```ts
type FlowStatus = "draft" | "active" | "paused" | "needs_review";

type FlowSummary = {
  id: string;                 // n8n workflow id
  name: string;
  status: FlowStatus;
  lastExecution: { status: "success" | "error" | "running"; startedAt: string } | null;
};

type Flow = FlowSummary & {
  n8nUrl: string;             // `${api_url}/workflow/${id}`, for "View graph"
  sourceTaskId: string | null; // wf-… id, for the link back to the Task Page
  summary: string;            // plain-language explanation
  nodes: { id: string; name: string; type: string; position: [number, number]; sentence: string | null }[];
  edges: { from: string; to: string }[];   // from n8n `connections`, by node id
  versionId: string;
  reviewedVersionId: string | null;
  reviewOutdated: boolean;    // active and versionId !== reviewedVersionId (edited in n8n)
  activationLog: { at: string; event: "activated" | "deactivated" | "paused_for_edit" | "modified"; versionId: string; by: "user" | "chat" }[];
};
```

Status derivation (from n8n `active` + stored `reviewedVersionId`):
`active` if n8n active; else `draft` if never activated; else `needs_review`
if `versionId !== reviewedVersionId`; else `paused`. Sticky-note nodes are
excluded from `nodes`. `sentence` is the node's `notes`.

| Route | Effect |
|---|---|
| `GET /automation-flows` | `FlowSummary[]` |
| `GET /automation-flows/:id` | `Flow` |
| `POST /automation-flows/from-task` `{taskId, answers}` | Demo: maps `taskId` to the bundled fixture (unknown → 404); imports it inactive, tags it, stores summary + `sourceTaskId`. Idempotent per `taskId`. Returns `Flow` (`draft`). |
| `POST /automation-flows` `{workflow, summary}` | Chat creation: imports `workflow` (n8n JSON with per-node `notes`) inactive and tagged. Returns `Flow`. |
| `PUT /automation-flows/:id` `{workflow, summary?}` | Chat modification: if active, deactivate first (log `paused_for_edit`); update in place; log `modified`. Returns `Flow`. |
| `POST /automation-flows/:id/activate` | n8n activate; `reviewedVersionId = versionId`; log `activated`. Only called from a user click. |
| `POST /automation-flows/:id/deactivate` | n8n deactivate; log `deactivated`. |

Errors: `412 {error: "n8n_not_configured"}`, `502 {error: "n8n_unreachable"}`,
`404` for an unknown Flow or task. Storage: one JSON file in the ScreenPipe
data dir, keyed by n8n workflow id.

Fixture: `crates/screenpipe-engine/assets/automation-flows/` holds the n8n
workflow JSON (with node `notes`) and its review JSON (summary). The workflow
JSON is exported from the demo n8n instance after its credentials are bound
once, so it carries that instance's credential ids (ids are not secrets).

## Contract: frontend (`components/automation-flows/`)

- `api.ts`: the typed client above, over `localFetch`; the browser mock
  (`bun run dev:web`) returns fixture Flows.
- `pipe-store.tsx`: third tab "Flows"; `?tab=flows&flow=<id>` opens a Flow.
- List: name, status badge, last run; "Ajouter" opens the ScreenPipe chat with
  a prefilled creation prompt.
- Review Screen: summary; read-only graph (`@xyflow/react`, already a
  dependency) with each node's sentence; "Voir le graphe" (n8n URL);
  "Voir la tâche" (Task Page); status, last run, activation history;
  Activer/Désactiver; "Demander une modification" (opens the chat with the
  Flow id in the prompt); a "needs review" banner when applicable.
- Task Page (packages/workflows-ui): a mode where Clarification Questions are
  required; "Créer l'automatisation" is disabled until all are answered; it
  calls a new optional platform method `createAutomationFlow(taskId, answers)`
  (desktop: `POST /automation-flows/from-task`, then navigate to the Review
  Screen).

## Contract: `automation-flows` skill (Pi)

`crates/screenpipe-core/assets/skills/automation-flows/SKILL.md`: how to
list, read, create and modify Flows through `/automation-flows/*`; every node
gets a one-sentence `notes`; never call `activate`; end by giving the user the
Review Screen link. Rehearsed modification: « Ajoute l'étiquette `auto` à
chaque ticket créé ».

## Contract: n8n nodes (`packages/n8n-nodes-screenpipe`)

- Credential `screenpipeApi`: `baseUrl` (default
  `http://host.docker.internal:3030`), `apiKey`.
- **ScreenPipe** (`usableAsTool: true`): operations `searchContent` (`GET
  /search`: q, content_type, app_name, window_name, start_time, end_time,
  limit) and `activitySummary` (`GET /activity-summary`). Text truncated.
- **ScreenPipe Trigger** (polling, cursor in static data): mode `keyword`
  (term in audio transcription), `window` (app/window becomes active), `pipe`
  (new execution of a pipe). Emits `{mode, matchedAt, text, app, window}`.
- **ScreenPipe AI Trigger** (polling): `conditionPrompt`, `lookbackMinutes`,
  `cooldownMinutes`; each poll sends the recent activity summary to the AI
  proxy and fires when it answers `{met: true, reason}`.

## Demo script (3 min, to rehearse)

| Time | Step |
|---|---|
| 0:00 | Problem: the support agent turns every bug email into a Jira ticket by hand. |
| 0:15 | Notification → Task Page: 3 repetitions with captures, "View in timeline". |
| 0:40 | Answer the 2 questions → "Créer l'automatisation". |
| 1:00 | Review Screen: summary, graph with one sentence per node, quick "Voir le graphe" in n8n. |
| 1:30 | Activer. Send a new bug email from a phone. |
| 1:45 | Chat: « Ajoute l'étiquette `auto`… » → paused → needs review → Activer. |
| 2:30 | The ticket appears in Jira with the right type, title and priority. |

## Acceptance (demo machine)

- The notification opens the Task Page of `wf-novadesk-support-tickets`.
- "Créer l'automatisation" stays disabled until both answers are filled.
- After creation, n8n holds one inactive workflow tagged `screenpipe-flow`; a
  second click does not create a second one.
- The Review Screen shows every non-sticky node with its sentence.
- Activer makes the n8n workflow active; Désactiver reverses it; both appear
  in the activation history.
- A new bug email becomes one NOVA ticket; a non-ticket email creates none.
- A chat modification of an active Flow leaves it `needs_review` and inactive.

## Human setup (agents must not do these)

1. Start Docker Desktop, then `docker compose -f infra/automation-flows/docker-compose.yml up -d`.
2. Create the n8n owner account and an n8n API key.
3. In n8n, create the credentials: IMAP (Gmail app password), Jira Software
   Cloud (email + API token), OpenAI (base URL `http://host.docker.internal:3030/v1`,
   ScreenPipe local API key), ScreenPipe API.
4. In ScreenPipe → Connections → n8n: `api_url` `http://localhost:5678` and the API key.
5. If the demo runs on this Mac: re-record the 3 repetitions with ScreenPipe on (D11).

## Verified on the local n8n 2.42.2

- Activation API: see D7 (`publish`/`unpublish`, `versionId` vs `activeVersionId`).
- Node types available for the demo workflow (latest versions): IMAP Email
  trigger `emailReadImap` 2.2, `jira` 1, `if` 2.3, `set` 3.5, `stickyNote` 1,
  AI Agent `@n8n/n8n-nodes-langchain.agent` 3.1, OpenAI Chat Model
  `lmChatOpenAi` 1.3, Structured Output Parser `outputParserStructured` 1.3.
- Instance-level MCP endpoint: `http://localhost:5678/mcp-server/http`
  (Bearer token); registered in Claude Code for this project (local scope).

- AI proxy from the n8n container (`http://host.docker.internal:3030/v1`, model `auto`): chat completions 200, tool calls returned. `GET /models` is 404, so n8n's OpenAI credential test shows a red error on Save; that is expected. Tool calls come back non-OpenAI-shaped (`type: "tool_use"`, no `id`, no `finish_reason`): the n8n AI Agent may not parse them; if it fails, normalize the response in the engine's cloud proxy before falling back to a plain ScreenPipe step.

## Risks to check first (golden path)

- n8n 2.x semantics: confirm that `POST /workflows/:id/activate|deactivate`
  still exist and how `versionId` relates to the published version. n8n
  2.42.2 distinguishes draft and published workflows at startup ("0 draft
  workflows, 0 published workflows"), so D7 may map to publish/unpublish.
- Tool calling through `localhost:3030/v1/chat/completions`: one curl with
  `tools`.
- Credential binding on API import (fixture exported from the demo instance).
- The demo machine must hold the ScreenPipe captures of the repetitions.
