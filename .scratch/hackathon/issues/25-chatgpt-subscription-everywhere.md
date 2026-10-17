# 25: The user's ChatGPT subscription answers every AI

User decision (2026-10-17, SPEC D21): ScreenPipe's `auto` model
(`claude-haiku-5-5` behind the cloud gateway's Auto router) is not smart
enough to build Flows or to judge in the n8n nodes. Every AI in scope now uses
the user's ChatGPT subscription.

**Status:** code done, unit and integration tests pass; live check waits for a
ChatGPT sign-in in the app (see « Live check »).

## Where each AI gets its model

| AI | Before | Now |
|----|--------|-----|
| ScreenPipe chat (Flow creation, Flow changes) | default preset `screenpipe-cloud` / `auto` | the ChatGPT preset: Settings → AI → « Use a model directly » → ChatGPT, signed in, set as default. No code: Pi already speaks the ChatGPT backend. |
| n8n AI step (OpenAI Chat Model, credential `spProxyOpenAI001`) | model `auto` | model `chatgpt/gpt-5.6-terra`, same credential and base URL |
| ScreenPipe AI Trigger | `model: "auto"` hard-coded | new `model` parameter, default `chatgpt/gpt-5.6-terra` |

## How `chatgpt/<model>` works

The local proxy `POST :3030/v1/chat/completions` (`routes/cloud_proxy.rs`)
hands any request whose model starts with `chatgpt/` to
`routes/chatgpt_proxy.rs`, which:

- reads the ChatGPT sign-in the app stored (`oauth:chatgpt` in the secret
  store), refreshed under the shared refresh lease, through
  `screenpipe_core::pipes::read_chatgpt_oauth_token` (the function pipes use),
  so no app-side change;
- translates Chat Completions → Codex Responses (`chatgpt.com/backend-api/codex/responses`,
  `store: false`, `stream: true`): system messages become `instructions`,
  tool calls and results become `function_call` / `function_call_output`,
  `response_format` becomes `text.format`, `reasoning_effort` becomes
  `reasoning.effort`; sampling and length parameters are dropped;
- reads the stream to its end and answers one OpenAI chat completion (or a
  short chat stream for `stream: true`), with OpenAI-shaped tool calls;
- errors are OpenAI-shaped (`{"error": {"message"}}`): 503
  `chatgpt_not_connected` without a sign-in, the backend's status and reason
  otherwise, 429 for usage limits.

Every other model (`auto`, `gemma4-e4b`, …) still goes to screenpipe cloud,
byte for byte as before.

## Files

- `crates/screenpipe-engine/src/routes/chatgpt_proxy.rs` (new, 14 tests),
  `routes/cloud_proxy.rs` (dispatch), `routes/mod.rs`.
- `crates/screenpipe-core/src/pipes/mod.rs`: `read_chatgpt_oauth_token` is `pub`.
- `packages/n8n-nodes-screenpipe/nodes/ScreenPipeAiTrigger/ScreenPipeAiTrigger.node.ts`
  (+ tests): `model` parameter; reads OpenAI-shaped error bodies.
- `crates/screenpipe-core/assets/skills/automation-flows/SKILL.md`: the chat
  builds AI steps on `chatgpt/gpt-5.6-terra` and knows the trigger's `model`.
- `infra/automation-flows/workflows/novadesk-support-tickets.json`,
  `.review.json`, `.test.ts`, and the app fixture
  `components/automation-flows/fixtures.ts`: model and wording (« votre
  abonnement ChatGPT »).
- `AGENTS.md` (AI model rule), `SPEC.md` (D21).

## Tests run

- `cargo test -p screenpipe-engine --lib routes::` → 389 passed (14 new in
  `chatgpt_proxy`, the 6 `cloud_proxy` tests unchanged).
- `cargo test -p screenpipe-engine --test automation_flows_test` → 48 passed.
- `cd packages/n8n-nodes-screenpipe && bun test` → 47 passed; `bun run typecheck` clean.
- `bun test infra/automation-flows/workflows` → 20 passed.
- `cd apps/screenpipe-app-tauri && bunx vitest run components/automation-flows lib/workflows/automation-flows.test.ts`
  → 94 passed. (The full vitest suite has 180 failures in 17 unrelated files,
  mostly `localStorage` missing in the test environment.)

## Live check

Needs, in this order: the app rebuilt from this branch (`bun run build:tauri:dev`)
and restarted; a ChatGPT sign-in in Settings → AI → ChatGPT; the n8n nodes
reinstalled (`bun run install-n8n`, done).

1. `curl` the proxy with `"model": "chatgpt/gpt-5.6-terra"` and the local key → a chat completion.
2. The n8n AI step on a demo email → a Jira ticket.
3. A ScreenPipe AI Trigger « Fetch Test Event » → the AI's decision.

## Known limits

- ChatGPT plans have usage windows; a polling AI Trigger spends them. A usage
  limit is a 429 that the trigger treats as « not met » and the n8n step fails
  (and retries) on.
- The n8n AI step's 20 s timeout was sized for `auto` (1-6 s); a reasoning
  model can be slower. Measure in the live check before the demo.
- `/v1/local/chat/completions` (« the user's preset ») still sends
  `openai-chatgpt` presets to `api.openai.com`, which refuses a ChatGPT token.
  Not used by Flows.
