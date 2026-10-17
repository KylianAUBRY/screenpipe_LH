// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Demo reset: remove the answers saved on the demo Task Page so the
// Clarification Questions start empty again. The task itself stays installed.
//   bun infra/automation-flows/demo/reset.ts
import { join } from "node:path";
import { catalogDir, clearAnswers, readCatalog, writeCatalog } from "./catalog";
import { DEMO_TASK_ID } from "./detected-task";

try {
  const dir = catalogDir();
  const previous = readCatalog(dir);
  if (!previous) throw new Error(`No workflow catalog in ${dir}. Run the demo script first.`);
  const { catalog, changed } = clearAnswers(previous);
  if (changed) writeCatalog(dir, previous, catalog);
  console.log(changed
    ? `Cleared the answers of ${DEMO_TASK_ID} in ${join(dir, "catalog.json")}`
    : `${DEMO_TASK_ID} has no saved answers; nothing to reset.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
