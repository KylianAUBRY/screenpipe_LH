// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import type { AutomationFlow, FlowEvidence } from "./types";

/** Where the Flow tab gets its proposed Flows from. */
export interface FlowSource {
  load(): Promise<AutomationFlow[]>;
}

/**
 * Local file read by the default source. It is git-ignored so each person can
 * keep their own demo data: put an array of AutomationFlow objects in
 * `apps/screenpipe-app-tauri/public/automation-flows.local.json`.
 */
export const LOCAL_FLOWS_URL = "/automation-flows.local.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvidence(value: unknown): value is FlowEvidence {
  return (
    isRecord(value) &&
    typeof value.at === "string" &&
    !Number.isNaN(Date.parse(value.at)) &&
    typeof value.label === "string" &&
    (value.frameId === undefined || Number.isInteger(value.frameId)) &&
    (value.imageUrl === undefined || typeof value.imageUrl === "string") &&
    (value.app === undefined || typeof value.app === "string")
  );
}

/** Keeps well-formed Flows and fills the optional parts; drops anything else. */
export function parseAutomationFlows(value: unknown): AutomationFlow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AutomationFlow[] => {
    if (!isRecord(item)) return [];
    const { id, title, summary, questions } = item;
    if (typeof id !== "string" || typeof title !== "string" || typeof summary !== "string") return [];
    if (!Array.isArray(questions)) return [];
    return [
      {
        id,
        title,
        summary,
        learnedFrom: typeof item.learnedFrom === "string" ? item.learnedFrom : "",
        checks: Array.isArray(item.checks) ? (item.checks as string[]) : [],
        evidence: Array.isArray(item.evidence) ? item.evidence.filter(isEvidence) : [],
        questions: questions as AutomationFlow["questions"],
        unit: typeof item.unit === "string" ? item.unit : undefined,
        replay: isRecord(item.replay) ? (item.replay as AutomationFlow["replay"]) : undefined,
        steps: Array.isArray(item.steps) ? (item.steps as AutomationFlow["steps"]) : [],
        n8n: isRecord(item.n8n) ? (item.n8n as AutomationFlow["n8n"]) : { workflowId: null },
      },
    ];
  });
}

/** Default source: the local JSON file, or no Flows when it is missing. */
export const localFileFlowSource: FlowSource = {
  async load() {
    try {
      const response = await fetch(LOCAL_FLOWS_URL, { cache: "no-store" });
      if (!response.ok) return [];
      return parseAutomationFlows(await response.json());
    } catch {
      return [];
    }
  },
};

let source: FlowSource = localFileFlowSource;

export function flowSource(): FlowSource {
  return source;
}

/** Lets the Flow service (or a test) provide the proposals. */
export function setFlowSource(next: FlowSource) {
  source = next;
}

export function findAutomationFlow(
  flows: AutomationFlow[],
  id: string | null | undefined,
): AutomationFlow | undefined {
  return flows.find((flow) => flow.id === id);
}
