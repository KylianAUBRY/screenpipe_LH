# 18: Flow service hardening — clear n8n errors, creation always off, fresh Review Screen

Spec: stories 12, 21, 38, 44; Implementation Decisions "Flow service". Found by the spec audit (`scratchpad` audit gaps 5, 6, 10, 11).

**What to build:**

- **Creation is always switched off (story 12).** `create_from_task` adopts the
  pre-imported copy (fixed id from `infra/automation-flows/import-workflow.sh`)
  as it is, even when it is active (`crates/screenpipe-engine/src/automation_flows.rs`,
  adopt path). If the adopted workflow is active, unpublish it before
  recording, and log nothing as "activated".
- **A refused n8n API key is not "unreachable" (story 44).** Every non-2xx
  n8n answer becomes `502 n8n_unreachable` today (`upstream_error`). Map n8n
  401/403 to a distinct error (e.g. `412 {error: "n8n_unauthorized"}`) whose
  UI message says the API key in Connections → n8n was refused; keep
  `n8n_not_configured` and `n8n_unreachable` as they are. Update the typed
  client codes and messages (`apps/screenpipe-app-tauri/components/automation-flows/api.ts`,
  `common.tsx`, `lib/workflows/automation-flows.ts`).
- **The Review Screen and the list stay fresh (stories 21, 38).** They reload
  only on navigation today (`common.tsx`). Reload on window focus /
  visibility change and every ~15 s while visible, so a new execution, a
  chat change or an edit in n8n shows without re-opening the Flow. No
  flicker or lost scroll position on reload.
- **Small:** the list follows n8n pagination (`list_flows` reads one page);
  a Review Screen test covers the last-run line.

**Blocked by:** None. Ticket 14 changes `POST /:id/activate` and the client's
activate call in parallel: keep your edits away from activation and merge the
integration tip before reporting.

**Status:** ready-for-agent

- [ ] Engine tests (fake n8n): an active pre-imported copy is switched off on creation; n8n 401 → `n8n_unauthorized`; pagination returns every tagged workflow.
- [ ] Frontend tests: the unauthorized message; the screen reloads on focus/visibility and on its interval, keeping its content while loading; last-run line rendered.
