// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

"use client";

// « Trouver une automatisation », next to the notification bell of
// Automations: finds repeated work (the scripted demo task, see
// lib/automation-flows/find-automation.ts) and announces it with the
// notification that opens its Task Page.

import React, { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  desktopFindAutomationDeps,
  findAutomation,
  openDemoTaskPage,
  type FindAutomationResult,
} from "@/lib/automation-flows/find-automation";

export function FindAutomationButton({
  find = () => findAutomation(desktopFindAutomationDeps()),
  openTask = openDemoTaskPage,
}: {
  find?: () => Promise<FindAutomationResult>;
  openTask?: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [searching, setSearching] = useState(false);

  const run = async () => {
    setSearching(true);
    try {
      const result = await find();
      if (result.notified) return;
      // The task is installed: open its Task Page, as the notification would have.
      toast({ title: "Notification non affichée", description: `${result.reason}. La tâche s'ouvre directement.` });
      await openTask();
    } catch (error) {
      toast({
        title: "Impossible de chercher une automatisation",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      data-testid="find-automation"
      onClick={run}
      disabled={searching}
      aria-busy={searching}
      className="mr-2 gap-2"
    >
      {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
      {searching ? "Recherche dans votre activité…" : "Trouver une automatisation"}
    </Button>
  );
}
