// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_FLOW } from "./__fixtures__/example-flow";
import { findAutomationFlow, localFileFlowSource, LOCAL_FLOWS_URL, parseAutomationFlows } from "./source";

describe("automation flow source", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps well-formed Flows, fills optional parts and drops the rest", () => {
    const minimal = { id: "min", title: "Minimal", summary: "Does it.", questions: [], rules: [{ group: "g", when: "w", then: "t" }] };
    const flows = parseAutomationFlows([EXAMPLE_FLOW, minimal, { id: "broken" }, "nope"]);
    expect(flows.map((flow) => flow.id)).toEqual(["example-flow", "min"]);
    expect(flows[1]).toMatchObject({ checks: [], steps: [], ruleGroups: [{ id: "g", title: "g" }], n8n: { workflowId: null } });
    expect(parseAutomationFlows({ not: "an array" })).toEqual([]);
  });

  it("reads the local file, and shows no Flows when it is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [EXAMPLE_FLOW] });
    vi.stubGlobal("fetch", fetchMock);
    await expect(localFileFlowSource.load()).resolves.toEqual([EXAMPLE_FLOW]);
    expect(fetchMock).toHaveBeenCalledWith(LOCAL_FLOWS_URL, { cache: "no-store" });

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(localFileFlowSource.load()).resolves.toEqual([]);

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(localFileFlowSource.load()).resolves.toEqual([]);
  });

  it("finds a Flow by id", () => {
    expect(findAutomationFlow([EXAMPLE_FLOW], "example-flow")).toBe(EXAMPLE_FLOW);
    expect(findAutomationFlow([EXAMPLE_FLOW], "other")).toBeUndefined();
    expect(findAutomationFlow([EXAMPLE_FLOW], null)).toBeUndefined();
  });
});
