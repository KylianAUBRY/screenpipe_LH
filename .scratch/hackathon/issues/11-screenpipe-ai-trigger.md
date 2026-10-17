# 11: ScreenPipe AI Trigger starts a workflow when a described situation happens

Spec: `.scratch/hackathon/automation-flows-spec.md` (decision D12 in `SPEC.md`). Demo use not decided.

**What to build:** A polling trigger node in the ScreenPipe node package that
takes a condition written in plain language, a look-back window and a
cooldown. On each poll it sends the recent activity summary to ScreenPipe's
local AI proxy and fires when the answer says the condition is met, with the
AI's reason in the output. It does not fire again before the cooldown ends.

**Blocked by:** 07.

**Status:** ready-for-agent

- [ ] Package tests against a fake ScreenPipe API and a fake AI answer: fires only when the condition is met; respects the cooldown; an AI error does not fire.
- [ ] Manual check in the local n8n with a simple condition.
