# Review screen in the app (Automations > Recommendations)

Implementation of the review screen validated in
`prototypes/review-screen.html`, inside `apps/screenpipe-app-tauri`. The app
code holds no proposal data: Flows come from a FlowSource.

## What is in the app

- **Automations > Recommendations** tab (`components/pipe-store.tsx`): proposed
  Automation Flows grouped by state (Waiting for you, Running, Paused).
- **Review screen** (`components/automation-flows/flow-review.tsx`):
  - title, provenance and status;
  - VIEW GRAPH: the steps, then OPEN IN N8N;
  - TURN ON / PAUSE;
  - one sentence and the checks;
  - the questions the AI could not settle. TURN ON stays disabled until each
    one is answered; "Other answer…" saves free text;
  - the rules, always visible, in the Flow's blocks.
- **Notification** "New automation: …" through the app's `/notify` server. Its
  Open action is `screenpipe://automation-flow?id=<flow id>`, routed in
  `lib/notifications/actions.ts`: it opens Home on
  `?section=pipes&tab=recommendations&flow=<id>` and emits
  `open-automation-flow`.

## Plugging in data

- **Shape**: `AutomationFlow` in `lib/automation-flows/types.ts`. Required:
  `id`, `title`, `summary`, `questions`, `rules`. Everything else is optional.
  `unit` (e.g. "emails") is the word used in the screen's text.
- **Local file (default source)**:
  `apps/screenpipe-app-tauri/public/automation-flows.local.json` holds a JSON
  array of Flows. The file is git-ignored, so everyone keeps their own demo
  data. Without the file, the tab shows its empty state.
- **Service**: replace the source with
  `setFlowSource({ load: async () => flows })` (`lib/automation-flows/source.ts`).
- **Activation**: `lib/automation-flows/backend.ts`. `demoFlowBackend` only
  switches the state in the app. Plug the n8n client with
  `setFlowBackend({ activate, deactivate })`. Both must resolve only once n8n
  confirms (`POST /api/v1/workflows/{id}/activate` / `/deactivate`). If they
  throw, the UI keeps the previous state and shows the error.
- **n8n link**: `NEXT_PUBLIC_N8N_URL` (default `http://localhost:5678`) and
  `n8n.workflowId` on the Flow. Without an id, OPEN IN N8N opens the workflow
  list.
- **Kept on the device**: review answers and status, in localStorage
  (`screenpipe:automation-flows:v1`).
- **Activity list**: always empty. Real runs should come from n8n executions.

## How to test

- **Dev builds** (`bun run dev:tauri`, `bun run dev:web`): the Recommendations
  tab has a dashed "Test tools" row with two buttons. Send test notification
  needs at least one Flow from the source.
  - **Send test notification**:
    - In the desktop app, it posts to `/notify`. Each send gets its own id,
      because the server drops ids it already stored. If screenpipe still
      skips it (same alert under 90 s, notifications paused), a toast says
      why.
    - In the browser dev loop, it shows the notification in-page instead. Port
      11435 there may be your installed screenpipe app, not the one under
      test.
  - **Reset review** clears the answers and the status.
- **Any build**: post a notification yourself. The port is 11435, or 11535 in
  dev; replace `<flow-id>` and use a new `id` each time.

  ```bash
  curl -X POST http://localhost:11435/notify -H "Content-Type: application/json" -d '{"id":"automation-flow-<flow-id>-1","type":"automationFlow","title":"New automation: <title>","body":"**2 questions** to answer before it runs.","priority":"normal","actions":[{"id":"open_flow","label":"Open","type":"deeplink","url":"screenpipe://automation-flow?id=<flow-id>","primary":true}]}'
  ```

- **Unit tests** (they use a neutral example Flow in
  `lib/automation-flows/__fixtures__/`):

  ```bash
  cd apps/screenpipe-app-tauri && bun x vitest run lib/automation-flows components/automation-flows lib/notifications components/__tests__/pipe-store-recommendations.test.tsx components/__tests__/pipe-store-error-state.test.tsx
  ```
