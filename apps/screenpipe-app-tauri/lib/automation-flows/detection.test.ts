// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_HANDOFF } from "./__fixtures__/example-handoff";
import { detectedHandoff, saveDetectedFlow, withDetectedFlows } from "./detected";
import { DETECTOR_PIPE, findAutomation, handoffToFlow, parseHandoff, type DetectionDeps } from "./detection";
import { automationFlowLink, buildFlowProposalNotification } from "./notification";
import { parseAutomationFlows } from "./source";
import { EXAMPLE_FLOW } from "./__fixtures__/example-flow";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function deps(statuses: unknown[], handoff: unknown = EXAMPLE_HANDOFF, now = Date.parse(EXAMPLE_HANDOFF.generatedAt) - 1_000) {
  const calls: string[] = [];
  const queue = [...statuses];
  const d: DetectionDeps = {
    fetch: vi.fn(async (path: string) => {
      calls.push(path);
      if (path.endsWith("/install")) return ok({ success: true });
      if (path.endsWith("/run")) return ok({ success: true, execution_id: 7 });
      return ok({ data: queue.shift() });
    }),
    readText: vi.fn(async () => JSON.stringify(handoff)),
    dataDir: async () => "/home/ada/.screenpipe/",
    sleep: async () => {},
    now: () => now,
  };
  return { d, calls };
}

describe("detected automation flows", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("turns a detector handoff into a Flow the review screen and notification accept", () => {
    const flow = handoffToFlow(EXAMPLE_HANDOFF);
    expect(flow).toMatchObject({
      id: "detected-mail-tracker",
      title: "Create a Tracker ticket for each email in Mail",
      summary: "When an email reaches desk@example.com, create a Tracker ticket in project ACME from it.",
      unit: "emails",
      n8n: { workflowId: null },
    });
    expect(flow.checks[0]).toBe("4 times in 2 sessions (3 starred)");
    expect(flow.checks).toContain("Email text reused in 2 of 3 tickets");
    expect(flow.questions).toHaveLength(3);
    for (const question of flow.questions) expect(question.choices.length).toBeGreaterThanOrEqual(2);
    // The quoted reply in example 3 is the one time the user asked the sender for details.
    expect(flow.questions[1].context).toBe("Once, you asked the sender for details before creating the ticket.");

    expect(parseAutomationFlows([flow])).toEqual([flow]);
    const notification = buildFlowProposalNotification(flow, flow.questions.length, 1);
    expect(notification.title).toBe("New automation: create a tracker ticket for each email in mail");
    expect(automationFlowLink(notification.actions[0].url)).toEqual({ flowId: flow.id });
  });

  it("rejects anything that is not a detector handoff", () => {
    expect(parseHandoff({ schema: "other" })).toBeNull();
    expect(parseHandoff(null)).toBeNull();
    expect(parseHandoff(EXAMPLE_HANDOFF)).toBe(EXAMPLE_HANDOFF);
  });

  it("runs the detector Pipe, waits for it and reads its handoff", async () => {
    const { d, calls } = deps([{ status: "running" }, { status: "completed" }]);
    const found = await findAutomation(d);
    expect(found?.flow.id).toBe("detected-mail-tracker");
    expect(found?.handoff).toEqual(EXAMPLE_HANDOFF);
    expect(calls).toEqual([
      `/pipes/bundled/${DETECTOR_PIPE}/install`,
      `/pipes/${DETECTOR_PIPE}/run`,
      `/pipes/${DETECTOR_PIPE}/executions/7`,
      `/pipes/${DETECTOR_PIPE}/executions/7`,
    ]);
    expect(d.readText).toHaveBeenCalledWith(`/home/ada/.screenpipe/pipes/${DETECTOR_PIPE}/output/handoff.json`);
  });

  it("reports nothing found when the handoff is from an earlier run", async () => {
    const { d } = deps([{ status: "completed" }], EXAMPLE_HANDOFF, Date.parse(EXAMPLE_HANDOFF.generatedAt) + 60_000);
    await expect(findAutomation(d)).resolves.toBeNull();
  });

  it("surfaces the Pipe's own error when the run fails", async () => {
    const { d } = deps([{ status: "failed", error_message: "recorder unreachable" }]);
    await expect(findAutomation(d)).rejects.toThrow("The detector failed: recorder unreachable");
  });

  it("lists detected Flows first and keeps their handoff for the n8n builder", async () => {
    const flow = handoffToFlow(EXAMPLE_HANDOFF);
    saveDetectedFlow({ flow, handoff: EXAMPLE_HANDOFF });
    saveDetectedFlow({ flow, handoff: EXAMPLE_HANDOFF });
    const source = withDetectedFlows({ load: async () => [EXAMPLE_FLOW, flow] });
    await expect(source.load()).resolves.toEqual([flow, EXAMPLE_FLOW]);
    expect(detectedHandoff(flow.id)).toEqual(EXAMPLE_HANDOFF);
    expect(detectedHandoff("unknown")).toBeNull();
  });
});
