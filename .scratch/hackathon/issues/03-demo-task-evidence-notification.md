# 03: Demo Detected Task with recorded evidence, opened from a notification

Spec: `.scratch/hackathon/automation-flows-spec.md` (decisions D3, D8, D10 in `SPEC.md`).

**What to build:** A demo script installs the scripted Detected Task
`wf-novadesk-support-tickets` ("bug-report emails become Jira tickets", three
repetitions, the two Clarification Questions) into ScreenPipe's catalog and
fires the notification whose action opens its Task Page through the existing
deeplink. The Evidence is key frames from the team's screen recording: for
each repetition, the open email, the Jira creation form and the created
ticket, cropped to the browser and compressed. They are embedded in the
fixture; the screenshot serialization gets a narrow path so embedded images
survive persistence. A reset script removes the demo task's answers (and,
once 02 exists, the demo Flow) so the demo can be replayed.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Running the demo script shows a notification; clicking it opens the Task Page of the demo task.
- [ ] The Task Page shows the three repetitions with their images and times.
- [ ] Both Clarification Questions are displayed.
- [ ] The reset script restores the initial state, and the demo script works again after it.
- [ ] The existing workflows UI tests still pass.
- [ ] Committed images show only the demo accounts (no unrelated windows) and stay small.
