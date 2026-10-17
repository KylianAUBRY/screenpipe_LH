// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useState } from "react";
import { useGT } from "gt-react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { desktopDetectionDeps, findAutomation, saveDetectedFlow } from "@/lib/automation-flows/detection";
import { isBrowserDevRuntime, sendFlowProposalNotification } from "@/lib/automation-flows/notification";
import { loadFlowCatalog } from "@/lib/automation-flows/store";

/**
 * Finds repeated work in today's history with the bundled detector Pipe. A
 * found Flow joins Recommendations and arrives as the "New automation"
 * notification, whose Open action shows its review screen.
 */
export function FindAutomationButton({ onOpenFlow }: { onOpenFlow: (flowId: string) => void }) {
  const ui = useGT();
  const { toast } = useToast();
  const [searching, setSearching] = useState(false);

  const find = async () => {
    setSearching(true);
    try {
      const found = await findAutomation(await desktopDetectionDeps());
      if (!found) {
        toast({
          title: ui("No automation found"),
          description: ui("Nothing in today's work repeats often enough yet. Do the task a few more times, then search again."),
        });
        return;
      }
      saveDetectedFlow(found);
      await loadFlowCatalog();
      const { flow } = found;
      if (isBrowserDevRuntime()) {
        // The browser dev loop has no notification server of its own.
        onOpenFlow(flow.id);
        return;
      }
      const result = await sendFlowProposalNotification(flow, flow.questions.length);
      if (!result.shown) {
        toast({ title: ui("screenpipe did not show the notification"), description: result.message });
        onOpenFlow(flow.id);
      }
    } catch (error) {
      toast({
        title: ui("Could not search for automations"),
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
      onClick={find}
      disabled={searching}
      aria-busy={searching}
      className="mr-2 gap-2"
    >
      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      {searching ? ui("Searching today's work…") : ui("Find an automation")}
    </Button>
  );
}
