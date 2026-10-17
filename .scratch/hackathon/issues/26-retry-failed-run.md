# 26: Retry a Failed Run

Spec: `.scratch/hackathon/SPEC.md` D17.

**What to build:** A Failed Run is never lost. The Review Screen shows a
« Relancer » action on the latest Failed Run, and the D16 notification offers
the same action. Retrying replays the Run with the same input (the email the
trigger already marked read) through n8n's retry, then the screen shows the
new outcome. Retrying an already successful or still running Run is refused
with a clear message.

**Blocked by:** 24 (the notification it adds an action to), 25 (makes a retry safe from duplicate tickets).

**Status:** ready-for-agent

- [ ] Flow service tests against the fake n8n: retry of a failed Run calls n8n's retry and returns the new Run; a successful or running Run is refused; an unknown Run gives 404.
- [ ] « Relancer » appears only on a Failed Run and refreshes the Review Screen (frontend tests).
- [ ] Live check (pending human): make a Run fail (e.g. Jira credential emptied), restore the credential, click « Relancer », get exactly one ticket.
