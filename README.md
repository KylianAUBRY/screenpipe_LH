# Automation Flows: automations you read before they run

Screenpipe pipes let an AI agent carry out a whole task. **Automation Flows**
do the job as a visible, step-by-step [n8n](https://n8n.io) workflow instead:
an AI builds it, you read what every step does, and nothing runs until you
turn it on.

## What it does

- **Describe an automation in the chat.** Screenpipe's chat builds it as an
  n8n workflow, one step at a time, using only nodes your n8n really has.
- **Review it in plain English.** A summary of what the Flow does, and a
  picture of the workflow with one sentence per step.
- **Turn it on yourself.** Nothing runs before you click **Turn on**. Click
  **Pause** to stop it.
- **See what it did.** Activity lists the latest runs. When a run fails,
  Screenpipe notifies you and offers **Retry**.
- **Start it from what happens on your computer.** Three Screenpipe nodes for
  n8n start a workflow when you say a keyword, when an app or window becomes
  active, when a pipe or another Flow runs, or when an AI judges that a
  situation you described is happening. Any step can also search your
  Screenpipe memory.

## How it works

```
Screenpipe desktop app                          n8n (Docker, localhost:5678)
  Chat ─────────── builds the Flow ───────────►  n8n workflow, tagged "screenpipe-flow"
  Automations → Flows ── turn on / pause ─────►  publish / unpublish (n8n API)
  Local API :3030 ◄────── Screenpipe nodes ────  trigger on your activity, search your memory
  AI proxy :3030/v1 ◄──── AI steps ────────────  call the model through Screenpipe
```

- **n8n holds the workflow.** Screenpipe reads each Flow's content and state
  from n8n. It only keeps its own review record: the summary, the version you
  reviewed, and who turned the Flow on or off, and when.
- **Screenpipe is the trigger and the memory.** The Screenpipe nodes run
  inside n8n and call Screenpipe's local API on your computer.
- **AI only where judgment is needed.** Every other step is an ordinary n8n
  node: same input, same result.

## Set it up

You need the Screenpipe desktop app running, [Docker](https://www.docker.com),
and [bun](https://bun.sh).

1. **Start n8n.**
   ```bash
   docker compose -f infra/automation-flows/docker-compose.yml up -d
   ```
   Open http://localhost:5678 and create the n8n owner account. n8n listens
   on this computer only (`127.0.0.1`), with telemetry off. The compose file
   sets the timezone to `Europe/Paris`: change `GENERIC_TIMEZONE` and `TZ` to
   yours.
2. **Install the Screenpipe nodes into n8n.**
   ```bash
   cd packages/n8n-nodes-screenpipe
   bun install
   bun run install-n8n
   ```
   This builds the nodes, copies them into
   `infra/automation-flows/custom-nodes/` and restarts n8n. If your n8n
   container is not named `automation-flows-n8n-1`, set `N8N_CONTAINER`.
3. **Create an n8n API key**: in n8n, **Settings → n8n API**.
4. **Connect Screenpipe to n8n**: in Screenpipe, open **Connections → n8n**,
   enter the API URL `http://localhost:5678` and the key from step 3, then
   click **Test**. The key is stored encrypted on this computer.
5. **Copy your Screenpipe API key**: **Settings → Privacy → Security →
   Require API Authentication**. If API authentication is off, Screenpipe
   ignores the key: leave it empty, or type any value where n8n requires one.
6. **Create the credentials in n8n** (**Credentials → Add credential**),
   **exactly one of each type**. Screenpipe connects them to your Flows
   itself; the chat never asks for passwords or keys.
   - **ScreenPipe API**: Base URL `http://host.docker.internal:3030`, API key
     from step 5. The Screenpipe nodes use it.
   - **OpenAI** (we name it `ScreenPipe AI proxy`): Base URL
     `http://host.docker.internal:3030/v1`, API key from step 5. AI steps use
     it. n8n's connection test fails on this one, because Screenpipe has no
     `/v1/models` route: save it anyway.
   - The apps your Flows will use (Gmail, Jira, Slack…), as usual in n8n.
7. **Connect the AI**: in Screenpipe, **Settings → AI → ChatGPT**. AI steps
   and the AI trigger use `chatgpt/gpt-5.6-luna:max` through your ChatGPT
   subscription. The model name `auto` uses your Screenpipe subscription
   instead.

## Use it

**Create a Flow.** In **Automations → Flows**, click **New Flow** (or the
**Create flow** chip in the home chat), and say what it should do. For
example: *"When I say 'status update', post a summary of my last hour of work
to Slack."* The chat:

- looks up each node in your n8n before using it, and refuses invented,
  switched-off or incomplete nodes;
- builds the workflow in n8n as a hidden draft, one step at a time;
- writes a summary and one plain sentence for every step;
- ends with a **Review the Flow** link.

**Review it.** The Review Screen shows:

- **What this Flow does**: the summary;
- **How it works**: the workflow, one card per step. Click a card to read
  its whole sentence;
- **Open in n8n**: the full workflow in n8n, where you can edit it.

**Turn it on.** Click **Turn on**. Only you can do this, from the desktop
app: the chat can create and change Flows, but never turns them on.

A Flow is **Not on yet** (never turned on), **On**, **Paused**, or
**Dismissed** (set aside).

**Follow it.**

- **Activity**: the latest runs and their outcome. A failed run shows the
  step that failed, with a **Retry** button.
- **History**: who turned the Flow on, paused or changed it, and when.
- **Notifications**: when a run fails, you get « Flow … failed » with
  **View Flow** and **Retry**. For this, Screenpipe installs one helper
  workflow in n8n, « ScreenPipe — Flow failures ».
- If n8n stops answering, the Flows tab says « n8n is unreachable: your
  Flows are not running ».

**Change it.** Ask the chat. If the Flow is on, Screenpipe pauses it first,
applies the change, and leaves it off until you review it and turn it on
again. You can also edit the workflow in n8n.

**Pause, dismiss, delete.** **Pause** stops the Flow, after any run in
progress. **Dismiss** sets aside a Flow you don't want; **Restore** brings it
back. **Delete** removes the n8n workflow for good.

## Screenpipe nodes for n8n

| Node | What it does | Main settings |
|---|---|---|
| **ScreenPipe Trigger** | Starts a workflow, without AI, when a keyword is said (audio transcription), an app or window becomes active, a pipe runs, or another Flow runs. Each event starts it once. | the event, then the keyword, the app and window name, the pipe, or the Flow; how often to check (n8n's Poll Times, e.g. every minute) |
| **ScreenPipe AI Trigger** | Starts a workflow when an AI judges, from your recent activity, that a situation you described is happening. | the condition in plain English; how far back to look (15 min); a cooldown after it fires (60 min); the model |
| **ScreenPipe** | Searches your Screenpipe memory, or summarizes your activity over a time range. An n8n AI Agent can also use it as a tool. | *Search Content*: query, content type (all, accessibility, OCR, audio, input, memory), app, window, time range, limit. *Get Activity Summary*: time range, app, query |

Ideas to ask the chat for:

- *"When I say 'status update', post my last hour of activity to Slack."*
  (ScreenPipe Trigger → ScreenPipe → Slack)
- *"When I open Zoom, send me a summary of what I worked on in the last
  hour."* (ScreenPipe Trigger on a window → ScreenPipe activity summary → a
  message)
- *"When I've been stuck on the same error for a while, send me what I
  already tried."* (ScreenPipe AI Trigger → ScreenPipe search → a message)

## How Screenpipe and its memory are used

| Part | What it reads from Screenpipe | Through the local API |
|---|---|---|
| ScreenPipe Trigger | audio transcriptions (keyword); the focused app and window title (window); pipe runs; another Flow's last run | `/search`, `/pipes/:id/executions`, `/automation-flows/:id` |
| ScreenPipe AI Trigger | a summary of your recent activity: apps, windows and URLs, key text on screen, what was said and by whom | `/activity-summary`, then the AI proxy |
| ScreenPipe node | anything in your memory: screen text (accessibility tree or OCR), audio transcriptions, input events, memories, with the app, window and URL | `/search`, `/activity-summary` |
| Chat that builds Flows | your n8n's node catalog and the Flows API. Like any Screenpipe chat, it can also search your memory | Screenpipe chat skills |
| AI proxy | nothing: it forwards an AI step's request to the model | `/v1/chat/completions` |

Captured text reaches the AI as data, never as instructions: the AI
Trigger clips it and tells the model so.

**Where your data goes**

- **Stays on your computer**:
  - Screenpipe's memory;
  - n8n and everything in it: workflows, runs, credentials (Docker volume
    `n8n_data`);
  - the n8n API key (encrypted in Screenpipe's secret store);
  - the Flow records (`automation-flows.json` in Screenpipe's data folder).
- **Leaves your computer**:
  - what an AI step or the AI Trigger sends to the model: ChatGPT for
    `chatgpt/…`, Screenpipe's cloud for `auto`;
  - whatever your Flow sends to other apps (Slack, Jira…).
- n8n keeps each run's data, including what the Screenpipe nodes returned.

## Design rules

These rules apply to every change to Automation Flows, for contributors and
coding agents alike:

1. **A Flow is an n8n workflow, and n8n is the source of truth.** Read a
   Flow's content and state from n8n; Screenpipe keeps only its review record.
2. **The workflow is edited in n8n.** Screenpipe shows a read-only picture of
   it; do not rebuild n8n's editor in Screenpipe.
3. **Nothing runs without the user.** Only the desktop Review Screen turns a
   Flow on, and it publishes exactly the version on screen. The chat can
   create and change Flows, but never turns them on. Changing a Flow that is
   on pauses it first.
4. **AI only where judgment is needed.** Every other step is a plain n8n
   node.
5. **Only real, complete nodes.** Flows are built from the node catalog of
   this n8n. Invented, switched-off or incomplete nodes are refused, and every
   node carries the one-sentence explanation shown on the Review Screen.
6. **Credentials never come from the chat.** The user creates them in n8n;
   Screenpipe connects the only credential of the type a node needs, or
   refuses the Flow.
7. **Screenpipe's existing workflow detection finds repetitive work.**
   Automation Flows do not re-implement it.

## Engine API

Every route is under `http://localhost:3030/automation-flows`. Send
`Authorization: Bearer <Screenpipe API key>` when API authentication is on,
and `Content-Type: application/json` on every request that is not a `GET`.

| Route | What it does |
|---|---|
| `GET /` | List the Flows, with their last run |
| `POST /` | Create a whole Flow in one call, switched off |
| `POST /drafts`, `PUT /drafts/:id`, `GET /drafts/:id`, `POST /drafts/:id/finish` | Build a Flow step by step as a hidden draft, check it, then finish it |
| `GET /nodes?q=`, `GET /nodes/card` | Search the n8n node catalog; read one node's parameters and credential state |
| `GET /:id`, `GET /:id/workflow` | Read a Flow for review; read its n8n workflow to edit it |
| `PUT /:id` | Change a Flow (pauses it first if it is on) |
| `POST /:id/activate`, `POST /:id/deactivate` | Turn on (desktop app only), pause |
| `GET /:id/activity`, `POST /:id/runs/:run/retry` | Latest runs; retry a failed run (desktop app only) |
| `POST /:id/dismiss`, `POST /:id/restore`, `DELETE /:id` | Set aside, bring back, delete for good |
| `GET /health`, `POST /health` | Last n8n health check; check now |

## Develop

```bash
# Screenpipe nodes for n8n
cd packages/n8n-nodes-screenpipe && bun test
# Flow service (engine)
cargo test -p screenpipe-engine --test automation_flows_test
# Flows screens (app)
cd apps/screenpipe-app-tauri && bun run test:vitest components/automation-flows
```

After changing the n8n version in `docker-compose.yml` or the Screenpipe
nodes, regenerate the node catalog the chat searches
(`bun infra/automation-flows/n8n-catalog.ts`), then rebuild the app: the
catalog is compiled into the engine.

Where the code lives:

- engine: `crates/screenpipe-engine/src/automation_flows.rs` and
  `automation_flows/`;
- app screens: `apps/screenpipe-app-tauri/components/automation-flows/`;
- n8n nodes: `packages/n8n-nodes-screenpipe/`;
- n8n setup: `infra/automation-flows/`;
- chat skill: `crates/screenpipe-core/assets/skills/automation-flows/`.

Vocabulary: `CONTEXT.md`. Design history: `docs/automation-flows/history/`.

## Known limits

- **One credential per type.** If n8n holds none, or several, of the type a
  node needs, Screenpipe refuses the Flow: keep exactly one.
- **Activity labels are tuned for email Flows.** « Done » and « Failed » fit
  every Flow. « Ticket … created », « Sort by hand » and « Ignored » come from
  email-to-ticket Flows, and other AI Flows can show « Sort by hand » by
  mistake.
