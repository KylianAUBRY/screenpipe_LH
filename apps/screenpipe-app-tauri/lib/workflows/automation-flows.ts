// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Desktop side of the Task Page's "Créer l'automatisation": the Flow service
// creates the Flow from the Detected Task (idempotent per task), then the
// app opens its Review Screen in Automations → Flows.

import { emit } from "@tauri-apps/api/event";
import type { WorkflowsPlatform } from "@screenpipe/workflows-ui";
import { flowsApi, FlowsApiError, type FlowsErrorCode } from "@/components/automation-flows/api";

// Shown on the Task Page, under the action; the answers stay on screen.
const CREATION_ERROR: Record<FlowsErrorCode, string> = {
  n8n_not_configured: "n8n n'est pas configuré. Renseignez l'URL de l'API n8n et une clé API dans Connexions → n8n, puis réessayez.",
  n8n_unreachable: "Impossible de joindre n8n. Vérifiez qu'il tourne, puis réessayez.",
  not_found: "Cette tâche ne peut pas encore devenir une automatisation.",
  unknown: "Impossible de créer l'automatisation. Vos réponses sont conservées. Réessayez.",
};

export const createAutomationFlow: NonNullable<WorkflowsPlatform["createAutomationFlow"]> = async (taskId, answers) => {
  let flowId: string;
  try {
    flowId = (await flowsApi.createFromTask(taskId, answers)).id;
  } catch (error) {
    throw new Error(CREATION_ERROR[error instanceof FlowsApiError ? error.code : "unknown"], { cause: error });
  }
  await openFlowReview(flowId);
};

async function openFlowReview(flowId: string): Promise<void> {
  const url = `/home?section=pipes&tab=flows&flow=${encodeURIComponent(flowId)}`;
  // The Automations view reads ?tab=flows&flow= when it mounts.
  window.history.replaceState(window.history.state, "", url);
  await emit("navigate", { url });
}
