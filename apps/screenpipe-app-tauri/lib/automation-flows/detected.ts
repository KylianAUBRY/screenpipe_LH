// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import type { FlowSource } from "./source";
import type { AutomationFlow } from "./types";

/** Flows found by "Find an automation", kept on the device with the handoff they came from. */
const DETECTED_KEY = "screenpipe:automation-flows:detected:v1";

export type HandoffExample = {
  starred?: boolean;
  input: { title: string; text?: string };
  output: { key: string | null; title: string; text?: string };
};

/** The parts of `screenpipe.automation-handoff/v1` the review screen uses. */
export type AutomationHandoff = {
  schema: "screenpipe.automation-handoff/v1";
  generatedAt: string;
  problem: string;
  trigger: { app: string; account: string | null };
  target: { app: string; keyPrefix: string | null; baseUrl: string | null };
  evidence: {
    occurrences: number;
    starredOccurrences: number;
    sessions: number;
    days: number;
    returnedToSource: string;
    createdKeys: (string | null)[];
  };
  examples: HandoffExample[];
  detector: { range: { start: string; end: string } };
};

export type DetectedFlow = { flow: AutomationFlow; handoff: AutomationHandoff };

export function readDetected(): DetectedFlow[] {
  try {
    const raw = localStorage.getItem(DETECTED_KEY);
    const value = raw ? (JSON.parse(raw) as DetectedFlow[]) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveDetectedFlow(detected: DetectedFlow) {
  const rest = readDetected().filter((d) => d.flow.id !== detected.flow.id);
  try {
    localStorage.setItem(DETECTED_KEY, JSON.stringify([detected, ...rest]));
  } catch {
    // Storage full or unavailable: the Flow still opens from the notification this session.
  }
}

/** The handoff behind a detected Flow, for the n8n builder. */
export function detectedHandoff(flowId: string): AutomationHandoff | null {
  return readDetected().find((d) => d.flow.id === flowId)?.handoff ?? null;
}

/** Shows detected Flows before the base source's ones. */
export function withDetectedFlows(base: FlowSource): FlowSource {
  return {
    async load() {
      const flows = await base.load();
      const detected = readDetected().map((d) => d.flow);
      const ids = new Set(detected.map((f) => f.id));
      return [...detected, ...flows.filter((f) => !ids.has(f.id))];
    },
  };
}
