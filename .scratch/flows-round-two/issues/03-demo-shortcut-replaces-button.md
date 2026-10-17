# 03: Demo shortcut ⌃⌥⌘D replaces « Trouver une automatisation »

**What to build:** On stage the presenter presses ⌃⌥⌘D, even when ScreenPipe is not in front: the detected task is reset to its start state and the « Tâche répétitive détectée » notification is sent, exactly like the demo script. When the notification cannot be shown (duplicate within 90 s, pause, quiet hours, server unreachable) the presenter is told why. The « Trouver une automatisation » button is gone. The shortcut is active in every build.

Spec: `.scratch/hackathon/issues/27-flows-round-two.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] ⌃⌥⌘D is registered globally by the desktop app and works when the app is in the background.
- [ ] The shortcut runs the same demo installer as the demo script: answers cleared, task reinstalled, notification sent.
- [ ] When the notification is not shown, a visible message gives the reason.
- [ ] The button and its component are removed; the shared demo-task module stays and keeps its tests.
- [ ] The demo trigger is tested as a TypeScript function (reset, notify, reasons); the global registration is checked live and noted.
