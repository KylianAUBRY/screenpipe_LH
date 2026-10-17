# 13: The AI proxy returns OpenAI-shaped tool calls

Spec: `.scratch/hackathon/automation-flows-spec.md` (decision D11 in `SPEC.md`; probe results in its "Verified on the local n8n 2.42.2" section). Found while doing ticket 07.

**What to build:** When an n8n AI Agent (or any OpenAI-compatible client) uses
tools through ScreenPipe's local AI proxy, the conversation keeps working
after the first tool call. Today the proxy passes the upstream answer through
unchanged, and tool calls come back as `{"type": "tool_use", "function": …}`
with an empty or missing `id` and no `finish_reason`; the client then sends
the tool result with `tool_call_id: ""` and the next call fails with 400
"malformed tool call". The proxy normalizes non-streaming JSON answers: every
tool call gets a unique non-empty `id` (e.g. `call_<uuid>`) and
`type: "function"`, and `finish_reason` is `"tool_calls"` when tool calls are
present and the field is missing. Everything else (other fields, plain
answers, streaming, errors) passes through unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Engine tests through the proxy route with a fake upstream: tool calls without ids get unique ids and type "function"; existing ids are kept; finish_reason is set only when missing; a plain answer and an error answer are byte-for-byte unchanged; streaming is untouched.
- [ ] The two-turn probe from ticket 07 (tool call, then tool result) returns 200 through the proxy when the app runs the dev build containing the fix.
- [ ] The demo n8n workflow with the ScreenPipe tool runs end to end on a synthetic email (manual-trigger probe), ending with `{type, product, summary, priority, label}`.

Note: the running ScreenPipe is the installed app, which does not contain
engine changes. Live checks need the dev build (`bun run dev:tauri` from the
app folder, installed app quit first); that switch is a human step.
