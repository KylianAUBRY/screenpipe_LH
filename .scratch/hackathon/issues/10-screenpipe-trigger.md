# 10: ScreenPipe Trigger starts a workflow on a keyword, a window or a pipe/Flow

Spec: `.scratch/hackathon/automation-flows-spec.md` (decision D12 in `SPEC.md`). Demo use not decided.

**What to build:** A deterministic polling trigger node in the ScreenPipe
node package. Modes: a keyword appears in the audio transcription; a given
app or window becomes active; a given pipe or Flow fires. It keeps a cursor
between polls so each event fires once, and emits `{mode, matchedAt, text,
app, window}`.

**Blocked by:** 07.

**Status:** ready-for-agent

- [ ] Package tests against a fake ScreenPipe API: the keyword mode emits once per new match and advances its cursor; the window mode fires on change only; the pipe mode fires on a new execution.
- [ ] Manual check in the local n8n: saying the keyword aloud starts an example workflow.
