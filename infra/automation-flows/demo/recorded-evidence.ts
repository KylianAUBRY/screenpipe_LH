// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Finds the demo captures in this machine's own recordings through the local
// ScreenPipe search API, so the Task Page shows real frames like the finished
// product would. Deterministic: words of the capture's quote, no AI. A capture
// that cannot be found keeps its embedded key frame.
import type { EvidenceCapture, RecordedFrame } from "./detected-task";

export type CaptureLookup = { image: string; frame: RecordedFrame } | { image: string; frame: null; reason: string };

export type RecordingsApi = {
  url: string;
  key?: string;
  window: { start: string; end: string };
};

type SearchRow = { frame_id?: unknown; timestamp?: unknown; app_name?: unknown; window_name?: unknown; browser_url?: unknown };

/** The quote's words for the search API, which requires each of them. */
const words = (quote: string) => quote.split(/\s+/)
  .map(token => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
  .filter(Boolean).join(" ");

async function findCapture(capture: EvidenceCapture, api: RecordingsApi): Promise<CaptureLookup> {
  const params = new URLSearchParams({
    content_type: "ocr", limit: "20", offset: "0", order: "ascending",
    start_time: new Date(api.window.start).toISOString(), end_time: new Date(api.window.end).toISOString(),
    [capture.quoteIn === "window" ? "window_name" : "q"]: words(capture.quote),
  });
  const response = await fetch(`${api.url}/search?${params}`, {
    headers: api.key ? { Authorization: `Bearer ${api.key}` } : {},
  });
  const body = await response.json() as { data?: { type?: string; content?: SearchRow }[] };
  const row = body.data?.find(item => item.type === "OCR")?.content;
  if (!row || typeof row.timestamp !== "string" || !Number.isSafeInteger(row.frame_id)) {
    return { image: capture.image, frame: null, reason: "no matching frame" };
  }
  return { image: capture.image, frame: { frameId: row.frame_id as number, timestamp: row.timestamp } };
}

export function findRecordedFrames(captures: EvidenceCapture[], api: RecordingsApi): Promise<CaptureLookup[]> {
  return Promise.all(captures.map(capture => findCapture(capture, api)));
}
