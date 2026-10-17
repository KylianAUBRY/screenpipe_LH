// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useGT } from "gt-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { answerText } from "@/lib/automation-flows/review";
import type { FlowAnswer, FlowQuestion } from "@/lib/automation-flows/types";

const PILL =
  "rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function FlowQuestionItem({
  question,
  index,
  total,
  answer,
  onAnswer,
}: {
  question: FlowQuestion;
  index: number;
  total: number;
  answer: FlowAnswer | undefined;
  onAnswer: (answer: FlowAnswer | undefined) => void;
}) {
  const ui = useGT();
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(answer && "custom" in answer ? answer.custom : "");
  const done = answerText(question, answer);
  const fieldId = `flow-question-${question.id}`;

  const label = (
    <p className="text-xs font-medium text-muted-foreground normal-case tracking-widest">
      {ui("Question {index} of {total}", { index, total })}
    </p>
  );

  if (done) {
    return (
      <div className="space-y-2" data-testid={`flow-question-${question.id}`}>
        {label}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 break-words">{done}</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => {
              const wasCustom = Boolean(answer && "custom" in answer);
              onAnswer(undefined);
              setWriting(wasCustom);
            }}
          >
            {ui("Change")}
          </Button>
        </div>
      </div>
    );
  }

  const saveDraft = () => {
    if (!draft.trim()) return;
    onAnswer({ custom: draft.trim() });
    setWriting(false);
  };

  return (
    <div className="space-y-3" data-testid={`flow-question-${question.id}`}>
      {label}
      <p className="text-base font-medium leading-snug">{question.question}</p>
      {question.context && <p className="text-sm text-muted-foreground">{question.context}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {question.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={cn(PILL, "bg-muted text-foreground hover:bg-foreground hover:text-background")}
            onClick={() => {
              setWriting(false);
              onAnswer({ choiceId: choice.id });
            }}
          >
            {choice.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={writing}
          className={cn(
            PILL,
            writing
              ? "bg-foreground text-background"
              : "bg-muted text-foreground hover:bg-foreground hover:text-background",
          )}
          onClick={() => setWriting((open) => !open)}
        >
          {ui("Other answer…")}
        </button>
      </div>
      {writing && (
        <div className="space-y-2 pt-1">
          <label htmlFor={fieldId} className="text-xs text-muted-foreground">
            {ui("Your answer, in your own words")}
          </label>
          <Textarea
            id={fieldId}
            autoFocus
            rows={3}
            value={draft}
            placeholder={question.placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveDraft();
            }}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 px-3 font-semibold" disabled={!draft.trim()} onClick={saveDraft}>
              SAVE ANSWER
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setWriting(false)}>
              {ui("Cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
