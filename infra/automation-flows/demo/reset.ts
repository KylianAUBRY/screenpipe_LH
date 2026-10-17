// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Demo reset: bring the demo machine back to the state before the first click.
//   bun infra/automation-flows/demo/reset.ts
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_TASK_ID } from "./detected-task";

const STORE_FILE = "automation-flows.json";
const WORKFLOW_FILE = join(import.meta.dir, "..", "workflows", "novadesk-support-tickets.json");
/** The copy `import-workflow.sh` installs keeps the bundled workflow's fixed id. */
export const DEMO_WORKFLOW_ID: string = JSON.parse(readFileSync(WORKFLOW_FILE, "utf8")).id;

export type N8nConfig = { url: string; apiKey: string };
export type CommandRunner = (argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
export type ResetOptions = {
  n8n: N8nConfig | null;
  /** ScreenPipe data dir, holding the engine's `automation-flows.json`. */
  dataDir: string;
  /** Workflow catalog dir (`catalog.ts`), holding the Task Page answers. */
  catalogDir: string;
  /** The n8n container (`docker-compose.yml`). */
  container: string;
  run: CommandRunner;
  log: (line: string) => void;
};
export type ResetReport = { failures: string[] };

type FlowStore = { flows?: Record<string, { sourceTaskId?: string | null }> };
type N8nWorkflow = { id: string; name?: string; active?: boolean; isArchived?: boolean };
type N8nCall = (method: string, path: string) => Promise<{ status: number; body: any }>;

function n8nClient({ url, apiKey }: N8nConfig): N8nCall {
  return async (method, path) => {
    const response = await fetch(`${url}/api/v1${path}`, { method, headers: { "X-N8N-API-KEY": apiKey } });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  };
}

const ok = (status: number) => status >= 200 && status < 300;
const answer = ({ status, body }: { status: number; body: any }) =>
  `n8n answered ${status}${body?.message ? `: ${body.message}` : ""}`;

/** Switches a workflow off, then deletes it (archiving first when n8n asks for
 * it). Returns what it did; throws with n8n's reason when it is still there. */
async function removeWorkflow(n8n: N8nCall, id: string): Promise<string> {
  const found = await n8n("GET", `/workflows/${id}`);
  if (found.status === 404) return `${id} is not in n8n (already removed)`;
  if (!ok(found.status)) throw new Error(`cannot read ${id}: ${answer(found)}`);
  const workflow = found.body as N8nWorkflow;
  const done: string[] = [];
  if (workflow.active) {
    const off = await n8n("POST", `/workflows/${id}/unpublish`);
    if (!ok(off.status)) throw new Error(`cannot switch off ${id}: ${answer(off)}`);
    done.push("switched off");
  }
  let deleted = await n8n("DELETE", `/workflows/${id}`);
  if (!ok(deleted.status) && deleted.status !== 404 && !workflow.isArchived) {
    // n8n 2.x deletes only archived workflows.
    const archived = await n8n("POST", `/workflows/${id}/archive`);
    if (!ok(archived.status)) throw new Error(`cannot archive ${id}: ${answer(archived)} (delete: ${answer(deleted)})`);
    done.push("archived");
    deleted = await n8n("DELETE", `/workflows/${id}`);
  }
  if (!ok(deleted.status) && deleted.status !== 404) throw new Error(`cannot delete ${id}: ${answer(deleted)}`);
  const after = await n8n("GET", `/workflows/${id}`);
  if (after.status !== 404) throw new Error(`${id} is still in n8n after delete (${answer(after)})`);
  done.push("deleted");
  return `${id} (${workflow.name ?? "unnamed"}): ${done.join(", ")}`;
}

export async function resetDemo(options: ResetOptions): Promise<ResetReport> {
  const failures: string[] = [];
  const storePath = join(options.dataDir, STORE_FILE);
  const store: FlowStore = existsSync(storePath) ? JSON.parse(readFileSync(storePath, "utf8")) : {};
  const demoIds = Object.entries(store.flows ?? {})
    .filter(([, record]) => record.sourceTaskId === DEMO_TASK_ID)
    .map(([id]) => id);

  const n8n = n8nClient(options.n8n!);
  const gone: string[] = [];
  for (const id of new Set([...demoIds, DEMO_WORKFLOW_ID])) {
    options.log(`n8n: ${await removeWorkflow(n8n, id)}`);
    gone.push(id);
  }

  const flows = Object.fromEntries(Object.entries(store.flows ?? {}).filter(([id]) => !gone.includes(id)));
  const tmp = `${storePath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...store, flows }, null, 2));
  renameSync(tmp, storePath);
  return { failures };
}
