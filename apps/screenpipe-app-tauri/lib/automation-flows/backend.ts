// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { openExternalUrl } from "@/lib/open-external-url";
import type { AutomationFlow } from "./types";

/** Local n8n instance. Override with NEXT_PUBLIC_N8N_URL. */
export const N8N_URL = (process.env.NEXT_PUBLIC_N8N_URL ?? "http://localhost:5678").replace(/\/$/, "");

/**
 * What the review screen needs from the Flow service. n8n is the source of
 * truth: activate and deactivate must switch the workflow in n8n (public API
 * `POST /api/v1/workflows/{id}/activate` and `/deactivate`) and resolve only
 * once n8n confirms.
 */
export interface FlowBackend {
  activate(flow: AutomationFlow): Promise<void>;
  deactivate(flow: AutomationFlow): Promise<void>;
}

/**
 * Demo backend: switches the state in the app only. Replace it with the n8n
 * client (or the local Flow service) before the live demo.
 */
export const demoFlowBackend: FlowBackend = {
  async activate() {},
  async deactivate() {},
};

let backend: FlowBackend = demoFlowBackend;

export function flowBackend(): FlowBackend {
  return backend;
}

/** Lets the Flow service plug in its client without touching the UI. */
export function setFlowBackend(next: FlowBackend) {
  backend = next;
}

/** Opens the workflow in the n8n editor, or the workflow list when the Flow has no id. */
export function n8nWorkflowUrl(flow: AutomationFlow): string {
  return flow.n8n.workflowId
    ? `${N8N_URL}/workflow/${encodeURIComponent(flow.n8n.workflowId)}`
    : `${N8N_URL}/home/workflows`;
}

export async function openFlowInN8n(flow: AutomationFlow): Promise<void> {
  await openExternalUrl(n8nWorkflowUrl(flow));
}
