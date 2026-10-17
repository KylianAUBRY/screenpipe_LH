// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

"use client";

// « Create flow » in the main chat's composer: the same start as « Ajouter »
// in the Flows tab. It only fills the composer with the `automation-flows`
// skill prompt; the user describes the automation and sends it, and the skill
// imports it switched off and ends with its Review Screen link.

import React from "react";
import { Workflow } from "lucide-react";
import { useGT } from "gt-react";
import { Button } from "@/components/ui/button";
import { CREATION_PROMPT } from "./api";

/** The draft with the creation prompt in front; what was typed stays as the description. */
export function withCreationPrompt(draft: string): string {
  const description = draft.trim();
  if (description.startsWith(CREATION_PROMPT.trim())) return draft;
  return CREATION_PROMPT + description;
}

export function CreateFlowButton({
  value,
  inputRef,
  onValueChange,
  disabled = false,
}: {
  value: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const ui = useGT();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={disabled}
      data-testid="chat-create-flow"
      title={ui("Create an Automation Flow with the automation-flows skill")}
      className="h-8 shrink-0 gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-signal focus-visible:ring-offset-1 motion-reduce:transition-none"
      onClick={() => {
        const next = withCreationPrompt(value);
        onValueChange(next);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(next.length, next.length);
        });
      }}
    >
      <Workflow className="h-4 w-4" aria-hidden />
      {ui("Create flow")}
    </Button>
  );
}
