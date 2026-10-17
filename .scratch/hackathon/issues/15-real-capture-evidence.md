# 15: Task Page evidence from the machine's real captures

Spec: `.scratch/hackathon/automation-flows-spec.md` (stories 4, 5); `SPEC.md` D8 and "Demo data"; ticket 03 (what exists today).

**What to build:** The demo Detected Task shows each recorded repetition with
the real ScreenPipe captures of the machine it runs on, like the finished
product would. When `bun infra/automation-flows/demo/demo.ts` installs the
task, it looks up, through the local ScreenPipe API, the frames of the three
recorded repetitions (`SPEC.md` "Demo data": NOVA-25, NOVA-26, NOVA-27 created
on 2026-10-17 between 04:00 and 04:20 local time, in Gmail then Jira windows)
and stores their `frameId`s and real timestamps in the task's evidence, so the
Task Page loads them live and "View in timeline" opens those exact moments.
When a frame cannot be found (another machine, deleted data, API down), that
step keeps today's embedded key frame, so the demo never shows a broken
image. The lookup is deterministic code, no AI.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Tests against a fake ScreenPipe API: found frames are written with their `frameId` and timestamp; a missing frame or an API error keeps the embedded image for that step; the auth header is sent.
- [ ] The Task Page renders a live `frameId` capture and an embedded fallback (frontend test through the existing screenshot loading path, `packages/workflows-ui/src/screenshots.ts`).
- [ ] On the demo machine (agent-verified by the orchestrator): the installed task points at real frames of NOVA-25/26/27 and "View in timeline" lands on them.
