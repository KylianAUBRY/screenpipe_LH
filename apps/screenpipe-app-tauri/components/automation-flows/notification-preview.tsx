// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useEffect } from "react";
import { useGT } from "gt-react";
import { NotificationActionButton } from "@/components/notification-action-button";

const AUTO_DISMISS_MS = 20_000;
const FONT = '"IBM Plex Mono", monospace';

/** `**bold**` spans, the only markdown the proposal body uses. */
function renderBody(body: string) {
  return body.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 ? (
      <strong key={index} style={{ color: "hsl(var(--foreground) / 0.9)", fontWeight: 500 }}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/**
 * In-page copy of the notification panel (app/notification-panel), used by
 * the browser dev loop where the real panel window does not exist.
 */
export function NotificationPreview({
  title,
  body,
  onOpen,
  onDismiss,
}: {
  title: string;
  body: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const ui = useGT();

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      data-testid="flow-notification-preview"
      className="fixed right-4 top-4 z-50 w-[340px] max-w-[calc(100vw-32px)]"
    >
      <style>{"@keyframes flowNotifIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}@keyframes flowNotifLeft{from{width:100%}to{width:0}}@media (prefers-reduced-motion: reduce){[data-testid=flow-notification-preview] *{animation:none!important}}"}</style>
      <div
        style={{
          background: "hsl(var(--background) / 0.96)",
          borderRadius: "8px",
          backdropFilter: "blur(20px)",
          border: "1px solid hsl(var(--foreground) / 0.08)",
          fontFamily: FONT,
          color: "hsl(var(--foreground) / 0.8)",
          overflow: "hidden",
          position: "relative",
          animation: "flowNotifIn 0.15s ease-out",
          boxShadow: "0 4px 16px hsl(var(--foreground) / 0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px 0" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "10px",
              fontWeight: 500,
              letterSpacing: "0.05em",
              color: "hsl(var(--foreground) / 0.4)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/32x32.png" alt="" width={14} height={14} style={{ borderRadius: "3px" }} />
            screenpipe
          </span>
          <button
            type="button"
            aria-label={ui("Dismiss notification")}
            onClick={onDismiss}
            style={{
              background: "none",
              border: "none",
              color: "hsl(var(--foreground) / 0.35)",
              cursor: "pointer",
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              fontSize: "14px",
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "8px 14px" }}>
          <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "hsl(var(--foreground) / 0.9)" }}>
            {title}
          </div>
          <div style={{ fontSize: "11px", lineHeight: "1.4", color: "hsl(var(--foreground) / 0.5)" }}>
            {renderBody(body)}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", padding: "0 14px 12px" }}>
          <NotificationActionButton label={ui("Open")} primary onClick={onOpen} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "2px", background: "hsl(var(--foreground) / 0.05)" }}>
          <div
            style={{
              height: "100%",
              background: "hsl(var(--foreground) / 0.2)",
              animation: `flowNotifLeft ${AUTO_DISMISS_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
