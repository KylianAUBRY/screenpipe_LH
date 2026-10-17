// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCatalog } from "./catalog";
import { resetDemo, type CommandRunner } from "./reset";

const KEY = "test-n8n-key";
const DEMO_TASK = "wf-novadesk-support-tickets";

type FakeWorkflow = { id: string; name: string; active: boolean; isArchived?: boolean; tags?: { name: string }[] };
type Refusal = { status: number; message: string };

/** n8n 2.x public API as far as reset uses it. Refuses what n8n would refuse:
 * archiving or deleting a workflow that is switched on, and (strict) deleting
 * one that is not archived. */
function fakeN8n(initial: FakeWorkflow[], options: { strictArchive?: boolean; refuse?: Record<string, Refusal> } = {}) {
  const workflows = new Map(initial.map(workflow => [workflow.id, { ...workflow }]));
  const json = (status: number, body: unknown) => Response.json(body, { status });
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      if (request.headers.get("X-N8N-API-KEY") !== KEY) return json(401, { message: "unauthorized" });
      const url = new URL(request.url);
      const [, id, action] = url.pathname.match(/^\/api\/v1\/workflows(?:\/([^/]+))?(?:\/([^/]+))?$/) ?? [];
      const refusal = options.refuse?.[`${request.method} ${action ?? ""} ${id}`.replace("  ", " ")];
      if (refusal) return json(refusal.status, { message: refusal.message });
      if (!id && request.method === "GET") {
        const tag = url.searchParams.get("tags");
        return json(200, { data: [...workflows.values()].filter(w => !w.isArchived && (!tag || w.tags?.some(t => t.name === tag))), nextCursor: null });
      }
      const workflow = id ? workflows.get(id) : undefined;
      if (!workflow) return json(404, { message: "Not Found" });
      if (request.method === "GET" && !action) return json(200, workflow);
      if (request.method === "POST" && action === "unpublish") { workflow.active = false; return json(200, workflow); }
      if (request.method === "POST" && action === "archive") {
        if (workflow.active) return json(400, { message: "Workflow is active" });
        workflow.isArchived = true;
        return json(200, workflow);
      }
      if (request.method === "DELETE" && !action) {
        if (workflow.active) return json(400, { message: "Workflow is active" });
        if (options.strictArchive && !workflow.isArchived) return json(400, { message: "Workflow must be archived before it can be deleted." });
        workflows.delete(id!);
        return json(200, workflow);
      }
      return json(404, { message: "Not Found" });
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, workflows, stop: () => server.stop(true) };
}

const record = (sourceTaskId: string | null) => ({
  sourceTaskId, summary: "summary", answers: null, reviewedVersionId: null, activationLog: [], createdAt: "2026-10-17T06:00:00Z",
});

function dataDir(flows: Record<string, ReturnType<typeof record>>) {
  const dir = mkdtempSync(join(tmpdir(), "demo-reset-data-"));
  writeFileSync(join(dir, "automation-flows.json"), JSON.stringify({ flows }, null, 2));
  return dir;
}
const storedFlows = (dir: string) => JSON.parse(readFileSync(join(dir, "automation-flows.json"), "utf8")).flows;

function catalogDir(userCorrection: string | null = null) {
  const dir = mkdtempSync(join(tmpdir(), "demo-reset-catalog-"));
  const workflow = (id: string, answers: string | null) => ({ id, title: id, rank: 1, revision: 3, userCorrection: answers, stages: [] });
  writeFileSync(join(dir, "catalog.json"), JSON.stringify({
    schemaVersion: 5, revision: 7, analysis: { workflows: [workflow(DEMO_TASK, userCorrection), workflow("wf-other", "keep me")] },
  }));
  return dir;
}

const inbox = (marked = 0): CommandRunner => async () => ({ code: 0, stdout: `${JSON.stringify({ marked, unread: 0 })}\n`, stderr: "" });

let servers: { stop: () => void }[] = [];
afterEach(() => { servers.forEach(server => server.stop()); servers = []; });
function serve(...args: Parameters<typeof fakeN8n>) {
  const server = fakeN8n(...args);
  servers.push(server);
  return server;
}

describe("demo reset", () => {
  it("deletes the demo Flows from n8n and their records, and leaves other workflows alone", async () => {
    const n8n = serve([
      { id: "wfDemo000000001", name: "NovaDesk", active: false, tags: [{ name: "screenpipe-flow" }] },
      { id: "wfChat000000001", name: "Chat Flow", active: false, tags: [{ name: "screenpipe-flow" }] },
      { id: "wfOther00000001", name: "Not a Flow", active: true },
    ]);
    const data = dataDir({ wfDemo000000001: record(DEMO_TASK), wfChat000000001: record(null) });

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: data, catalogDir: catalogDir(), container: "n8n-test", run: inbox(), log: () => {},
    });

    expect(report.failures).toEqual([]);
    expect([...n8n.workflows.keys()]).toEqual(["wfChat000000001", "wfOther00000001"]);
    expect(n8n.workflows.get("wfOther00000001")!.active).toBe(true);
    expect(Object.keys(storedFlows(data))).toEqual(["wfChat000000001"]);
  });

  it("switches off an active demo Flow and the pre-imported copy, archives them, then deletes them", async () => {
    const n8n = serve([
      { id: "wfDemo000000001", name: "NovaDesk", active: true, tags: [{ name: "screenpipe-flow" }] },
      { id: "spNovaFlow000001", name: "NovaDesk (import script)", active: true, tags: [{ name: "screenpipe-flow" }] },
    ], { strictArchive: true });
    // A record whose workflow is already gone from n8n is cleaned up too.
    const data = dataDir({ wfDemo000000001: record(DEMO_TASK), wfGone000000001: record(DEMO_TASK) });
    const lines: string[] = [];

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: data, catalogDir: catalogDir(), container: "n8n-test", run: inbox(), log: line => lines.push(line),
    });

    expect(report.failures).toEqual([]);
    expect(n8n.workflows.size).toBe(0);
    expect(storedFlows(data)).toEqual({});
    expect(lines.join("\n")).toContain("spNovaFlow000001");
  });

  it("clears the demo Task Page answers and keeps the other tasks' answers", async () => {
    const n8n = serve([]);
    const catalog = catalogDir("saved answers");

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: dataDir({}), catalogDir: catalog, container: "n8n-test", run: inbox(), log: () => {},
    });

    expect(report.failures).toEqual([]);
    const answers = readCatalog(catalog)!.analysis.workflows.map(workflow => [workflow.id, workflow.userCorrection]);
    expect(answers).toEqual([[DEMO_TASK, null], ["wf-other", "keep me"]]);
  });

  it("marks the unread demo emails read with the IMAP credential stored in n8n, inside the n8n container", async () => {
    const n8n = serve([]);
    const commands: string[][] = [];
    const run: CommandRunner = async argv => { commands.push(argv); return inbox(2)(argv); };
    const lines: string[] = [];

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: dataDir({}), catalogDir: catalogDir(), container: "n8n-test", run, log: line => lines.push(line),
    });

    expect(report.failures).toEqual([]);
    expect(commands).toHaveLength(1);
    const [argv] = commands;
    expect(argv.slice(0, 2)).toEqual(["docker", "exec"]);
    expect(argv).toContain("n8n-test");
    expect(argv).toContain("N8N_RUNNERS_BROKER_PORT=5690");
    expect(argv).toContain("CRED_ID=spNovaImap000001");
    expect(argv).toContain("MAILBOX=INBOX");
    expect(lines).toContain("inbox: marked 2 unread email(s) as read in INBOX (0 unread left)");
  });

  it("reports a demo Flow n8n refuses to switch off, keeps its record, and still restores the rest", async () => {
    const n8n = serve([
      { id: "wfStuck00000001", name: "NovaDesk", active: true },
      { id: "wfDemo000000001", name: "NovaDesk 2", active: false },
    ], { refuse: { "POST unpublish wfStuck00000001": { status: 500, message: "database is locked" } } });
    const data = dataDir({ wfStuck00000001: record(DEMO_TASK), wfDemo000000001: record(DEMO_TASK) });
    const catalog = catalogDir("saved answers");
    let inboxRuns = 0;

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: data, catalogDir: catalog, container: "n8n-test",
      run: async argv => { inboxRuns++; return inbox()(argv); }, log: () => {},
    });

    expect(report.failures).toEqual([expect.stringContaining("wfStuck00000001")]);
    expect(report.failures[0]).toContain("database is locked");
    expect(n8n.workflows.get("wfStuck00000001")!.active).toBe(true);
    expect(Object.keys(storedFlows(data))).toEqual(["wfStuck00000001"]);
    expect(inboxRuns).toBe(1);
    expect(readCatalog(catalog)!.analysis.workflows[0].userCorrection).toBeNull();
  });

  it("reports a missing n8n key or an unreachable n8n, and keeps the Flow records", async () => {
    const data = dataDir({ wfDemo000000001: record(DEMO_TASK) });
    const options = { dataDir: data, catalogDir: catalogDir(), container: "n8n-test", run: inbox(), log: () => {} };

    const missing = await resetDemo({ ...options, n8n: null });
    const down = await resetDemo({ ...options, n8n: { url: "http://127.0.0.1:9", apiKey: KEY } });

    expect(missing.failures).toEqual([expect.stringContaining("N8N_API_KEY")]);
    expect(down.failures).toEqual([expect.stringContaining("cannot reach n8n at http://127.0.0.1:9")]);
    expect(Object.keys(storedFlows(data))).toEqual(["wfDemo000000001"]);
  });

  it("reports an inbox it could not reach or that still has unread demo emails", async () => {
    const n8n = serve([]);
    const options = { n8n: { url: n8n.url, apiKey: KEY }, dataDir: dataDir({}), catalogDir: catalogDir(), container: "n8n-test", log: () => {} };

    const noContainer = await resetDemo({ ...options, run: async () => ({ code: 1, stdout: "", stderr: "Error response from daemon: No such container: n8n-test\n" }) });
    const stillUnread = await resetDemo({ ...options, run: async () => ({ code: 0, stdout: '{"marked":3,"unread":1}\n', stderr: "" }) });

    expect(noContainer.failures).toEqual([expect.stringContaining("No such container: n8n-test")]);
    expect(stillUnread.failures).toEqual([expect.stringContaining("1 unread email(s) left in INBOX")]);
  });

  it("leaves an unreadable Flow store untouched and still removes the pre-imported copy", async () => {
    const n8n = serve([{ id: "spNovaFlow000001", name: "NovaDesk", active: false }]);
    const data = mkdtempSync(join(tmpdir(), "demo-reset-data-"));
    writeFileSync(join(data, "automation-flows.json"), "{ not json");

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: data, catalogDir: catalogDir(), container: "n8n-test", run: inbox(), log: () => {},
    });

    expect(report.failures).toEqual([expect.stringContaining("automation-flows.json")]);
    expect(readFileSync(join(data, "automation-flows.json"), "utf8")).toBe("{ not json");
    expect(n8n.workflows.size).toBe(0);
  });

  it("refuses a record id that is not an n8n workflow id instead of calling n8n with it", async () => {
    const n8n = serve([{ id: "wfOther00000001", name: "Not a Flow", active: true }]);
    const data = dataDir({ "../wfOther00000001": record(DEMO_TASK) });

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: data, catalogDir: catalogDir(), container: "n8n-test", run: inbox(), log: () => {},
    });

    expect(report.failures).toEqual([expect.stringContaining("not an n8n workflow id")]);
    expect(n8n.workflows.get("wfOther00000001")!.active).toBe(true);
    expect(Object.keys(storedFlows(data))).toEqual(["../wfOther00000001"]);
  });

  it("reports a missing Task Page catalog", async () => {
    const n8n = serve([]);

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: dataDir({}), catalogDir: mkdtempSync(join(tmpdir(), "demo-reset-empty-")),
      container: "n8n-test", run: inbox(), log: () => {},
    });

    expect(report.failures).toEqual([expect.stringContaining("run the demo script first")]);
  });

  it("names the other Flows still in n8n, which it never touches", async () => {
    const n8n = serve([
      { id: "spNovaFlow000001", name: "NovaDesk", active: false, tags: [{ name: "screenpipe-flow" }] },
      { id: "wfChat000000001", name: "Résumé hebdo", active: true, tags: [{ name: "screenpipe-flow" }] },
    ]);
    const lines: string[] = [];

    const report = await resetDemo({
      n8n: { url: n8n.url, apiKey: KEY }, dataDir: dataDir({}), catalogDir: catalogDir(), container: "n8n-test", run: inbox(), log: line => lines.push(line),
    });

    expect(report.failures).toEqual([]);
    expect(lines).toContain("n8n: 1 other Flow(s) left untouched: wfChat000000001 (Résumé hebdo, active)");
    expect(n8n.workflows.get("wfChat000000001")!.active).toBe(true);
  });
});

// mark-read.sh runs inside the n8n container. Here it runs locally with a fake
// `n8n` CLI on PATH and a fake `imapflow` module in place of n8n's.
const PASSWORD = "app-password-never-printed";
const FAKE_N8N = `#!/bin/sh
out=""; id=""; decrypted=""
for arg in "$@"; do
  case "$arg" in --output=*) out="\${arg#--output=}";; --id=*) id="\${arg#--id=}";; --decrypted) decrypted=1;; esac
done
if [ "$1" != "export:credentials" ] || [ "$id" != "spNovaImap000001" ] || [ -z "$decrypted" ]; then
  echo "Error exporting credentials. No credentials found with specified filters" >&2; exit 1
fi
printf '%s' '[{"id":"spNovaImap000001","type":"imap","data":{"user":"support@example.com","password":"${PASSWORD}","host":"imap.example.com"}}]' > "$out"
echo "Successfully exported 1 credential."
`;
const FAKE_IMAPFLOW = `const fs = require("fs");
const path = process.env.FAKE_IMAP_STATE;
const load = () => JSON.parse(fs.readFileSync(path, "utf8"));
class ImapFlow {
  constructor(options) { const s = load(); s.options = { ...options, auth: { user: options.auth.user, passwordMatches: options.auth.pass === "${PASSWORD}" } }; fs.writeFileSync(path, JSON.stringify(s)); }
  on() {}
  async connect() { if (load().failAuth) { const e = new Error("Command failed"); e.responseText = "[AUTHENTICATIONFAILED] Invalid credentials"; throw e; } }
  async getMailboxLock(mailbox) { const s = load(); s.mailbox = mailbox; fs.writeFileSync(path, JSON.stringify(s)); return { release() {} }; }
  async search(query) { return load().messages.filter(m => !m.seen).map(m => m.uid); }
  async messageFlagsAdd(uids, flags) { const s = load(); for (const m of s.messages) if (uids.includes(m.uid) && flags.includes("\\\\Seen")) m.seen = true; fs.writeFileSync(path, JSON.stringify(s)); }
  async logout() {}
}
module.exports = { ImapFlow };
`;

// `docker exec [-e K=V]… <container> <cmd…>` runs <cmd…> here with those variables.
const FAKE_DOCKER = `#!/bin/sh
[ "$1" = exec ] || { echo "fake docker: only exec" >&2; exit 2; }
shift
while [ "$1" = "-e" ]; do export "$2"; shift 2; done
[ "$1" = "$FAKE_CONTAINER" ] || { echo "Error response from daemon: No such container: $1" >&2; exit 1; }
shift
exec "$@"
`;

/** What the n8n container offers mark-read.sh: the n8n CLI, n8n's imapflow, a temp dir, a mailbox. */
function fakeContainer(state: object) {
  const root = mkdtempSync(join(tmpdir(), "demo-mark-read-"));
  const bin = join(root, "bin");
  const pnpm = join(root, "pnpm");
  const tmp = join(root, "tmp");
  const module = join(pnpm, "imapflow@1.15.0", "node_modules", "imapflow");
  mkdirSync(bin); mkdirSync(module, { recursive: true }); mkdirSync(tmp);
  writeFileSync(join(bin, "n8n"), FAKE_N8N, { mode: 0o755 });
  writeFileSync(join(bin, "docker"), FAKE_DOCKER, { mode: 0o755 });
  writeFileSync(join(module, "index.js"), FAKE_IMAPFLOW);
  const statePath = join(root, "imap-state.json");
  writeFileSync(statePath, JSON.stringify(state));
  return {
    env: { PATH: `${bin}:${process.env.PATH}`, TMPDIR: tmp, N8N_PNPM_DIR: pnpm, FAKE_IMAP_STATE: statePath, FAKE_CONTAINER: "n8n-test" },
    imap: () => JSON.parse(readFileSync(statePath, "utf8")),
    leftInTmp: () => readdirSync(tmp),
  };
}

async function spawn(argv: string[], env: Record<string, string>) {
  const child = Bun.spawn(argv, { env, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { code, stdout, stderr };
}

async function runMarkRead(state: object, env: Record<string, string> = {}) {
  const container = fakeContainer(state);
  const result = await spawn(["sh", join(import.meta.dir, "mark-read.sh")], {
    ...container.env, CRED_ID: "spNovaImap000001", MAILBOX: "INBOX", ...env,
  });
  return { ...result, imap: container.imap(), leftInTmp: container.leftInTmp() };
}

describe("mark-read.sh (inside the n8n container)", () => {
  it("marks every unread message read with the stored credential, defaulting to port 993 over TLS", async () => {
    const result = await runMarkRead({ messages: [{ uid: 1, seen: true }, { uid: 2, seen: false }, { uid: 3, seen: false }] });

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.trim().split("\n").at(-1)!)).toEqual({ marked: 2, unread: 0 });
    expect(result.imap.messages.every((message: { seen: boolean }) => message.seen)).toBe(true);
    expect(result.imap.mailbox).toBe("INBOX");
    expect(result.imap.options).toMatchObject({
      host: "imap.example.com", port: 993, secure: true, auth: { user: "support@example.com", passwordMatches: true }, logger: false,
    });
    expect(result.leftInTmp).toEqual([]);
    expect(result.stdout).not.toContain(PASSWORD);
  });

  it("fails with IMAP's reason, never the password, and still removes the credential", async () => {
    const result = await runMarkRead({ messages: [{ uid: 1, seen: false }], failAuth: true });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("AUTHENTICATIONFAILED");
    expect(`${result.stdout}${result.stderr}`).not.toContain(PASSWORD);
    expect(result.leftInTmp).toEqual([]);
  });

  it("fails when n8n cannot export the credential", async () => {
    const result = await runMarkRead({ messages: [] }, { CRED_ID: "spUnknown0000001" });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("cannot export the n8n credential spUnknown0000001");
    expect(result.stderr).toContain("No credentials found");
    expect(result.leftInTmp).toEqual([]);
  });
});

describe("bun infra/automation-flows/demo/reset.ts", () => {
  const cli = (env: Record<string, string>) =>
    spawn([process.execPath, join(import.meta.dir, "reset.ts")], { HOME: mkdtempSync(join(tmpdir(), "demo-reset-home-")), ...env });

  it("restores the start state and exits 0, never printing the n8n key", async () => {
    const n8n = serve([{ id: "wfDemo000000001", name: "NovaDesk", active: true, tags: [{ name: "screenpipe-flow" }] }], { strictArchive: true });
    const data = dataDir({ wfDemo000000001: record(DEMO_TASK) });
    const catalog = catalogDir("saved answers");
    const container = fakeContainer({ messages: [{ uid: 7, seen: false }] });

    const result = await cli({
      ...container.env, N8N_API_KEY: KEY, N8N_API_URL: `${n8n.url}/`, N8N_CONTAINER: "n8n-test",
      SCREENPIPE_DATA_DIR: data, SCREENPIPE_WORKFLOWS_DIR: catalog,
    });

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("wfDemo000000001 (NovaDesk): switched off, archived, deleted");
    expect(result.stdout).toContain("inbox: marked 1 unread email(s) as read in INBOX (0 unread left)");
    expect(result.stdout).toContain("Reset complete");
    expect(`${result.stdout}${result.stderr}`).not.toContain(KEY);
    expect(`${result.stdout}${result.stderr}`).not.toContain(PASSWORD);
    expect(n8n.workflows.size).toBe(0);
    expect(storedFlows(data)).toEqual({});
    expect(container.imap().messages).toEqual([{ uid: 7, seen: true }]);
    expect(readCatalog(catalog)!.analysis.workflows[0].userCorrection).toBeNull();
  });

  it("falls back to the n8n connection ScreenPipe saved in connections.json", async () => {
    const n8n = serve([{ id: "spNovaFlow000001", name: "NovaDesk", active: false }]);
    const data = dataDir({});
    writeFileSync(join(data, "connections.json"), JSON.stringify({
      n8n: { enabled: true, credentials: { api_url: `${n8n.url}/api/v1`, api_key: KEY } },
    }));
    const container = fakeContainer({ messages: [] });

    const result = await cli({ ...container.env, N8N_CONTAINER: "n8n-test", SCREENPIPE_DATA_DIR: data, SCREENPIPE_WORKFLOWS_DIR: catalogDir() });

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(n8n.workflows.size).toBe(0);
  });

  it("exits non-zero with every reason when a step cannot be restored", async () => {
    const container = fakeContainer({ messages: [] });

    const result = await cli({ ...container.env, N8N_CONTAINER: "n8n-wrong", SCREENPIPE_DATA_DIR: dataDir({}), SCREENPIPE_WORKFLOWS_DIR: catalogDir() });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Reset incomplete");
    expect(result.stderr).toContain("N8N_API_KEY");
    expect(result.stderr).toContain("No such container: n8n-wrong");
  });
});
