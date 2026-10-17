// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Outside-in tests of the ScreenPipe n8n node: its execute entry point runs
// against a local fake ScreenPipe API.
// Run: cd packages/n8n-nodes-screenpipe && bun test

import { afterEach, describe, expect, test } from "bun:test";
import { NodeApiError } from "n8n-workflow";
import { basename, join } from "node:path";
import { ScreenPipeApi } from "../credentials/ScreenPipeApi.credentials";
import { ScreenPipe } from "../nodes/ScreenPipe/ScreenPipe.node";
import { executeContext, fakeScreenpipe } from "./harness";

const ROOT = join(import.meta.dir, "..");
const API_KEY = "sp-test-fixture-key";
let api: ReturnType<typeof fakeScreenpipe> | undefined;
afterEach(() => api?.stop());

function run(parameters: Record<string, unknown>, apiKey = API_KEY, extra: { continueOnFail?: boolean } = {}) {
  const ctx = executeContext({ parameters, credentials: { baseUrl: api!.baseUrl, apiKey }, ...extra });
  return new ScreenPipe().execute.call(ctx);
}

const JIRA_HIT = {
  type: "UI",
  content: {
    frame_id: 4242,
    text: "Créer un ticket · Projet NOVA · Type Bug · Résumé NovaCRM - Export CSV des contacts filtres vide",
    timestamp: "2026-10-17T02:05:12Z",
    app_name: "Google Chrome",
    window_name: "Créer un ticket - Jira",
    browser_url: "https://kylianaubry.atlassian.net/jira/software/projects/NOVA",
  },
};

describe("what n8n loads", () => {
  // n8n's loaders do `require(file)[<file name without .node.js/.credentials.js>]`.
  test("every node and credential listed in package.json exports a class named after its file", async () => {
    const pkg = await Bun.file(join(ROOT, "package.json")).json();
    const entries: string[] = [...pkg.n8n.nodes, ...pkg.n8n.credentials];
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      const source = join(ROOT, entry.replace(/^dist\//, "").replace(/\.js$/, ".ts"));
      const className = basename(entry).replace(/\.(node|credentials)\.js$/, "");
      const mod = await import(source);
      expect(typeof mod[className], `${entry} exports ${className}`).toBe("function");
    }
  });

  test("the ScreenPipe node is offered as an AI Agent tool and uses the ScreenPipe API credential", () => {
    const node = new ScreenPipe().description;
    const credential = new ScreenPipeApi();
    expect(node.usableAsTool).toBe(true);
    expect(node.credentials).toEqual([{ name: credential.name, required: true }]);
    expect(credential.displayName).toBe("ScreenPipe API");
    const field = (name: string) => credential.properties.find((p) => p.name === name)!;
    expect(field("baseUrl").default).toBe("http://host.docker.internal:3030");
    expect(field("apiKey").typeOptions?.password).toBe(true);
    expect(field("apiKey").default).toBe("");
  });
});

describe("ScreenPipe node: search content", () => {
  test("queries GET /search with the user's filters and the API key, and returns one item per capture", async () => {
    api = fakeScreenpipe({ "/search": { body: { data: [JIRA_HIT], pagination: { limit: 5, offset: 0, total: 1 } } } });

    const [output] = await run({
      operation: "searchContent",
      query: "NovaCRM export",
      contentType: "accessibility",
      limit: 5,
      filters: { appName: "Google Chrome", windowName: "Jira", startTime: "2026-10-17T00:00:00Z", endTime: "now" },
    });

    expect(api.requests).toHaveLength(1);
    const [request] = api.requests;
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/search");
    expect(request.authorization).toBe(`Bearer ${API_KEY}`);
    expect(request.query).toEqual({
      q: "NovaCRM export",
      content_type: "accessibility",
      limit: "5",
      app_name: "Google Chrome",
      window_name: "Jira",
      start_time: "2026-10-17T00:00:00Z",
      end_time: "now",
    });

    expect(output.map((item) => item.json)).toEqual([
      {
        type: "UI",
        timestamp: "2026-10-17T02:05:12Z",
        app: "Google Chrome",
        window: "Créer un ticket - Jira",
        url: "https://kylianaubry.atlassian.net/jira/software/projects/NOVA",
        frameId: 4242,
        text: JIRA_HIT.content.text,
      },
    ]);
  });

  test("sends no Authorization header when the credential has no API key (ScreenPipe auth off)", async () => {
    api = fakeScreenpipe({ "/search": { body: { data: [], pagination: {} } } });

    const [output] = await run({ operation: "searchContent", query: "NovaCRM" }, "");

    expect(api.requests[0].authorization).toBeNull();
    expect(output).toEqual([]);
  });

  test("cuts long capture text to the max text length (1000 by default) and says how much was cut", async () => {
    const long = "Résumé du ticket. ".repeat(400); // 7200 chars
    const audio = { type: "Audio", content: { chunk_id: 7, transcription: long, timestamp: "2026-10-17T02:06:00Z" } };
    api = fakeScreenpipe({ "/search": { body: { data: [JIRA_HIT, audio], pagination: {} } } });

    const [byDefault] = await run({ operation: "searchContent", query: "ticket" });
    const [capped] = await run({ operation: "searchContent", query: "ticket", maxTextLength: 200 });

    expect(byDefault[0].json.text).toBe(JIRA_HIT.content.text); // short text untouched
    const defaultText = String(byDefault[1].json.text);
    expect(defaultText.startsWith(long.slice(0, 1000))).toBe(true);
    expect(defaultText).toContain("[6200 more characters]");
    expect(defaultText.length).toBeLessThan(1100);

    const cappedText = String(capped[1].json.text);
    expect(cappedText.startsWith(long.slice(0, 200))).toBe(true);
    expect(cappedText).toContain("[7000 more characters]");
    expect(cappedText.length).toBeLessThan(300);
  });
});

describe("ScreenPipe node: activity summary", () => {
  test("queries GET /activity-summary for the time range and returns the summary with long texts cut", async () => {
    const summary = {
      time_range: { start: "2026-10-17T02:00:00Z", end: "2026-10-17T03:00:00Z" },
      total_active_minutes: 42,
      apps: [{ name: "Google Chrome", minutes: 30 }],
      key_texts: [{ app_name: "Google Chrome", window_name: "Jira", text: "x".repeat(900) }],
    };
    api = fakeScreenpipe({ "/activity-summary": { body: summary } });

    const [output] = await run({
      operation: "activitySummary",
      startTime: "1h ago",
      endTime: "now",
      summaryFilters: { appName: "Google Chrome", query: "NOVA" },
      maxTextLength: 100,
    });

    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({
      method: "GET",
      path: "/activity-summary",
      authorization: `Bearer ${API_KEY}`,
      query: { start_time: "1h ago", end_time: "now", app_name: "Google Chrome", q: "NOVA" },
    });

    expect(output).toHaveLength(1);
    const json = output[0].json as any;
    expect(json.total_active_minutes).toBe(42);
    expect(json.apps).toEqual(summary.apps);
    expect(json.key_texts[0].window_name).toBe("Jira");
    expect(json.key_texts[0].text).toBe(`${"x".repeat(100)}… [800 more characters]`);
  });
});

describe("ScreenPipe node: errors", () => {
  test("an HTTP error from ScreenPipe fails the node with the status and ScreenPipe's message", async () => {
    api = fakeScreenpipe({ "/search": { status: 403, body: { error: "invalid or missing api key" } } });

    const error = await run({ operation: "searchContent", query: "NovaCRM" }, "wrong-key").catch((e) => e);

    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.httpCode).toBe("403");
    expect(`${error.message} ${error.description}`).toContain("invalid or missing api key");
  });

  test("with 'On Error: Continue', the error comes back as an item so an AI Agent can carry on", async () => {
    api = fakeScreenpipe({ "/search": { status: 500, body: { error: "database is locked" } } });

    const [output] = await run({ operation: "searchContent", query: "NovaCRM" }, API_KEY, { continueOnFail: true });

    expect(output).toHaveLength(1);
    expect(String(output[0].json.error)).toContain("HTTP 500");
    expect(String(output[0].json.error)).toContain("database is locked");
  });

  test("when ScreenPipe is not running, the node fails and names the URL it tried", async () => {
    api = fakeScreenpipe({});
    api.stop();

    const error = await run({ operation: "searchContent", query: "NovaCRM" }).catch((e) => e);

    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toContain(api.baseUrl);
  });
});
