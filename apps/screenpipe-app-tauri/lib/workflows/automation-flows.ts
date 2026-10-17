// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Desktop side of the Task Page's "Créer l'automatisation": the Flow service
// creates the Flow from the Detected Task (idempotent per task), then the
// app opens its Review Screen in Automations → Flows. Also opens that Review
// Screen from the chat's `screenpipe://flows/<id>` link.

import { emit } from "@tauri-apps/api/event";
import type { WorkflowsPlatform } from "@screenpipe/workflows-ui";
import { commands } from "@/lib/utils/tauri";
import { flowsApi, FlowsApiError, type FlowsErrorCode } from "@/components/automation-flows/api";

// Shown on the Task Page, under the action; the answers stay on screen.
const CREATION_FAILED = "Impossible de créer l'automatisation. Vos réponses sont conservées. Réessayez.";
const CREATION_ERROR: Record<FlowsErrorCode, string> = {
  n8n_not_configured: "n8n n'est pas configuré. Renseignez l'URL de l'API n8n et une clé API dans Connexions → n8n, puis réessayez.",
  n8n_unauthorized: "n8n a refusé la clé API. Vérifiez la clé API dans Connexions → n8n, puis réessayez.",
  n8n_unreachable: "Impossible de joindre n8n. Vérifiez qu'il tourne, puis réessayez.",
  n8n_failed: "n8n a rencontré une erreur. Réessayez dans un instant.",
  // A copy of the Flow left on in n8n is still processing an email.
  flow_running: "n8n traite encore un e-mail avec ce Flow. Réessayez dans un instant.",
  not_found: "Cette tâche ne peut pas encore devenir une automatisation.",
  // Activation and retry codes; creation never returns them.
  version_changed: CREATION_FAILED,
  activation_failed: CREATION_FAILED,
  activation_requires_user: CREATION_FAILED,
  run_not_failed: CREATION_FAILED,
  retry_still_running: CREATION_FAILED,
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

/** The Flow a `screenpipe://flows/<id>` link (chat, failure notification) points at. */
export function flowIdFromReviewLink(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "screenpipe:" || url.host !== "flows") return null;
    return decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "") || null;
  } catch {
    return null;
  }
}

/** The Home page (`showWindowActivated`) of a Flow's Review Screen. */
export function flowReviewPage(flowId: string): string {
  return `pipes&tab=flows&flow=${encodeURIComponent(flowId)}`;
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
    await commands.showWindowActivated({ Home: { page: flowReviewPage(flowId) } });
  }
  return true;
}

async function openFlowReview(flowId: string): Promise<void> {
  const url = `/home?section=${flowReviewPage(flowId)}`;
  window.history.replaceState(window.history.state, "", url);
  await emit("navigate", { url });
  showFlowsTab(flowId);
}

/**
 * Home's `navigate` listener: a navigation to the Flows tab (Home brought up
 * from another window, e.g. a failure notification) opens it on its Flow.
 * False for any other navigation. Never emits, so it cannot loop.
 */
export function followFlowsNavigation(url: URL): boolean {
  const params = url.searchParams;
  if (params.get("section") !== "pipes" || params.get("tab") !== "flows") return false;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
  showFlowsTab(params.get("flow"));
  return true;
}

// The Automations view reads ?tab=flows&flow= when it mounts; one that is
// already mounted (kept hidden behind Workflows) follows `switch-pipes-tab`.
function showFlowsTab(flowId: string | null): void {
  window.dispatchEvent(new CustomEvent("switch-pipes-tab", { detail: { tab: "flows", flow: flowId ?? undefined } }));
}
