// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Hidden demo shortcut ⌃⌥⌘D (registered globally by the desktop app,
// src-tauri/src/shortcuts.rs, which emits DEMO_SHORTCUT_EVENT to the Home
// window). Runs the same demo installer as `infra/automation-flows/demo/demo.ts`:
// the detected task is reinstalled in its start state (answers cleared), then
// « Tâche répétitive détectée » is sent. When the notification is not shown,
// the presenter is told why and the Task Page opens directly.
import { findAutomation, type FindAutomationDeps, type FindAutomationResult } from "./find-automation";

/** Emitted by the native shortcut handler; keep in sync with `DEMO_SHORTCUT_EVENT` in shortcuts.rs. */
export const DEMO_SHORTCUT_EVENT = "shortcut-automation-flows-demo";

export type DemoShortcutMessage = { title: string; description: string; destructive?: true };

export type DemoShortcutDeps = {
  installer: FindAutomationDeps;
  /** What the notification's « Voir la tâche » does. */
  openTask: () => Promise<void>;
  /** A message the presenter sees (a toast in the Home window). */
  tell: (message: DemoShortcutMessage) => void;
};

export type DemoShortcutOutcome = FindAutomationResult | { ignored: true };

/** One handler per listener: a press while the previous one still runs is ignored. */
export function demoShortcutHandler(deps: DemoShortcutDeps): () => Promise<DemoShortcutOutcome> {
  let running = false;
  return async () => {
    if (running) return { ignored: true };
    running = true;
    try {
      let result: FindAutomationResult;
      try {
        result = await findAutomation(deps.installer);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        deps.tell({ title: "Démo non lancée", description: reason, destructive: true });
        return { notified: false, reason };
      }
      if (!result.notified) {
        deps.tell({ title: "Notification non affichée", description: `${result.reason}. La tâche s'ouvre directement.` });
        await deps.openTask();
      }
      return result;
    } finally {
      running = false;
    }
  };
}
