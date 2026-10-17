// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Validates the demo n8n workflow (ticket 01) from the outside: the JSON that
// gets imported into n8n and bundled as the Flow fixture.
// Run: bun test infra/automation-flows/workflows

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW_PATH = join(import.meta.dir, "novadesk-support-tickets.json");
const REVIEW_PATH = join(import.meta.dir, "novadesk-support-tickets.review.json");

type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  notes?: string;
  credentials?: Record<string, { id: string; name: string }>;
};

const raw = readFileSync(WORKFLOW_PATH, "utf8");
const workflow = JSON.parse(raw) as {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, Record<string, { node: string; type: string; index: number }[][]>>;
  settings: Record<string, unknown>;
  tags: { name: string }[];
};

const STICKY = "n8n-nodes-base.stickyNote";
const steps = workflow.nodes.filter((n) => n.type !== STICKY);

function onlyNode(type: string): N8nNode {
  const found = workflow.nodes.filter((n) => n.type === type);
  expect(found).toHaveLength(1);
  return found[0];
}

describe("demo n8n workflow: NovaDesk support emails become Jira tickets", () => {
  test("every step explains itself in exactly one sentence", () => {
    expect(steps.length).toBeGreaterThan(0);
    for (const node of steps) {
      expect(typeof node.notes, node.name).toBe("string");
      const notes = node.notes!.trim();
      expect(notes.length, node.name).toBeGreaterThan(10);
      // One sentence: one line, ends with a terminal mark, and no terminal
      // mark followed by more words (dots inside an address are fine).
      expect(notes, node.name).not.toContain("\n");
      expect(notes, node.name).toMatch(/[.!?]$/);
      expect(notes, node.name).not.toMatch(/[.!?]\s+\S/);
    }
  });

  test("reads unread emails of the support inbox and marks them read", () => {
    const trigger = onlyNode("n8n-nodes-base.emailReadImap");
    expect(trigger.parameters.postProcessAction).toBe("read");
    expect(JSON.parse(trigger.parameters.options.customEmailConfig)).toEqual(["UNSEEN"]);
    expect(trigger.parameters.format).toBe("simple");
    expect(trigger.credentials?.imap.id).toBe("spNovaImap000001");
  });

  test("one AI Agent judges each email, through ScreenPipe's local AI proxy, into a fixed answer shape", () => {
    const trigger = onlyNode("n8n-nodes-base.emailReadImap");
    const agent = onlyNode("@n8n/n8n-nodes-langchain.agent");
    expect(next(trigger.name)).toEqual([agent.name]);
    expect(agent.parameters.promptType).toBe("define");
    for (const field of ["from", "subject", "textPlain"]) {
      expect(agent.parameters.text).toContain(`$json.${field}`);
    }
    expect(agent.parameters.hasOutputParser).toBe(true);

    const model = onlyNode("@n8n/n8n-nodes-langchain.lmChatOpenAi");
    expect(subNodeOf(model.name, "ai_languageModel")).toBe(agent.name);
    expect(model.credentials?.openAiApi.id).toBe("spProxyOpenAI001");
    // The proxy only speaks /v1/chat/completions and has no /v1/models.
    expect(model.parameters.responsesApiEnabled).toBe(false);
    expect(model.parameters.model).toMatchObject({ mode: "id", value: "auto" });

    const parser = onlyNode("@n8n/n8n-nodes-langchain.outputParserStructured");
    expect(subNodeOf(parser.name, "ai_outputParser")).toBe(agent.name);
    expect(parser.parameters.schemaType).toBe("manual");
    const schema = JSON.parse(parser.parameters.inputSchema);
    expect(Object.keys(schema.properties).sort()).toEqual(
      ["label", "priority", "product", "summary", "type"],
    );
    expect(schema.required.sort()).toEqual(["label", "priority", "product", "summary", "type"]);
    expect(schema.properties.type.enum).toEqual(["Bug", "Tâche", "none"]);
    expect(schema.properties.label.enum).toEqual(["back", "front"]);
    expect(schema.properties.priority.enum).toEqual(["Highest", "High", "Medium", "Low", "Lowest"]);
  });

  test("stops without a ticket when the AI answers none", () => {
    const agent = onlyNode("@n8n/n8n-nodes-langchain.agent");
    const gate = onlyNode("n8n-nodes-base.if");
    expect(next(agent.name)).toEqual([gate.name]);

    const passes = (type: string) => evaluateIf(gate, { $json: { output: aiAnswer({ type }) } });
    expect(passes("none")).toBe(false);
    expect(passes("Bug")).toBe(true);
    expect(passes("Tâche")).toBe(true);
    expect(next(gate.name, 0)).toHaveLength(1);
    expect(next(gate.name, 1)).toEqual([]);
  });

  test("creates one unassigned NOVA issue titled '<product> - <summary>' that quotes the email", () => {
    const issue = jiraRequestFor(aiAnswer());
    expect(issue.fields.project).toEqual({ key: "NOVA" });
    expect(issue.fields.issuetype).toEqual({ name: "Bug" });
    expect(issue.fields.summary).toBe("NovaCRM - Export CSV des contacts filtrés vide");
    expect(issue.fields.priority).toEqual({ name: "Highest" });
    expect(issue.fields.labels).toEqual(["back"]);
    expect(issue.fields.description).toContain(EMAIL.from);
    expect(issue.fields.description).toContain(EMAIL.subject);
    expect(issue.fields.description).toContain(`{quote}\n${EMAIL.textPlain}\n{quote}`);
    expect(issue.fields).not.toHaveProperty("assignee");
  });

  test("an improvement idea becomes a Tâche with the AI's priority and label", () => {
    const issue = jiraRequestFor(
      aiAnswer({ type: "Tâche", summary: "Filtre Dernière relance", priority: "Low", label: "front" }),
    );
    expect(issue.fields.issuetype).toEqual({ name: "Tâche" });
    expect(issue.fields.summary).toBe("NovaCRM - Filtre Dernière relance");
    expect(issue.fields.priority).toEqual({ name: "Low" });
    expect(issue.fields.labels).toEqual(["front"]);
  });

  test("calls the Jira Cloud REST API with the stored Jira credential", () => {
    const create = onlyNode("n8n-nodes-base.httpRequest");
    expect(create.parameters.method).toBe("POST");
    expect(create.parameters.url).toBe("https://kylianaubry.atlassian.net/rest/api/2/issue");
    expect(create.parameters.authentication).toBe("predefinedCredentialType");
    expect(create.parameters.nodeCredentialType).toBe("jiraSoftwareCloudApi");
    expect(create.credentials?.jiraSoftwareCloudApi.id).toBe("spNovaJira000001");
    expect(next(create.name)).toEqual([]);
  });

  test("uses only node types and versions verified on the local n8n 2.42.2", () => {
    const verified: Record<string, number> = {
      "n8n-nodes-base.emailReadImap": 2.2,
      "@n8n/n8n-nodes-langchain.agent": 3.1,
      "@n8n/n8n-nodes-langchain.lmChatOpenAi": 1.3,
      "@n8n/n8n-nodes-langchain.outputParserStructured": 1.3,
      "n8n-nodes-base.if": 2.3,
      "n8n-nodes-base.set": 3.5,
      "n8n-nodes-base.httpRequest": 4.5,
      "n8n-nodes-base.stickyNote": 1,
    };
    for (const node of workflow.nodes) {
      expect(verified[node.type], `${node.name}: ${node.type}`).toBe(node.typeVersion);
    }
  });

  test("is an Automation Flow: fixed id, switched off, tagged, visible to n8n MCP", () => {
    expect(workflow.id).toBe("spNovaFlow000001");
    expect(workflow.active).toBe(false);
    expect(workflow.tags.map((t) => t.name)).toContain("screenpipe-flow");
    expect(workflow.settings.availableInMCP).toBe(true);
    expect(workflow.settings.executionOrder).toBe("v1");
    const ids = workflow.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = workflow.nodes.map((n) => n.name);
    for (const [from, outputs] of Object.entries(workflow.connections)) {
      expect(names, `connection source ${from}`).toContain(from);
      for (const target of Object.values(outputs).flat(2)) {
        expect(names, `connection target from ${from}`).toContain(target.node);
      }
    }
  });

  test("ships a plain-language summary for the Review Screen", () => {
    const review = JSON.parse(readFileSync(REVIEW_PATH, "utf8"));
    expect(review.workflowId).toBe(workflow.id);
    expect(review.sourceTaskId).toBe("wf-novadesk-support-tickets");
    expect(typeof review.summary).toBe("string");
    for (const word of ["email", "IA", "Jira", "NOVA"]) {
      expect(review.summary).toContain(word);
    }
    expect(review.summary.length).toBeLessThan(1200);
  });

  test("contains no secrets, only credential references", () => {
    for (const node of workflow.nodes) {
      for (const ref of Object.values(node.credentials ?? {})) {
        expect(Object.keys(ref).sort(), node.name).toEqual(["id", "name"]);
      }
    }
    const secretKeys = /^(api[_-]?key|api[_-]?token|access[_-]?token|password|secret|token|authorization)$/i;
    for (const path of [WORKFLOW_PATH, REVIEW_PATH]) {
      const text = readFileSync(path, "utf8");
      walk(JSON.parse(text), (key, value) => {
        if (secretKeys.test(key)) expect(value, `${path}: ${key}`).toBe("");
      });
      expect(text).not.toMatch(/ATATT[0-9A-Za-z_=-]{10,}/); // Atlassian API token
      expect(text).not.toMatch(/\bsk-[0-9A-Za-z_-]{16,}/); // OpenAI-style key
      expect(text).not.toMatch(/\beyJ[0-9A-Za-z_-]{10,}\./); // JWT
      expect(text).not.toMatch(/Bearer\s+[0-9A-Za-z._-]{10,}/);
      expect(text).not.toMatch(/\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b/); // Gmail app password
    }
  });
});

function walk(value: unknown, visit: (key: string, value: unknown) => void) {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      visit(k, v);
      walk(v, visit);
    }
  }
}

/**
 * Follows the graph from the "ticket needed" branch to the Jira request and
 * returns the JSON body n8n would send for this AI answer and EMAIL.
 */
function jiraRequestFor(answer: ReturnType<typeof aiAnswer>) {
  const trigger = onlyNode("n8n-nodes-base.emailReadImap");
  const gate = onlyNode("n8n-nodes-base.if");
  const nodes = { [trigger.name]: EMAIL };

  let item: any = { output: answer };
  let current = next(gate.name, 0);
  let request: N8nNode | undefined;
  while (current.length === 1) {
    const node = workflow.nodes.find((n) => n.name === current[0])!;
    if (node.type === "n8n-nodes-base.set") {
      expect(node.parameters.includeOtherFields ?? false).toBe(false);
      const out: Record<string, unknown> = {};
      for (const a of node.parameters.assignments.assignments) {
        out[a.name] = evaluate(a.value, { $json: item, nodes });
      }
      item = out;
    } else if (node.type === "n8n-nodes-base.httpRequest") {
      request = node;
      break;
    } else {
      throw new Error(`unexpected step before the Jira request: ${node.type}`);
    }
    current = next(node.name);
  }
  expect(request).toBeDefined();
  expect(request!.parameters.sendBody).toBe(true);
  expect(request!.parameters.specifyBody).toBe("json");
  const body = evaluate(request!.parameters.jsonBody, { $json: item, nodes });
  return (typeof body === "string" ? JSON.parse(body) : body) as { fields: Record<string, any> };
}

// --- Synthetic data (shapes of the IMAP "simple" item and the AI answer) ---

const EMAIL = {
  from: "Arthur Test <arthur@example.com>",
  subject: "Export des contacts vide dans NovaCRM",
  date: "2026-10-17T04:04:00.000Z",
  textPlain: "Bonjour,\nL'export CSV des contacts filtrés ne contient que les en-têtes.\nMerci",
  textHtml: "<p>Bonjour</p>",
};

function aiAnswer(overrides: Record<string, string> = {}) {
  return {
    type: "Bug",
    product: "NovaCRM",
    summary: "Export CSV des contacts filtrés vide",
    priority: "Highest",
    label: "back",
    ...overrides,
  };
}

// --- Minimal n8n expression evaluation (plain JS inside {{ }}) ---
// Only evaluates expressions from the committed fixture above, never external
// input. Keep the fixture's expressions plain JS so this stays faithful to n8n.

type Ctx = { $json: any; nodes?: Record<string, any> };

function evaluate(value: unknown, ctx: Ctx): unknown {
  if (typeof value !== "string" || !value.startsWith("=")) return value;
  const template = value.slice(1);
  const $ = (name: string) => {
    const json = ctx.nodes?.[name];
    if (json === undefined) throw new Error(`expression references unknown node "${name}"`);
    return { item: { json }, first: () => ({ json }) };
  };
  const run = (code: string) => new Function("$json", "$", `return (${code});`)(ctx.$json, $);
  const whole = template.match(/^\{\{([\s\S]*)\}\}$/);
  if (whole && !whole[1].includes("{{")) return run(whole[1]);
  return template.replace(/\{\{([\s\S]*?)\}\}/g, (_, code) => String(run(code)));
}

function evaluateIf(node: N8nNode, ctx: Ctx): boolean {
  const { conditions, combinator } = node.parameters.conditions;
  const results = conditions.map((c: any) => {
    const left = evaluate(c.leftValue, ctx);
    const right = evaluate(c.rightValue, ctx);
    const op = `${c.operator.type}:${c.operator.operation}`;
    if (op === "string:equals") return left === right;
    if (op === "string:notEquals") return left !== right;
    throw new Error(`operator not supported by this test: ${op}`);
  });
  return combinator === "or" ? results.some(Boolean) : results.every(Boolean);
}

/** Names of the nodes fed by `from` on its main output `output`. */
function next(from: string, output = 0): string[] {
  return (workflow.connections[from]?.main?.[output] ?? []).map((c) => c.node);
}

/** The node a sub-node (model, parser, tool) is plugged into. */
function subNodeOf(from: string, type: string): string | undefined {
  const targets = workflow.connections[from]?.[type]?.[0] ?? [];
  expect(targets).toHaveLength(1);
  return targets[0].node;
}
