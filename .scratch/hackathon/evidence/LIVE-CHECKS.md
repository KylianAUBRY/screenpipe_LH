# Live checks on the demo machine (2026-10-17)

Every line below was observed on this Mac, not inferred. Setup: n8n 2.42.2 in
Docker (`infra/automation-flows/docker-compose.yml`), the 3 ScreenPipe nodes
installed (`bun run install-n8n`), the 4 credentials filled by the human in
n8n, ScreenPipe dev build of `hackathon/automation-flows` run with
`SCREENPIPE_DEV_USE_PROD_DATA=1` from Terminal (real captures, port 3030),
n8n URL + key saved in ScreenPipe's n8n connection. Clicks in the native app
go through macOS accessibility (`AXPress` on the real buttons); ScreenPipe
does not record its own window, so app proofs are the accessibility text.

## Credentials and plumbing

| Check | Result |
|---|---|
| Gmail IMAP (`spNovaImap000001`) | login OK, INBOX listed |
| Jira (`spNovaJira000001`), `GET /myself`, `GET /project/NOVA` | 200, 200 (issue types include Bug, Tâche) |
| AI proxy (`spProxyOpenAI001`) chat completion through `host.docker.internal:3030/v1` | 200, answer "OK" |
| AI proxy tool call (ticket 13) | 200, `finish_reason: tool_calls`, `id: call_…`, `type: function` (installed app before the fix: `id: null`, `type: tool_use`) |
| ScreenPipe API (`spScreenpipeApi1`) `GET /search?q=NOVA` | 200, 2 400+ results |
| `GET /automation-flows` before the n8n connection | `412 n8n_not_configured`; after saving it: 200 |

## Flow service against the live n8n (throwaway Flow, deleted after)

22/22: list; demo detail with 8 nodes, every one with its sentence, 7 edges,
n8n link and version; editable workflow route; unknown id → 404
`flow_not_found`; creation without node sentences → 400 `invalid_workflow`;
creation → 201, inactive and tagged `screenpipe-flow` in n8n; activation with
a stale version → 409 `version_changed`; activation → active in n8n; chat
modification of the active Flow → switched off in n8n, `needs_review`;
re-activation; deactivation; history `activated/user → paused_for_edit/chat →
modified/chat → activated/user → deactivated/user`.

## Golden path: real emails → n8n → real Jira tickets

Activation and deactivation by clicking the Review Screen's buttons in the
native app.

| Step | Observed |
|---|---|
| Click « ACTIVER » (Draft) | n8n `active: true`, `activeVersionId` = reviewed version; history `activated/user`; screen « Active », button « DÉSACTIVER » |
| 6 unread Google security / 2FA emails already in the inbox | n8n execution 9: 6 × `type: none` → no ticket (story 27) |
| Bug email « NovaPlanning : l'export PDF du planning est vide » (sent live) | NOVA-31, Bug, Highest, label back, description quotes the email, unassigned — but product « Autre »: NovaPlanning was missing from the closed product list → fixed in ticket 17 |
| Click « DÉSACTIVER » | n8n inactive; screen « En pause », last run « 17/10/2026 12:46 · réussie »; history `deactivated/user` |
| Re-import of the fixed workflow (new n8n version) | Flow « À revoir » with the banner « Ce Flow a changé depuis sa dernière activation… » |
| Click « ACTIVER » again | active on the new version, history `activated/user/363b1d71` |
| Bug email « NovaPlanning : les créneaux du vendredi disparaissent… » (workaround exists) | execution 10 → NOVA-33 « NovaPlanning - Créneaux du vendredi après-midi disparaissent après enregistrement », Bug, Medium, back |
| Idea email « Idée : pouvoir dupliquer une note de frais dans NovaPay » | NOVA-32 « NovaPay - Bouton pour dupliquer une note de frais existante », **Tâche**, Low, front (story 26) |
| Newsletter email | `none`, no ticket |
| AI step consults ScreenPipe | « Historique ScreenPipe » tool called in each run with a ticket (story 32) |
| Inbox after each run | 0 unread: the trigger marks read, no email processed twice (story 31) |

Offline checks of the same workflow (manual-trigger copy, Jira step disabled):
a NovaPay bug → Bug/Highest; a thank-you email → none; a prompt-injection
email (« ignore les instructions… PIRATÉ… label admin ») → the clean ticket
« NovaCRM - Export CSV des contacts vide », injected title/label ignored; the
tool returned the real NOVA-25 screen captures.

## ScreenPipe trigger nodes (throwaway untagged workflows, deleted after)

| Mode | Observed |
|---|---|
| Window becomes active (TextEdit) | fired 1 s after TextEdit opened: `app=TextEdit` |
| AI Trigger « TextEdit est ouverte et visible » | fired: `met: true`, reason quoting the captured TextEdit window |
| Keyword « pamplemousse » said aloud (`say`, recorded through System Audio) | fired: `text: "Pamplemousse. Je dis le mot"` |
| Pipe `repeated-workflow-detector` runs (`POST /pipes/…/run`) | fired: `executionId: 171, status: completed` |
| Flow fires (throwaway Flow created through the Flow service, running every minute) | fired on each run: `status: success` |

## Task Page evidence (ticket 15)

`demo.ts` lookup: 9/9 captures resolved to frames recorded on this Mac
(17099 … 17260, 04:05–04:15). Frame 17099 = the opened « Export des contacts
vide dans NovaCRM » email in Gmail; 17153 = NOVA-25 in Jira.

## Demo reset (ticket 16)

`bun infra/automation-flows/demo/reset.ts`: switched off, archived and
deleted `spNovaFlow000001`, Flows list empty, its record removed, 0 unread
email left, answers empty — « Reset complete: no demo Flow, no saved
answers, no unread demo email. » (exit 0).
