# 24: A Failed Run notifies the user

Spec: `.scratch/hackathon/SPEC.md` D16; glossary `CONTEXT.md` (Run, Failed Run).

**What to build:** When a Run of any Flow stops on an error, the user gets a
ScreenPipe notification that names the Flow, the failing step and, when the
Run handled an email, its sender and subject; clicking it opens the Flow's
Review Screen. The Flow shows in red in the Flows list and on the Review
Screen until a later Run succeeds. Every Flow gets this without extra setup:
ScreenPipe installs one n8n error workflow (tagged, not a Flow itself) and
attaches it to each Flow it creates, imports or updates. No automatic pause.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Flow service tests: create, import and chat update attach the error workflow to the Flow; the error workflow is installed once and never listed as a Flow.
- [ ] A Run made to fail in the local n8n produces one notification that opens the right Review Screen (manual check, steps written in the ticket).
- [ ] The Flows list and Review Screen show the failed state until the next successful Run (frontend tests).
- [ ] The notification never contains the email body or any secret.
