// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { localFetch } from "@/lib/api";
import type { AutomationHandoff, DetectedFlow, HandoffExample } from "./detected";
import type { AutomationFlow, FlowQuestion } from "./types";

export { saveDetectedFlow, detectedHandoff } from "./detected";
export type { AutomationHandoff, DetectedFlow } from "./detected";

/**
 * "Find an automation": runs the bundled repeated-workflow-detector Pipe, reads
 * the handoff it writes, and turns it into an Automation Flow for the review
 * screen. The handoff is kept next to the Flow so the n8n builder can use it.
 */
export const DETECTOR_PIPE = "repeated-workflow-detector";
const POLL_MS = 2_000;
const RUN_TIMEOUT_MS = 5 * 60_000;

export function parseHandoff(value: unknown): AutomationHandoff | null {
  if (typeof value !== "object" || value === null) return null;
  const h = value as Partial<AutomationHandoff>;
  if (h.schema !== "screenpipe.automation-handoff/v1") return null;
  if (!h.trigger?.app || !h.target?.app || !h.evidence || !Array.isArray(h.examples)) return null;
  return h as AutomationHandoff;
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const words = (s = "") => new Set(slug(s).split("-").filter((w) => w.length >= 4));

/** Share of examples whose created record reuses most of the message's words. */
function copiedText(examples: HandoffExample[]): number {
  return examples.filter((e) => {
    const source = words(e.input.text);
    if (source.size < 5) return false;
    const target = words(e.output.text);
    let shared = 0;
    for (const w of source) if (target.has(w)) shared++;
    return shared / source.size >= 0.3;
  }).length;
}

/** A reply quoted in the message thread means the user asked the sender for more before creating. */
const askedSender = (e: HandoffExample) => /(a écrit|wrote)\s*:/i.test(e.input.text ?? "");

function dayRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const a = fmt.format(new Date(start));
  const b = fmt.format(new Date(end));
  return a === b ? a : `${a}–${b}`;
}

export function detectedFlowId(h: AutomationHandoff): string {
  return `detected-${slug(h.trigger.app)}-${slug(h.target.app)}`.slice(0, 64);
}

export function handoffToFlow(h: AutomationHandoff): AutomationFlow {
  const source = h.trigger.app;
  const target = h.target.app;
  const isEmail = Boolean(h.trigger.account?.includes("@"));
  const unit = isEmail ? "email" : "message";
  const noun = h.target.keyPrefix ? "ticket" : "record";
  const where = h.target.keyPrefix ? ` in project ${h.target.keyPrefix}` : "";
  const inbox = h.trigger.account ?? source;
  const n = h.evidence.occurrences;
  const copied = copiedText(h.examples);
  const clarified = h.examples.filter(askedSender).length;

  const questions: FlowQuestion[] = [
    {
      id: "review-before-create",
      topic: "Review",
      question: `Create each ${noun} directly, or show you a draft first?`,
      context: `You created all ${n} by hand.`,
      ruleGroup: "create",
      choices: [
        { id: "draft", label: "Show me a draft", answer: `You approve each ${noun} before it is created.`,
          rule: { group: "create", when: "Draft ready", then: "Wait for you", fromYou: true } },
        { id: "direct", label: "Create directly", answer: `${target} ${noun}s are created without review.`,
          rule: { group: "create", when: "Request received", then: "Create at once", fromYou: true } },
      ],
    },
    {
      id: "incomplete-request",
      topic: "Incomplete requests",
      question: `What if the ${unit} does not say what is wrong?`,
      context: clarified
        ? `${clarified === 1 ? "Once" : `${clarified} times`}, you asked the sender for details before creating the ${noun}.`
        : `Not seen in your examples.`,
      ruleGroup: "trigger",
      choices: [
        { id: "ask-sender", label: "Ask the sender", answer: `The sender gets a reply asking for details; the ${noun} waits.`,
          rule: { group: "trigger", when: "Details missing", then: "Ask the sender", fromYou: clarified > 0 } },
        { id: "create-anyway", label: `Create the ${noun} anyway`, answer: `A ${noun} is created with what the ${unit} says.` },
      ],
    },
    {
      id: "reply-with-key",
      topic: "Reply",
      question: `Reply to the sender with the ${noun} number?`,
      context: "Not seen in your examples.",
      ruleGroup: "create",
      choices: [
        { id: "reply", label: "Reply with the number", answer: `The sender gets the ${noun} number by ${unit}.`,
          rule: { group: "create", when: `${noun[0].toUpperCase()}${noun.slice(1)} created`, then: "Reply with its number", fromYou: true } },
        { id: "no-reply", label: "No reply", answer: "Nobody is notified." },
      ],
    },
  ];

  return {
    id: detectedFlowId(h),
    title: `Create a ${target} ${noun} for each ${unit} in ${source}`,
    learnedFrom: `Learned from ${n} times you did it, ${dayRange(h.detector.range.start, h.detector.range.end)}`,
    summary: `When an ${unit} reaches ${inbox}, create a ${target} ${noun}${where} from it.`,
    checks: [
      `${n} times in ${h.evidence.sessions} session${h.evidence.sessions === 1 ? "" : "s"} (${h.evidence.starredOccurrences} starred)`,
      ...(copied ? [`${unit[0].toUpperCase()}${unit.slice(1)} text reused in ${copied} of ${h.examples.length} ${noun}s`] : []),
      `Back to ${source} after ${h.evidence.returnedToSource} ${noun}s`,
    ],
    questions,
    // Short "if → then" lines: the review screen sizes the "then" column to its text.
    ruleGroups: [
      { id: "trigger", title: `Incoming ${unit}s` },
      { id: "create", title: `${target} ${noun}s` },
    ],
    rules: [
      { group: "trigger", when: `Sent to ${inbox}`, then: "Start the Flow" },
      { group: "create", when: "Request received", then: `New ${noun}${h.target.keyPrefix ? ` in ${h.target.keyPrefix}` : ""}` },
      { group: "create", when: "Summary", then: `${unit[0].toUpperCase()}${unit.slice(1)} subject` },
      { group: "create", when: "Description", then: `${unit[0].toUpperCase()}${unit.slice(1)} text` },
    ],
    unit: `${unit}s`,
    steps: [
      { title: `${source} trigger`, detail: `New ${unit} in ${inbox}` },
      { title: "Read the request", detail: "Subject, sender and text" },
      { title: `Create ${target} ${noun}`, detail: h.target.keyPrefix ? `Project ${h.target.keyPrefix}` : undefined },
      { title: `Reply in ${source}`, detail: "Only if you choose to" },
    ],
    n8n: { workflowId: null },
  };
}

export type DetectionDeps = {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  readText: (path: string) => Promise<string>;
  dataDir: () => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

async function json(response: Response, what: string) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${what} failed: HTTP ${response.status}${body?.error ? ` — ${body.error}` : ""}`);
  return body;
}

/**
 * Runs the detector once and returns the Flow it found, or null when no
 * repeated work clears its threshold. Throws with the Pipe's own error.
 */
export async function findAutomation(deps: DetectionDeps): Promise<DetectedFlow | null> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  // Installing an already installed Pipe keeps the local copy and is a no-op.
  await json(await deps.fetch(`/pipes/bundled/${DETECTOR_PIPE}/install`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), "Installing the detector");
  const startedAt = now();
  const started = await json(await deps.fetch(`/pipes/${DETECTOR_PIPE}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), "Starting the detector");
  const executionId = started?.execution_id;
  if (!Number.isInteger(executionId)) throw new Error("The detector did not start a tracked run.");

  const deadline = now() + RUN_TIMEOUT_MS;
  for (;;) {
    const { data } = await json(await deps.fetch(`/pipes/${DETECTOR_PIPE}/executions/${executionId}`), "Checking the detector");
    if (data?.status === "completed") break;
    if (["failed", "cancelled", "timed_out", "interrupted"].includes(data?.status)) {
      throw new Error(`The detector ${data.status}${data.error_message ? `: ${data.error_message}` : "."}`);
    }
    if (now() > deadline) throw new Error("The detector is still running after 5 minutes.");
    await sleep(POLL_MS);
  }

  const dir = (await deps.dataDir()).replace(/\/+$/, "");
  const raw = await deps.readText(`${dir}/pipes/${DETECTOR_PIPE}/output/handoff.json`).catch(() => null);
  const handoff = raw ? parseHandoff(JSON.parse(raw)) : null;
  // No handoff, or one left over from an earlier run: nothing cleared the threshold this time.
  if (!handoff || Date.parse(handoff.generatedAt) < startedAt - 5_000) return null;
  return { flow: handoffToFlow(handoff), handoff };
}

/** Desktop app wiring: the local API, the engine's data directory and the Tauri file API. */
export async function desktopDetectionDeps(): Promise<DetectionDeps> {
  const [{ readTextFile }, { commands }] = await Promise.all([import("@tauri-apps/plugin-fs"), import("@/lib/utils/tauri")]);
  return {
    fetch: (path, init) => localFetch(path, init),
    readText: (path) => readTextFile(path),
    dataDir: async () => {
      const res = await commands.getActiveDataDir();
      if (res.status === "error") throw new Error(res.error);
      return res.data;
    },
  };
}
