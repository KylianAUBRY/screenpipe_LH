# 04: Delete a Flow from the app and from the chat

**What to build:** The user deletes a Flow from the Flows list or its Review Screen; the chat deletes one when asked, without a confirmation step. An active Flow is switched off first (waiting for the email being processed), then the n8n workflow is deleted for good and the ScreenPipe record (summary, history) removed. Deleting a Flow n8n no longer has clears it from ScreenPipe.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A delete route accepts the Review Screen and the local API key (chat).
- [ ] An active Flow is unpublished with the existing running-execution wait before deletion; a Flow still processing at the deadline is left untouched with `409 flow_running`.
- [ ] The n8n workflow is deleted (not archived) and the ScreenPipe record removed; a Flow missing in n8n is still cleared.
- [ ] The list and the Review Screen offer Delete; the list no longer shows the Flow afterwards.
- [ ] The automation-flows skill documents deletion.
- [ ] Engine integration tests cover idle, active, running and missing Flows; component tests cover the Delete action.
