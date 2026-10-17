// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
});
