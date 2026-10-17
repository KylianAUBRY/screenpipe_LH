# 02: Create a Flow from the demo task and see it in the Flows tab

Spec: `.scratch/hackathon/automation-flows-spec.md` (contracts in `SPEC.md`).

**What to build:** ScreenPipe can create the Automation Flow of the demo
Detected Task and show it. ScreenPipe's existing n8n connection gains an API
URL field and an API key field (secret). The Flow service exposes list, get
and create-from-task: create-from-task imports the bundled demo workflow into
n8n switched off and tagged, stores the summary and the source task id in the
local Flow record, and is idempotent per task. In the app, Automations gets a
third "Flows" tab, addressable by URL (tab + Flow id): the list shows name,
status (Draft) and last run; the Review Screen shows the summary, each node
with its sentence, a "View graph" link to n8n and a link back to the Task
Page. The Flows UI lives in its own module and talks to the rest of the app
only through one typed client; the browser mock returns fixture Flows. Plain
styling, built to be replaced.

**Blocked by:** None (can start immediately). Use a provisional bundled
fixture until 01 exports the final one.

**Status:** ready-for-agent

- [ ] Flow service tests against a fake n8n: not configured → 412; n8n down → 502; create imports switched off and tagged; a second call returns the same Flow; unknown task → 404; sticky notes are not nodes; node sentences come from node notes; status is Draft.
- [ ] The n8n connection shows the two new fields and stores the key as a secret.
- [ ] The Flows tab and Review Screen render from the typed client (frontend tests).
- [ ] The browser mock shows a fixture Flow without the native app.
- [ ] A clear message appears in the Flows tab when n8n is not configured or unreachable.
