// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { appServerFetch } from "@/lib/notifications/app-server";
import type { AutomationFlow } from "./types";

/** Tauri event the Automations tab listens to, payload `{ flowId }`. */
export const OPEN_AUTOMATION_FLOW_EVENT = "open-automation-flow";

const FLOW_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** `screenpipe://automation-flow?id=<flow id>` opens that Flow's review screen. */
export function automationFlowDeeplink(flowId: string): string {
  return `screenpipe://automation-flow?id=${encodeURIComponent(flowId)}`;
}

export function automationFlowLink(value: string): { flowId: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "screenpipe:" || url.hostname !== "automation-flow") return null;
    const flowId = url.searchParams.get("id");
    return flowId && FLOW_ID.test(flowId) ? { flowId } : null;
  } catch {
    return null;
  }
}

/** Home page query that shows the Flow tab with this Flow open. */
export function automationFlowHomeQuery(flowId: string): string {
  return new URLSearchParams({ section: "pipes", tab: "flows", flow: flowId }).toString();
}

/**
 * The app's notification server drops any id it has already stored, so each
 * proposal sent gets its own id.
 */
export function buildFlowProposalNotification(
  flow: AutomationFlow,
  pendingQuestions: number,
  sentAt: number = Date.now(),
) {
  const plural = pendingQuestions === 1 ? "question" : "questions";
  const origin = flow.learnedFrom ? `${flow.learnedFrom}.` : "Built from work you repeat.";
  return {
    id: `automation-flow-${flow.id}-${sentAt}`,
    type: "automationFlow",
    title: `New automation: ${flow.title.toLowerCase()}`,
    body: pendingQuestions
      ? `${origin} **${pendingQuestions} ${plural}** to answer before it runs.`
      : `${origin} Ready to turn on.`,
    priority: "normal",
    actions: [
      {
        id: "open_flow",
        label: "Open",
        type: "deeplink",
        url: automationFlowDeeplink(flow.id),
        primary: true,
      },
    ],
  };
}

const DELIVERED = "Notification sent successfully";

/**
 * Shows the "New automation" pop-up through the app's notification server.
 * The server answers 200 even when it skips the alert (paused notifications,
 * same alert less than 90 s ago), so `shown` reports what really happened.
 */
export async function sendFlowProposalNotification(
  flow: AutomationFlow,
  pendingQuestions: number,
): Promise<{ shown: boolean; message: string }> {
  const response = await appServerFetch("/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildFlowProposalNotification(flow, pendingQuestions)),
  });
  if (!response.ok) throw new Error(`automation flow notification failed: HTTP ${response.status}`);
  const result = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof result?.message === "string" ? result.message : DELIVERED;
  return { shown: message === DELIVERED, message };
}

/**
 * True in the browser dev loop (`bun run dev:web`). There, port 11435 may be
 * the installed screenpipe app rather than the one under test, so test
 * notifications are shown in-page instead of being posted.
 */
export function isBrowserDevRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as Window & { __SCREENPIPE_BROWSER_RUNTIME_INSTALLED__?: boolean }).__SCREENPIPE_BROWSER_RUNTIME_INSTALLED__)
  );
}
