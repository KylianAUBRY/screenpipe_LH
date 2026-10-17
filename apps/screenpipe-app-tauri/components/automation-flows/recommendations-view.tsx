// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useCallback, useState } from "react";
import { useGT } from "gt-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { findAutomationFlow } from "@/lib/automation-flows/source";
import {
  buildFlowProposalNotification,
  isBrowserDevRuntime,
  sendFlowProposalNotification,
} from "@/lib/automation-flows/notification";
import { pendingQuestions } from "@/lib/automation-flows/review";
import { EMPTY_FLOW_STATE, useAutomationFlows, useAutomationFlowStore } from "@/lib/automation-flows/store";
import type { AutomationFlow, FlowStatus } from "@/lib/automation-flows/types";
import { FlowReview, FlowStatusSquare } from "./flow-review";
import { NotificationPreview } from "./notification-preview";

type PreviewNotification = { flowId: string; title: string; body: string };

const SHOW_TEST_TOOLS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_AUTOMATION_FLOW_TEST_TOOLS === "1";

/**
 * Recommendations tab: proposed Automation Flows grouped by state, and the
 * review screen of the open one. The open Flow is owned by the Automations
 * page so a notification click can open it; unknown ids show the list.
 */
export function RecommendationsView({
  openFlowId,
  onOpenFlow,
}: {
  openFlowId: string | null;
  onOpenFlow: (flowId: string | null) => void;
}) {
  const ui = useGT();
  const { toast } = useToast();
  const flowStates = useAutomationFlowStore((store) => store.flows);
  const resetFlows = useAutomationFlowStore((store) => store.reset);
  const setStatus = useAutomationFlowStore((store) => store.setStatus);
  const { flows: catalog, loaded } = useAutomationFlows();
  // Browser dev loop only: the in-page copy of the notification panel.
  const [preview, setPreview] = useState<PreviewNotification | null>(null);
  const dismissPreview = useCallback(() => setPreview(null), []);

  const selected = findAutomationFlow(catalog, openFlowId);
  if (selected) return <FlowReview flow={selected} onBack={() => onOpenFlow(null)} />;

  const stateOf = (flow: AutomationFlow) => flowStates[flow.id] ?? EMPTY_FLOW_STATE;
  const groups: { status: FlowStatus; label: string }[] = [
    { status: "waiting", label: ui("Waiting for you") },
    { status: "running", label: ui("Running") },
    { status: "paused", label: ui("Paused") },
    { status: "dismissed", label: ui("Dismissed") },
  ];

  const rowStatus = (flow: AutomationFlow) => {
    const { status, answers } = stateOf(flow);
    if (status === "running") return ui("on");
    if (status === "paused") return ui("paused");
    if (status === "dismissed") return ui("not now");
    const count = pendingQuestions(flow, answers).length;
    if (count === 1) return ui("1 question to answer");
    return count ? ui("{count} questions to answer", { count }) : ui("ready to turn on");
  };

  const sendTestNotification = async () => {
    const flow = catalog[0];
    if (!flow) return;
    const pending = pendingQuestions(flow, stateOf(flow).answers).length;
    if (isBrowserDevRuntime()) {
      // No notification panel window in the browser, and port 11435 may be the
      // installed screenpipe app: show the same notification in-page.
      const { title, body } = buildFlowProposalNotification(flow, pending);
      setPreview({ flowId: flow.id, title, body });
      return;
    }
    try {
      const result = await sendFlowProposalNotification(flow, pending);
      if (!result.shown) {
        toast({ title: ui("screenpipe did not show the notification"), description: result.message });
      }
    } catch (error) {
      toast({
        title: ui("Could not reach the notification server"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {!loaded ? null : catalog.length === 0 ? (
        <div className="rounded-lg border border-border px-4 py-12 text-center" data-testid="flows-empty">
          <p className="text-base font-medium">{ui("No recommendations yet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ui("When screenpipe notices work you repeat, it proposes an automation here.")}
          </p>
        </div>
      ) : (
        groups.map(({ status, label }) => {
          const flows = catalog.filter((flow) => stateOf(flow).status === status);
          if (!flows.length) return null;
          return (
            <section key={status} className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground normal-case tracking-widest">
                {label} <span className="ml-1 font-mono tracking-normal">{flows.length}</span>
              </h4>
              <div className="divide-y divide-border rounded-lg border border-border">
                {flows.map((flow) =>
                  status === "dismissed" ? (
                    // Dismissed proposals stay listed, dimmed, with a way back.
                    <div
                      key={flow.id}
                      data-testid={`flow-row-${flow.id}`}
                      className="flex w-full items-center gap-4 px-4 py-3.5"
                    >
                      <FlowStatusSquare status="dismissed" />
                      <span className="min-w-0 flex-1 opacity-60">
                        <span className="block truncate text-sm font-medium">{flow.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{flow.learnedFrom}</span>
                      </span>
                      <span className="hidden whitespace-nowrap font-mono text-xs text-muted-foreground sm:block">
                        {rowStatus(flow)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs font-semibold rounded-md normal-case tracking-wide"
                        onClick={() => setStatus(flow.id, "waiting")}
                        data-testid={`flow-restore-${flow.id}`}
                      >
                        RESTORE
                      </Button>
                    </div>
                  ) : (
                    <button
                      key={flow.id}
                      type="button"
                      data-testid={`flow-row-${flow.id}`}
                      onClick={() => onOpenFlow(flow.id)}
                      className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-accent/40"
                    >
                      <FlowStatusSquare status={stateOf(flow).status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{flow.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{flow.learnedFrom}</span>
                      </span>
                      <span className="hidden whitespace-nowrap font-mono text-xs text-muted-foreground sm:block">
                        {rowStatus(flow)}
                      </span>
                      <span
                        className={cn(
                          buttonVariants({ size: "sm", variant: status === "waiting" ? "default" : "outline" }),
                          "h-7 px-3 text-xs font-semibold rounded-md normal-case tracking-wide pointer-events-none",
                        )}
                      >
                        {status === "waiting" ? "REVIEW" : "OPEN"}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>
          );
        })
      )}

      {SHOW_TEST_TOOLS && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3">
          <span className="mr-auto text-xs text-muted-foreground">{ui("Test tools (dev builds only)")}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3"
            disabled={catalog.length === 0}
            onClick={() => void sendTestNotification()}
          >
            {ui("Send test notification")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3"
            onClick={() => {
              resetFlows();
              onOpenFlow(null);
            }}
          >
            {ui("Reset review")}
          </Button>
        </div>
      )}

      {preview && (
        <NotificationPreview
          title={preview.title}
          body={preview.body}
          onDismiss={dismissPreview}
          onOpen={() => {
            setPreview(null);
            onOpenFlow(preview.flowId);
          }}
        />
      )}
    </div>
  );
}
