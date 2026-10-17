// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Validates the n8n error workflow (ticket 24, SPEC D16) from the outside: the
// JSON the Flow service installs once in n8n and attaches to every Flow
// (`settings.errorWorkflow`). n8n runs it when a Run of a Flow stops on an
// error; it hands ScreenPipe the ids of the failed Run, and ScreenPipe reads
// that Run in n8n and notifies the user.
// Run: bun test infra/automation-flows/workflows

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  notes?: string;
  retryOnFail?: boolean;
  maxTries?: number;
  credentials?: Record<string, { id: string; name: string }>;
};

const workflow = JSON.parse(
  readFileSync(join(import.meta.dir, "screenpipe-flow-errors.json"), "utf8"),
) as {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, Record<string, { node: string; type: string; index: number }[][]>>;
  settings: Record<string, unknown>;
  [key: string]: unknown;
};

const ERROR_TRIGGER = "n8n-nodes-base.errorTrigger";
const HTTP_REQUEST = "n8n-nodes-base.httpRequest";

// What n8n 2.42.2's Error Trigger emits for a failed Run of a Flow. The error
// message can quote what the failing step read: here, the email body and a
// token.
const FAILED_RUN = {
  execution: {
    id: "231",
    url: "http://localhost:5678/workflow/spNovaFlow000001/executions/231",
    retryOf: null,
    error: {
      message: "Bad request: Corps de l'email confidentiel, token sk-live-123",
      stack: "NodeApiError: …",
      node: { name: "Créer le ticket Jira" },
    },
    lastNodeExecuted: "Créer le ticket Jira",
    mode: "trigger",
  },
  workflow: { id: "spNovaFlow000001", name: "NovaDesk : emails support → tickets Jira" },
};

function onlyNode(type: string): N8nNode {
  const found = workflow.nodes.filter((n) => n.type === type);
  expect(found).toHaveLength(1);
  return found[0];
}

describe("n8n error workflow: a Failed Run of any Flow reaches ScreenPipe", () => {
  test("is not a Flow: no fixed id, no tags, never offered to n8n MCP clients", () => {
    // The Flow service creates it through the n8n API and tags it
    // `screenpipe-flow-errors`, never `screenpipe-flow`.
    expect(workflow.id).toBeUndefined();
    expect(workflow.tags).toBeUndefined();
    expect(workflow.active).toBeUndefined();
    expect(workflow.settings.availableInMCP).toBeUndefined();
    // It must never be its own error workflow.
    expect(workflow.settings.errorWorkflow).toBeUndefined();
  });

  test("starts on n8n's Error Trigger and calls ScreenPipe right after", () => {
    const trigger = onlyNode(ERROR_TRIGGER);
    const call = onlyNode(HTTP_REQUEST);
    expect(workflow.nodes).toHaveLength(2);
    expect(workflow.connections[trigger.name].main).toEqual([
      [{ node: call.name, type: "main", index: 0 }],
    ]);
  });

  test("posts to the Flow service's failed-run route with the ScreenPipe API credential", () => {
    const call = onlyNode(HTTP_REQUEST);
    expect(call.typeVersion).toBe(4.5);
    expect(call.parameters.method).toBe("POST");
    // n8n runs in Docker; ScreenPipe's local API listens on the host.
    expect(call.parameters.url).toBe("http://host.docker.internal:3030/automation-flows/failed-runs");
    expect(call.parameters.authentication).toBe("predefinedCredentialType");
    expect(call.parameters.nodeCredentialType).toBe("screenpipeApi");
    expect(call.credentials?.screenpipeApi.id).toBe("spScreenpipeApi1");
    expect(call.parameters.specifyBody).toBe("json");
    // ScreenPipe may be restarting: a few tries before giving up.
    expect(call.retryOnFail).toBe(true);
    expect(call.maxTries).toBeGreaterThanOrEqual(2);
  });

  test("sends only the ids of the failed Run, never its error message or any data", () => {
    const call = onlyNode(HTTP_REQUEST);
    const body = JSON.parse(String(evaluate(call.parameters.jsonBody, FAILED_RUN)));
    expect(body).toEqual({ executionId: "231", workflowId: "spNovaFlow000001" });
    const sent = JSON.stringify(body);
    for (const secret of ["confidentiel", "sk-live", "Bad request"]) {
      expect(sent).not.toContain(secret);
    }
  });

  test("a failure without a Run (the trigger itself) sends no execution id", () => {
    const call = onlyNode(HTTP_REQUEST);
    const triggerFailure = { trigger: { error: { message: "IMAP down" }, mode: "trigger" }, workflow: FAILED_RUN.workflow };
    const body = JSON.parse(String(evaluate(call.parameters.jsonBody, triggerFailure)));
    expect(body).toEqual({ executionId: null, workflowId: "spNovaFlow000001" });
  });

  test("every step explains itself in one sentence", () => {
    for (const node of workflow.nodes) {
      expect(typeof node.notes, node.name).toBe("string");
      expect(node.notes!.trim().length, node.name).toBeGreaterThan(10);
      expect(node.notes, node.name).not.toContain("\n");
    }
  });
});

// Only evaluates the committed fixture's own `={{ … }}` expression (plain JS).
function evaluate(value: unknown, $json: unknown): unknown {
  if (typeof value !== "string" || !value.startsWith("=")) return value;
  const whole = value.slice(1).match(/^\{\{([\s\S]*)\}\}$/);
  if (!whole) throw new Error("expected one whole expression");
  return new Function("$json", `return (${whole[1]});`)($json);
}
