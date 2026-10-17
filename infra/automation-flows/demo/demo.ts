// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Demo start: install the scripted Detected Task, then show the notification
// whose action opens its Task Page.
//   bun infra/automation-flows/demo/demo.ts              install + notify
//   bun infra/automation-flows/demo/demo.ts --no-notify  install only
//   bun infra/automation-flows/demo/demo.ts --print      print a catalog holding only the task (browser mock)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDetectedTask, DEMO_TASK_ID, DEMO_TASK_URL } from "./detected-task";
import { catalogDir, readCatalog, upsertTask, writeCatalog } from "./catalog";

const NOTIFY_URL = process.env.SCREENPIPE_NOTIFY_URL ?? "http://localhost:11435/notify";

export function evidenceDataUrl(image: string): string {
  const bytes = readFileSync(join(import.meta.dir, "evidence", `${image}.webp`));
  return `data:image/webp;base64,${bytes.toString("base64")}`;
}

/** Same deeplink action shape as the native workflow notification (`notifications/workflow.rs`). */
export function notificationPayload(now = Date.now()) {
  return {
    // Unique per run: the route drops a repeated id ("Notification already sent").
    id: `automation-flows-demo:${DEMO_TASK_ID}:${now}`,
    title: "Tâche répétitive détectée",
    body: "Tu as transformé 3 e-mails de bug en tickets Jira NOVA. Réponds à 2 questions pour l'automatiser.",
    type: "pipe",
    priority: "normal",
    transient: false,
    autoDismissMs: 60_000,
    source_url: DEMO_TASK_URL,
    actions: [{ type: "deeplink", label: "Voir la tâche", url: DEMO_TASK_URL, primary: true }],
  };
}

async function notify() {
  const response = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notificationPayload()),
  }).catch(() => null);
  if (!response) throw new Error(`ScreenPipe is not reachable at ${NOTIFY_URL}. Open the ScreenPipe app and retry.`);
  const result = await response.json().catch(() => ({})) as { message?: string };
  // Delivery gates answer 200 with a reason instead of showing the alert.
  if (!response.ok || result.message !== "Notification sent successfully") {
    const reason = result.message ?? `HTTP ${response.status}`;
    throw new Error(`Notification not shown: ${reason}. ${reason.includes("duplicate")
      ? "The same alert was shown less than 90 s ago; wait and retry."
      : "Check ScreenPipe Settings > Notifications (pipe notifications, pause, quiet hours)."}`);
  }
  console.log("Notification shown. Click « Voir la tâche » to open the Task Page.");
}

if (import.meta.main) {
  const args = new Set(process.argv.slice(2));
  const now = new Date().toISOString();
  const task = buildDetectedTask(evidenceDataUrl, now);
  if (args.has("--print")) {
    process.stdout.write(JSON.stringify(upsertTask(null, task, now)));
    process.exit(0);
  }
  try {
    const dir = catalogDir();
    const previous = readCatalog(dir);
    writeCatalog(dir, previous, upsertTask(previous, task, now));
    console.log(`Installed ${DEMO_TASK_ID} in ${join(dir, "catalog.json")}`);
    if (!args.has("--no-notify")) await notify();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
