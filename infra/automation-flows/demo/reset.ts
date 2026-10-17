// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Demo reset: bring the demo machine back to the state before the first click.
//   bun infra/automation-flows/demo/reset.ts
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clearAnswers, readCatalog, writeCatalog } from "./catalog";
import { DEMO_TASK_ID } from "./detected-task";

const STORE_FILE = "automation-flows.json";
// The bundled demo workflow (the engine's from-task fixture).
const WORKFLOW = JSON.parse(readFileSync(join(import.meta.dir, "..", "workflows", "novadesk-support-tickets.json"), "utf8"));
/** The copy `import-workflow.sh` installs keeps the bundled workflow's fixed id. */
export const DEMO_WORKFLOW_ID: string = WORKFLOW.id;
// The demo inbox is the one the Flow's email trigger reads.
const TRIGGER = WORKFLOW.nodes.find((node: { type: string }) => node.type === "n8n-nodes-base.emailReadImap");
const IMAP_CREDENTIAL_ID: string = TRIGGER.credentials.imap.id;
const MAILBOX: string = TRIGGER.parameters.mailbox ?? "INBOX";
const MARK_READ_SCRIPT = readFileSync(join(import.meta.dir, "mark-read.sh"), "utf8");

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
    const response = await fetch(`${url}/api/v1${path}`, {
      method, headers: { "X-N8N-API-KEY": apiKey }, signal: AbortSignal.timeout(15_000),
    }).catch(error => { throw new Error(`cannot reach n8n at ${url} (${error instanceof Error ? error.message : error})`); });
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

/** `mark-read.sh` inside the n8n container: the IMAP secret never leaves it. */
async function markInboxRead({ container, run }: ResetOptions): Promise<string> {
  const { code, stdout, stderr } = await run([
    "docker", "exec",
    "-e", "N8N_RUNNERS_BROKER_PORT=5690", // the n8n server holds the default runner port
    "-e", `CRED_ID=${IMAP_CREDENTIAL_ID}`,
    "-e", `MAILBOX=${MAILBOX}`,
    container, "sh", "-c", MARK_READ_SCRIPT,
  ]);
  const tail = (text: string) => text.trim().split("\n").slice(-3).join(" / ");
  if (code !== 0) throw new Error(`could not mark the demo inbox read (exit ${code}): ${tail(stderr) || tail(stdout)}`);
  let result: { marked: number; unread: number };
  try {
    result = JSON.parse(stdout.trim().split("\n").at(-1) ?? "");
  } catch {
    throw new Error(`unexpected answer from the n8n container: ${tail(stdout)}`);
  }
  if (result.unread > 0) throw new Error(`marked ${result.marked} emails read but ${result.unread} unread email(s) left in ${MAILBOX}`);
  return `marked ${result.marked} unread email(s) as read in ${MAILBOX} (0 unread left)`;
}

/** The engine's Flow records (`automation_flows.rs`); a missing file has none. */
function loadStore(path: string): FlowStore {
  if (!existsSync(path)) return {};
  try {
    const store = JSON.parse(readFileSync(path, "utf8")) as FlowStore;
    if (typeof store === "object" && store !== null && (store.flows === undefined || typeof store.flows === "object")) return store;
  } catch {
    // Reported below.
  }
  throw new Error(`${path} is not a valid ${STORE_FILE}; it was left untouched`);
}

function clearTaskAnswers(dir: string): string {
  const previous = readCatalog(dir);
  if (!previous) throw new Error(`no workflow catalog in ${dir}; run the demo script first`);
  const { catalog, changed } = clearAnswers(previous);
  if (changed) writeCatalog(dir, previous, catalog);
  return changed
    ? `cleared the answers of ${DEMO_TASK_ID} in ${join(dir, "catalog.json")}`
    : `${DEMO_TASK_ID} has no saved answers`;
}

/** Every step runs even when an earlier one fails; each failure is reported. */
export async function resetDemo(options: ResetOptions): Promise<ResetReport> {
  const failures: string[] = [];
  const fail = (name: string, error: unknown) => {
    const reason = `${name}: ${error instanceof Error ? error.message : String(error)}`;
    failures.push(reason);
    options.log(`FAILED ${reason}`);
  };
  const step = async (name: string, action: () => Promise<string> | string) => {
    try {
      options.log(`${name}: ${await action()}`);
    } catch (error) {
      fail(name, error);
    }
  };

  const storePath = join(options.dataDir, STORE_FILE);
  let store: FlowStore | null;
  try {
    store = loadStore(storePath);
  } catch (error) {
    store = null;
    fail("records", error);
  }
  const demoIds = Object.entries(store?.flows ?? {})
    .filter(([, record]) => record.sourceTaskId === DEMO_TASK_ID)
    .map(([id]) => id);

  const gone: string[] = [];
  let n8n: N8nCall | null = null;
  try {
    if (!options.n8n) throw new Error("no n8n API key: export N8N_API_KEY (the key saved in ScreenPipe > Connections > n8n)");
    const client = n8nClient(options.n8n);
    const probe = await client("GET", "/workflows?limit=1");
    if (!ok(probe.status)) throw new Error(`n8n at ${options.n8n.url} refused the request (${answer(probe)})`);
    n8n = client;
    options.log(`n8n: connected to ${options.n8n.url}`);
  } catch (error) {
    fail("n8n", error);
  }
  for (const id of new Set([...demoIds, DEMO_WORKFLOW_ID])) {
    if (!n8n) break;
    const client = n8n;
    await step("n8n", async () => {
      const done = await removeWorkflow(client, id);
      gone.push(id);
      return done;
    });
  }

  if (store) {
    const current = store;
    await step("records", () => {
      const removed = Object.keys(current.flows ?? {}).filter(id => gone.includes(id));
      if (removed.length === 0) return "no demo Flow record to remove";
      const flows = Object.fromEntries(Object.entries(current.flows ?? {}).filter(([id]) => !removed.includes(id)));
      // Same format and atomic replace as the engine's `FlowStore::save`.
      const tmp = `${storePath}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ ...current, flows }, null, 2));
      renameSync(tmp, storePath);
      return `removed ${removed.join(", ")} from ${storePath}`;
    });
  }

  await step("inbox", () => markInboxRead(options));
  await step("answers", () => clearTaskAnswers(options.catalogDir));
  return { failures };
}
