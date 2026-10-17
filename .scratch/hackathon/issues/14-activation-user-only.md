# 14: Only a user click can activate a Flow (enforced by the server)

Spec: `.scratch/hackathon/automation-flows-spec.md` (story 22, 34); AGENTS.md "nothing activates without an explicit user action". Found by an automated security review after ticket 08.

**What to build:** Today the chat agent (Pi) calls the Flow service with the
same local API key as the app, so it could call
`POST /automation-flows/:id/activate` itself; only the `automation-flows`
skill text forbids it. The server must refuse activation unless it comes from
the desktop UI after a user click: `versionId` becomes mandatory (400 when
missing), and the route rejects requests that do not carry the app's client
context (see `crates/screenpipe-engine/src/routes/request_origin.rs`,
`ExplicitApiClient` with sources App / MCP / API) or, better, moves behind a
UI-only credential or Tauri command. State-changing `/automation-flows` routes
also require `Content-Type: application/json`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Flow service tests: activate without `versionId` → 400; activate from an agent/pipe/MCP client context → 403; activate from the app context with the reviewed version → 200 (existing tests still pass).
- [ ] The Review Screen's Activer still works (frontend tests and browser mock).
- [ ] A chat request asking to activate a Flow is refused by the server, not only by the skill.
