// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Desktop side of the Task Page's "Create automation": the Flow service
// creates the Flow from the Detected Task (idempotent per task), then the
// app opens its Review Screen in Automations → Flows. Also opens that Review
// Screen from the chat's `screenpipe://flows/<id>` link.

import { emit } from "@tauri-apps/api/event";
import type { WorkflowsPlatform } from "@screenpipe/workflows-ui";
import { commands } from "@/lib/utils/tauri";
import { flowsApi, FlowsApiError, type FlowsErrorCode } from "@/components/automation-flows/api";

// Shown on the Task Page, under the action; the answers stay on screen.
const CREATION_FAILED = "Could not create the automation. Your answers are kept. Try again.";
const CREATION_ERROR: Record<FlowsErrorCode, string> = {
  n8n_not_configured: "n8n is not set up. Enter the n8n API URL and an API key in Connections → n8n, then try again.",
  n8n_unauthorized: "n8n refused the API key. Check the API key in Connections → n8n, then try again.",
  n8n_unreachable: "Could not reach n8n. Check that it is running, then try again.",
  n8n_failed: "n8n ran into an error. Try again in a moment.",
  // A copy of the Flow left on in n8n is still processing an email.
  flow_running: "n8n is still processing an email with this Flow. Try again in a moment.",
  not_found: "This task cannot become an automation yet.",
  // Activation and Dismiss codes; creation never returns them.
  flow_active: CREATION_FAILED,
  version_changed: CREATION_FAILED,
  activation_failed: CREATION_FAILED,
  activation_requires_user: CREATION_FAILED,
  unknown: CREATION_FAILED,
};

// The Detected Tasks the Flow service can create a Flow from: the engine's
// bundled DEMO_TASKS (crates/screenpipe-engine/src/automation_flows.rs; a test
// fails when the two drift apart). Every other task keeps the ordinary Task Page.
const CREATABLE_TASK_IDS = new Set(["wf-novadesk-support-tickets"]);

export const canCreateAutomationFlow: NonNullable<WorkflowsPlatform["canCreateAutomationFlow"]> = taskId =>
  CREATABLE_TASK_IDS.has(taskId);

export const createAutomationFlow: NonNullable<WorkflowsPlatform["createAutomationFlow"]> = async (taskId, answers) => {
  let flowId: string;
  try {
    flowId = (await flowsApi.createFromTask(taskId, answers)).id;
  } catch (error) {
    throw new Error(CREATION_ERROR[error instanceof FlowsApiError ? error.code : "unknown"], { cause: error });
  }
  await openFlowReview(flowId);
};

/**
 * The Review Screen link the `automation-flows` chat skill ends with
 * (`screenpipe://flows/<id>`).
 */
export function flowReviewLink(flowId: string): string {
  return `screenpipe://flows/${encodeURIComponent(flowId)}`;
}

function flowIdFromReviewLink(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "screenpipe:" || url.host !== "flows") return null;
    return decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "") || null;
  } catch {
    return null;
  }
}

/**
 * Opens the Review Screen a chat link points at; false when `href` is not a
 * Flow link. The Review Screen lives in the Home window: from another window
 * (the Chat overlay), Home is brought up on it instead.
 */
export async function openFlowReviewLink(href: string): Promise<boolean> {
  const flowId = flowIdFromReviewLink(href);
  if (!flowId) return false;
  if (window.location.pathname === "/home") {
    await openFlowReview(flowId);
  } else {
    await commands.showWindowActivated({
      Home: { page: `pipes&tab=flows&flow=${encodeURIComponent(flowId)}` },
    });
  }
  return true;
}

async function openFlowReview(flowId: string): Promise<void> {
  const url = `/home?section=pipes&tab=flows&flow=${encodeURIComponent(flowId)}`;
  // The Automations view reads ?tab=flows&flow= when it mounts; one that is
  // already mounted (kept hidden behind Workflows) follows `switch-pipes-tab`.
  window.history.replaceState(window.history.state, "", url);
  await emit("navigate", { url });
  window.dispatchEvent(new CustomEvent("switch-pipes-tab", { detail: { tab: "flows", flow: flowId } }));
}
