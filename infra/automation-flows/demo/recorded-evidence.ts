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

/** Gmail and Jira run in a browser: recognise them by window title or URL, not by app. */
const SURFACES: Record<EvidenceCapture["app"], string[]> = { Gmail: ["gmail", "mail.google.com"], Jira: ["jira", "atlassian.net"] };
const onSurface = (row: SearchRow, app: EvidenceCapture["app"]) => {
  const where = [row.app_name, row.window_name, row.browser_url].filter(value => typeof value === "string").join(" ").toLowerCase();
  return SURFACES[app].some(marker => where.includes(marker));
};

async function findCapture(capture: EvidenceCapture, api: RecordingsApi): Promise<CaptureLookup> {
  // The closest match on each side of the key frame: one short page per side,
  // so long runs of matching frames elsewhere in the recording do not hide it.
  const side = async (order: "ascending" | "descending"): Promise<RecordedFrame | null> => {
    const params = new URLSearchParams({
      content_type: "ocr", limit: "20", offset: "0", order,
      start_time: new Date(order === "ascending" ? capture.at : api.window.start).toISOString(),
      end_time: new Date(order === "ascending" ? api.window.end : capture.at).toISOString(),
      [capture.quoteIn === "window" ? "window_name" : "q"]: words(capture.quote),
    });
    const response = await fetch(`${api.url}/search?${params}`, {
      headers: api.key ? { Authorization: `Bearer ${api.key}` } : {},
    });
    const body = await response.json() as { data?: { type?: string; content?: SearchRow }[] };
    const row = body.data?.map(item => item.type === "OCR" ? item.content : undefined)
      .find(row => row && typeof row.timestamp === "string" && Number.isFinite(Date.parse(row.timestamp))
        && Number.isSafeInteger(row.frame_id) && (row.frame_id as number) > 0 && onSurface(row, capture.app));
    return row ? { frameId: row.frame_id as number, timestamp: row.timestamp as string } : null;
  };
  const distance = (frame: RecordedFrame) => Math.abs(Date.parse(frame.timestamp) - Date.parse(capture.at));
  const [before, after] = await Promise.all([side("descending"), side("ascending")]);
  const frame = before && after ? (distance(after) < distance(before) ? after : before) : before ?? after;
  return frame ? { image: capture.image, frame } : { image: capture.image, frame: null, reason: "no matching frame" };
}

export function findRecordedFrames(captures: EvidenceCapture[], api: RecordingsApi): Promise<CaptureLookup[]> {
  return Promise.all(captures.map(capture => findCapture(capture, api)));
}
