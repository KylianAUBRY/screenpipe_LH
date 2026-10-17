# 20: The agent's browser cannot open the app's own pages

Spec: story 34 ("the chat can never switch anything on"); ticket 14 (UI-only
activation credential). Found by the ticket 14 implementer.

**What to build:** The agent-controlled browser
(`apps/screenpipe-app-tauri/src-tauri/src/owned_browser.rs`) accepts any URL
scheme (`normalize_url`) and allows every navigation (`on_navigation` returns
`true`). Its webviews share the app's capabilities, so a page from the app's
own origin (`tauri://localhost`, `http(s)://tauri.localhost`, `ipc:`,
`asset:` / `http(s)://asset.localhost`, the dev server origin in debug
builds) gets Tauri IPC: the agent could load the app inside its browser and
call `get_flow_activation_key` or click « Activer » there, bypassing ticket
14. Refuse those origins in the owned browser: `normalize_url` returns an
error for them (the agent gets a clear message), and `on_navigation` returns
`false` for them (a page cannot redirect there). Ordinary web URLs, `about:`,
`data:` etc. keep working exactly as before.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] Tests (src-tauri, `bun run test:tauri owned_browser`): every app-origin form above is refused by URL normalization and by the navigation check, case and trailing-slash variants included; `https://example.com`, `localhost:8080`, `about:blank` still pass.
- [ ] Nothing else in the owned browser changes (existing owned_browser tests pass).
