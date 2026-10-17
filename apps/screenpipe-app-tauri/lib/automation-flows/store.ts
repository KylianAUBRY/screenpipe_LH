// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { useEffect } from "react";
import { create } from "zustand";
import { flowSource } from "./source";
import type { AutomationFlow, FlowActivation, FlowAnswer, FlowStatus } from "./types";

const STORAGE_KEY = "screenpipe:automation-flows:v1";
const HISTORY_LIMIT = 50;

export type FlowReviewState = {
  status: FlowStatus;
  answers: Record<string, FlowAnswer | undefined>;
  /** TURN ON / PAUSE events, newest first. Missing in state saved before it existed. */
  history?: FlowActivation[];
};

type AutomationFlowStore = {
  /** Proposed Flows from the FlowSource. Not persisted. */
  catalog: AutomationFlow[];
  catalogLoaded: boolean;
  /** Review answers and status per Flow id, kept on this device. */
  flows: Record<string, FlowReviewState>;
  setAnswer: (flowId: string, questionId: string, answer: FlowAnswer | undefined) => void;
  setStatus: (flowId: string, status: FlowStatus) => void;
  /** Running or paused after a successful backend call, logged in the History. */
  recordSwitch: (flowId: string, on: boolean, reason?: FlowActivation["reason"]) => void;
  /** Back to "waiting" with no answers. Used by the dev test tools. */
  reset: (flowId?: string) => void;
};

export const EMPTY_FLOW_STATE: FlowReviewState = { status: "waiting", answers: {} };

function load(): Record<string, FlowReviewState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(flows: Record<string, FlowReviewState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
  } catch {
    // Review answers are a convenience; losing them only re-asks the questions.
  }
}

/**
 * Review answers and status kept on this device. Activation state itself lives
 * in n8n; `status` mirrors the last result of the backend call, and `history`
 * logs those calls on this device.
 */
export const useAutomationFlowStore = create<AutomationFlowStore>((set, get) => {
  const update = (flowId: string, change: (state: FlowReviewState) => FlowReviewState) => {
    const current = get().flows[flowId] ?? EMPTY_FLOW_STATE;
    const flows = { ...get().flows, [flowId]: change(current) };
    save(flows);
    set({ flows });
  };
  return {
    catalog: [],
    catalogLoaded: false,
    flows: typeof window === "undefined" ? {} : load(),
    setAnswer: (flowId, questionId, answer) =>
      update(flowId, (state) => ({ ...state, answers: { ...state.answers, [questionId]: answer } })),
    setStatus: (flowId, status) => update(flowId, (state) => ({ ...state, status })),
    recordSwitch: (flowId, on, reason) =>
      update(flowId, (state) => ({
        ...state,
        status: on ? "running" : "paused",
        history: [
          { at: new Date().toISOString(), on, ...(reason ? { reason } : {}) },
          ...(state.history ?? []),
        ].slice(0, HISTORY_LIMIT),
      })),
    reset: (flowId) => {
      const flows = { ...get().flows };
      if (flowId) delete flows[flowId];
      else for (const key of Object.keys(flows)) delete flows[key];
      save(flows);
      set({ flows });
    },
  };
});

export function useFlowReviewState(flowId: string): FlowReviewState {
  return useAutomationFlowStore((store) => store.flows[flowId] ?? EMPTY_FLOW_STATE);
}

/** Reads the proposed Flows from the current FlowSource into the store. */
export async function loadFlowCatalog(): Promise<void> {
  const catalog = await flowSource().load();
  useAutomationFlowStore.setState({ catalog, catalogLoaded: true });
}

/** Proposed Flows, loaded once from the FlowSource on first use. */
export function useAutomationFlows(): { flows: AutomationFlow[]; loaded: boolean } {
  const flows = useAutomationFlowStore((store) => store.catalog);
  const loaded = useAutomationFlowStore((store) => store.catalogLoaded);
  useEffect(() => {
    if (!loaded) void loadFlowCatalog();
  }, [loaded]);
  return { flows, loaded };
}
