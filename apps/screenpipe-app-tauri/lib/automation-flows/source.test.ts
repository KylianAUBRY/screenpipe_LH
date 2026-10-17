// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_FLOW } from "./__fixtures__/example-flow";
import { findAutomationFlow, localFileFlowSource, LOCAL_FLOWS_URL, parseAutomationFlows } from "./source";

describe("automation flow source", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps well-formed Flows, fills optional parts and drops the rest", () => {
    const minimal = { id: "min", title: "Minimal", summary: "Does it.", questions: [] };
    const flows = parseAutomationFlows([EXAMPLE_FLOW, minimal, { id: "broken" }, "nope"]);
    expect(flows.map((flow) => flow.id)).toEqual(["example-flow", "min"]);
    expect(flows[1]).toMatchObject({ checks: [], steps: [], evidence: [], n8n: { workflowId: null } });
    expect(parseAutomationFlows({ not: "an array" })).toEqual([]);
  });

  it("keeps only well-formed repetitions", () => {
    const [flow] = parseAutomationFlows([
      {
        ...EXAMPLE_FLOW,
        evidence: [
          { at: "2026-10-14T09:12:00Z", label: "ok", frameId: 42 },
          { at: "not a date", label: "bad date" },
          { at: "2026-10-14T10:00:00Z", label: "bad frame", frameId: "42" },
          { label: "no date" },
        ],
      },
    ]);
    expect(flow.evidence).toEqual([{ at: "2026-10-14T09:12:00Z", label: "ok", frameId: 42 }]);
  });

  it("reads the local file, and shows no Flows when it is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [EXAMPLE_FLOW] });
    vi.stubGlobal("fetch", fetchMock);
    await expect(localFileFlowSource.load()).resolves.toEqual([{ ...EXAMPLE_FLOW, evidence: [] }]);
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
