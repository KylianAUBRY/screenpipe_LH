// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { emit } from "@tauri-apps/api/event";
import { History, ImageOff } from "lucide-react";
import { useGT } from "gt-react";
import { Button } from "@/components/ui/button";
import { appendAuthToken, getApiBaseUrl } from "@/lib/api";
import { useTimelineStore } from "@/lib/hooks/use-timeline-store";
import { useUiLocale } from "@/lib/i18n/provider";
import type { FlowEvidence as Evidence } from "@/lib/automation-flows/types";

const SECTION_LABEL = "text-xs font-medium text-muted-foreground normal-case tracking-widest";

/**
 * The repetitions an Automation Flow was learned from: a capture of each
 * moment and a link to that moment in the timeline.
 */
export function FlowEvidence({ evidence, unit }: { evidence: Evidence[]; unit: string }) {
  const ui = useGT();
  const uiLocale = useUiLocale();
  const router = useRouter();
  const setPendingNavigation = useTimelineStore((store) => store.setPendingNavigation);
  const [missingFrames, setMissingFrames] = useState<ReadonlySet<number>>(new Set());

  // Same path as the meeting replay strip: the Timeline reads the pending
  // target on mount, and the event covers an already-mounted Timeline.
  const openInTimeline = useCallback(
    (at: string) => {
      const iso = new Date(at).toISOString();
      setPendingNavigation({ timestamp: iso });
      router.push("/home?section=timeline");
      setTimeout(() => void emit("navigate-to-timestamp", iso), 250);
    },
    [router, setPendingNavigation],
  );

  if (!evidence.length) return null;

  return (
    <section className="space-y-3" data-testid="flow-evidence">
      <div>
        <h4 className={SECTION_LABEL}>{ui("Learned from")}</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          {ui("The {count} {unit} you handled by hand.", { count: evidence.length, unit })}
        </p>
      </div>
      <ol className="flex snap-x gap-3 overflow-x-auto pb-2">
        {evidence.map((item, index) => {
          const showFrame = item.frameId !== undefined && !missingFrames.has(item.frameId);
          return (
            <li
              key={`${item.at}-${index}`}
              className="flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border"
              data-testid="flow-evidence-item"
            >
              <div className="relative aspect-video bg-muted">
                {showFrame ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={appendAuthToken(`${getApiBaseUrl()}/frames/${item.frameId}`)}
                    alt={ui("Screen capture: {label}", { label: item.label })}
                    className="h-full w-full object-cover object-top"
                    draggable={false}
                    loading="lazy"
                    onError={() =>
                      setMissingFrames((previous) => new Set(previous).add(item.frameId as number))
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <ImageOff className="h-4 w-4" aria-hidden />
                    {ui("No capture")}
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-sm bg-background/90 px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
                  {index + 1}/{evidence.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="font-mono text-xs text-muted-foreground">
                  {new Date(item.at).toLocaleString(uiLocale, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {item.app ? ` · ${item.app}` : ""}
                </p>
                <p className="flex-1 text-sm leading-snug">{item.label}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="-ml-2 mt-1 h-7 justify-start gap-1.5 self-start px-2 text-xs text-muted-foreground"
                  onClick={() => openInTimeline(item.at)}
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  {ui("View in timeline")}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
