// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  localFetch: vi.fn(),
  emit: vi.fn(async () => {}),
  showWindowActivated: vi.fn(async (_window: unknown) => ({ status: "ok" as const, data: null })),
}));
vi.mock("@/lib/api", () => ({ localFetch: mocks.localFetch }));
vi.mock("@tauri-apps/api/event", () => ({ emit: mocks.emit }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/lib/utils/tauri", () => ({ commands: { showWindowActivated: mocks.showWindowActivated } }));

import { readFileSync } from "node:fs";
import path from "node:path";
import { canCreateAutomationFlow, createAutomationFlow, flowReviewLink, openFlowReviewLink } from "./automation-flows";
import { DEMO_TASK_ID, fixtureFlow } from "@/components/automation-flows/fixtures";
import { mockAutomationFlowsResponse } from "@/components/automation-flows/mock";

const answers = [{ question: "Les idées deviennent-elles des tickets ?", answer: "Oui, en Tâche." }];
const reviewUrl = `/home?section=pipes&tab=flows&flow=${fixtureFlow.id}`;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", `/home?mode=workflows&workflow=${DEMO_TASK_ID}`);
  // The Flow service as the browser mock (`bun run dev:web`) answers it.
  mocks.localFetch.mockImplementation(async (path: string, init?: RequestInit) =>
    mockAutomationFlowsResponse(new URL(path, "http://localhost:3030"), init)!);
});

describe("desktop createAutomationFlow", () => {
  it("creates the Flow from the task through the Flow service, then opens its Review Screen", async () => {
    await createAutomationFlow(DEMO_TASK_ID, answers);

    expect(mocks.localFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mocks.localFetch.mock.calls[0];
    expect(path).toBe("/automation-flows/from-task");
    expect(JSON.parse(init.body)).toEqual({ taskId: DEMO_TASK_ID, answers });
    expect(`${window.location.pathname}${window.location.search}`).toBe(reviewUrl);
    expect(mocks.emit).toHaveBeenCalledWith("navigate", { url: reviewUrl });
  });

  it("switches an Automations view that is already open to the Flow's Review Screen", async () => {
    const switched = vi.fn();
    const listen = (event: Event) => switched((event as CustomEvent).detail);
    window.addEventListener("switch-pipes-tab", listen);
    try {
      await createAutomationFlow(DEMO_TASK_ID, answers);
    } finally {
      window.removeEventListener("switch-pipes-tab", listen);
    }
    expect(switched).toHaveBeenCalledWith({ tab: "flows", flow: fixtureFlow.id });
  });

  it("opens the same Flow when the action is clicked again", async () => {
    await createAutomationFlow(DEMO_TASK_ID, answers);
    await createAutomationFlow(DEMO_TASK_ID, answers);
    expect(mocks.emit.mock.calls).toEqual([["navigate", { url: reviewUrl }], ["navigate", { url: reviewUrl }]]);
  });

  it.each([
    ["not-configured", /n8n n'est pas configuré.*Connexions/],
    ["unauthorized", /n8n a refusé la clé API.*Connexions → n8n/],
    ["unreachable", /Impossible de joindre n8n/],
  ])("explains a %s Flow service and stays on the Task Page", async (state, message) => {
    window.history.replaceState({}, "", `/home?mode=workflows&flowsState=${state}`);
    await expect(createAutomationFlow(DEMO_TASK_ID, answers)).rejects.toThrow(message);
    expect(window.location.search).toBe(`?mode=workflows&flowsState=${state}`);
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("explains a task that cannot become a Flow yet", async () => {
    await expect(createAutomationFlow("wf-other-task", answers)).rejects.toThrow("Cette tâche ne peut pas encore devenir une automatisation.");
    expect(mocks.emit).not.toHaveBeenCalled();
  });
});

describe("desktop canCreateAutomationFlow", () => {
  it("offers creation only for the tasks the Flow service can create", () => {
    expect(canCreateAutomationFlow(DEMO_TASK_ID)).toBe(true);
    expect(canCreateAutomationFlow("wf-other-task")).toBe(false);
  });

  it("matches the Detected Tasks the engine's Flow service bundles", () => {
    // `create_from_task` answers 404 for any task missing from DEMO_TASKS.
    const engine = readFileSync(path.resolve(__dirname, "../../../../crates/screenpipe-engine/src/automation_flows.rs"), "utf8");
    const start = engine.indexOf("const DEMO_TASKS");
    const ids = [...engine.slice(start, engine.indexOf("];", start)).matchAll(/\bid:\s*"([^"]+)"/g)].map(match => match[1]);
    expect(ids).toEqual([DEMO_TASK_ID]);
    for (const id of ids) expect(canCreateAutomationFlow(id)).toBe(true);
  });
});

describe("Review Screen link from the chat", () => {
  const link = flowReviewLink(fixtureFlow.id);

  it("opens the Flow's Review Screen from the Home chat", async () => {
    window.history.replaceState({}, "", "/home?section=home");

    expect(await openFlowReviewLink(link)).toBe(true);

    expect(link).toBe(`screenpipe://flows/${fixtureFlow.id}`);
    expect(`${window.location.pathname}${window.location.search}`).toBe(reviewUrl);
    expect(mocks.emit).toHaveBeenCalledWith("navigate", { url: reviewUrl });
    expect(mocks.localFetch).not.toHaveBeenCalled();
  });

  it("brings Home to the Review Screen from another chat window", async () => {
    window.history.replaceState({}, "", "/chat");

    expect(await openFlowReviewLink(link)).toBe(true);

    expect(window.location.pathname).toBe("/chat");
    expect(mocks.showWindowActivated).toHaveBeenCalledWith({
      Home: { page: `pipes&tab=flows&flow=${fixtureFlow.id}` },
    });
  });

  it.each(["screenpipe://flows/", "screenpipe://frame/12", "https://example.com/flows/x"])(
    "leaves %s to other handlers",
    async (href) => {
      expect(await openFlowReviewLink(href)).toBe(false);
      expect(mocks.emit).not.toHaveBeenCalled();
      expect(mocks.showWindowActivated).not.toHaveBeenCalled();
    },
  );
});
