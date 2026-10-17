// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pause,
  Pencil,
  Power,
  RotateCcw,
  Workflow,
} from "lucide-react";
import { useGT } from "gt-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { flowBackend, openFlowInN8n } from "@/lib/automation-flows/backend";
import {
  answerText,
  canTurnOn,
  hasCustomAnswer,
  pendingQuestions,
  replayScore,
} from "@/lib/automation-flows/review";
import { useAutomationFlowStore, useFlowReviewState } from "@/lib/automation-flows/store";
import type { AutomationFlow, FlowActivation, FlowStatus } from "@/lib/automation-flows/types";
import { useUiLocale } from "@/lib/i18n/provider";
import { FlowEvidence } from "./flow-evidence";
import { FlowQuestionItem } from "./flow-question";

// Same shape as the Discover detail header buttons.
const HERO_BUTTON = "h-9 px-4 text-sm font-semibold rounded-md normal-case tracking-wide";
const SECTION_LABEL = "text-xs font-medium text-muted-foreground normal-case tracking-widest";

export function FlowStatusSquare({ status }: { status: FlowStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 shrink-0 border",
        status === "running"
          ? "border-foreground bg-foreground"
          : status === "dismissed"
            ? "border-dashed border-muted-foreground/40 bg-transparent"
            : "border-muted-foreground/50 bg-transparent",
      )}
    />
  );
}

export function FlowReview({ flow, onBack }: { flow: AutomationFlow; onBack: () => void }) {
  const ui = useGT();
  const { toast } = useToast();
  const uiLocale = useUiLocale();
  const { status, answers, history = [] } = useFlowReviewState(flow.id);
  const setAnswer = useAutomationFlowStore((store) => store.setAnswer);
  const setStatus = useAutomationFlowStore((store) => store.setStatus);
  const recordSwitch = useAutomationFlowStore((store) => store.recordSwitch);
  const [busy, setBusy] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);

  const pending = pendingQuestions(flow, answers);
  const ready = canTurnOn(flow, answers);
  const running = status === "running";
  const dismissed = status === "dismissed";
  const score = replayScore(flow, answers);
  const unit = flow.unit || ui("cases");

  const statusLabel = running
    ? ui("On")
    : status === "paused"
      ? ui("Paused")
      : dismissed
        ? ui("Dismissed")
        : ui("Not on yet");
  const statusDetail = running
    ? ui("Watching for new {unit}", { unit })
    : dismissed
      ? ui("Restore it to review it again")
      : pending.length === 1
      ? ui("1 question to answer")
      : pending.length
        ? ui("{count} questions to answer", { count: pending.length })
        : null;
  // Once every question is answered, the header says it is ready, with the replay score.
  const readyDetail =
    flow.replay && score !== null
      ? ui("same choices as you on {matched} of your last {total} {unit}", {
          matched: score,
          total: flow.replay.total,
          unit,
        })
      : null;

  const switchFlow = async (on: boolean, reason?: FlowActivation["reason"]) => {
    setBusy(true);
    try {
      if (on) await flowBackend().activate(flow);
      else await flowBackend().deactivate(flow);
      recordSwitch(flow.id, on, reason);
    } catch (error) {
      toast({
        title: on ? ui("Could not turn it on") : ui("Could not pause it"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // Dismiss keeps the proposal, moved to the Dismissed group of the list.
  const dismiss = () => {
    setStatus(flow.id, "dismissed");
    toast({ title: ui("Moved to Dismissed"), description: ui("You can restore it from the list.") });
    onBack();
  };

  return (
    <div className="space-y-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {ui("Back to Flow")}
      </button>

      {/* Header, pinned while scrolling so TURN ON / PAUSE stay in reach */}
      <div
        className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-4 border-b border-border bg-background/95 py-3 backdrop-blur"
        data-testid="flow-header"
      >
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight">{flow.title}</h2>
          <p className="text-sm text-muted-foreground">{flow.learnedFrom}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-testid="flow-status">
            <FlowStatusSquare status={status} />
            <span className={cn(running && "text-foreground")}>{statusLabel}</span>
            <span className="text-muted-foreground/50">·</span>
            {statusDetail ? (
              <span>{statusDetail}</span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {ui("Ready to turn on")}
                </span>
                {readyDetail && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{readyDetail}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {!running && !dismissed && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(HERO_BUTTON, "text-muted-foreground")}
              onClick={dismiss}
              data-testid="flow-dismiss"
            >
              DISMISS
            </Button>
          )}
          <Button size="sm" variant="outline" className={HERO_BUTTON} onClick={() => setGraphOpen(true)}>
            <Workflow className="h-4 w-4 mr-1.5" />
            VIEW GRAPH
          </Button>
          {dismissed ? (
            <Button
              size="sm"
              className={HERO_BUTTON}
              onClick={() => setStatus(flow.id, "waiting")}
              data-testid="flow-restore"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              RESTORE
            </Button>
          ) : running ? (
            <Button
              size="sm"
              variant="outline"
              className={HERO_BUTTON}
              disabled={busy}
              onClick={() => void switchFlow(false)}
              data-testid="flow-pause"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Pause className="h-4 w-4 mr-1.5" />}
              PAUSE
            </Button>
          ) : (
            <Button
              size="sm"
              className={HERO_BUTTON}
              disabled={!ready || busy}
              onClick={() => void switchFlow(true)}
              data-testid="flow-turn-on"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Power className="h-4 w-4 mr-1.5" />}
              TURN ON
            </Button>
          )}
        </div>
      </div>

      {/* What it automates, in one glance */}
      <div className="space-y-3">
        <p className="text-lg leading-snug">{flow.summary}</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {flow.checks.map((check) => (
            <li key={check} className="flex items-center gap-2">
              <Check className="h-4 w-4" aria-hidden />
              {check}
            </li>
          ))}
        </ul>
      </div>

      {flow.evidence?.length ? <FlowEvidence evidence={flow.evidence} unit={unit} /> : null}

      {running ? (
        <>
          <div className="space-y-3">
            <h4 className={SECTION_LABEL}>{ui("Activity")}</h4>
            <div className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {ui("Nothing yet. New {unit} it handles will show up here.", { unit })}
            </div>
          </div>

          {flow.questions.length > 0 && (
            <section className="space-y-3" data-testid="flow-answers">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className={SECTION_LABEL}>{ui("Your answers")}</h4>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs font-semibold rounded-md normal-case tracking-wide"
                  disabled={busy}
                  onClick={() => void switchFlow(false, "change-answers")}
                  data-testid="flow-change-answers"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  CHANGE ANSWERS
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {flow.questions.map((question) => (
                  <li key={question.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{answerText(question, answers[question.id])}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {ui("Changing them pauses the automation until you turn it on again.")}
              </p>
            </section>
          )}
        </>
      ) : (
        <>
          <section
            className={cn(
              "space-y-5 rounded-lg border p-5",
              pending.length ? "border-foreground/70 bg-muted/30" : "border-border",
            )}
            data-testid="flow-questions"
          >
            <div>
              <h3 className="text-base font-semibold">
                {pending.length === 1
                  ? ui("1 question before it can run")
                  : pending.length
                    ? ui("{count} questions before it can run", { count: pending.length })
                    : ui("Your answers")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {ui("screenpipe could not settle these on its own.")}
                {hasCustomAnswer(flow, answers) ? ` ${ui("Your own answers apply to new {unit}.", { unit })}` : ""}
              </p>
            </div>
            <div className="divide-y divide-border">
              {flow.questions.map((question, index) => (
                <div key={question.id} className="py-5 first:pt-0 last:pb-0">
                  <FlowQuestionItem
                    question={question}
                    index={index + 1}
                    total={flow.questions.length}
                    answer={answers[question.id]}
                    onAnswer={(answer) => setAnswer(flow.id, question.id, answer)}
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Every TURN ON / PAUSE, newest first */}
      {history.length > 0 && (
        <section className="space-y-3" data-testid="flow-history">
          <h4 className={SECTION_LABEL}>{ui("History")}</h4>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.map((event, index) => (
              <li
                key={`${event.at}-${index}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
                data-testid="flow-history-item"
              >
                <FlowStatusSquare status={event.on ? "running" : "paused"} />
                <span className="min-w-0 flex-1">
                  {event.on
                    ? ui("Turned on")
                    : event.reason === "change-answers"
                      ? ui("Paused to change answers")
                      : ui("Paused")}
                </span>
                <time dateTime={event.at} className="shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(event.at).toLocaleString(uiLocale, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={graphOpen} onOpenChange={setGraphOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ui("How it works, step by step")}</DialogTitle>
            <DialogDescription>{ui("Each step is one node of the n8n workflow.")}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-0">
            {flow.steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-3 border-b border-border py-2.5 last:border-b-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-border font-mono text-[11px] text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              className={HERO_BUTTON}
              onClick={() => void openFlowInN8n(flow)}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              OPEN IN N8N
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
