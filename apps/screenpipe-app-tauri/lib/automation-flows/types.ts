// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

export type FlowQuestionChoice = {
  id: string;
  /** Pill label. */
  label: string;
  /** Sentence shown once the question is answered with this choice. */
  answer: string;
  /** Past cases that now match what the user did, once this choice is applied. */
  fixesReplay?: number;
};

/** A point the AI could not settle alone. TURN ON stays disabled until each one is answered. */
export type FlowQuestion = {
  id: string;
  question: string;
  /** Where the question comes from, e.g. what the user said or did once. */
  context?: string;
  choices: FlowQuestionChoice[];
  placeholder?: string;
};

/** One time the user did the task by hand, shown as proof on the review screen. */
export type FlowEvidence = {
  /** When it happened, ISO 8601. "View in timeline" opens the timeline there. */
  at: string;
  /** What the user did, one short sentence. */
  label: string;
  /** screenpipe frame id of a capture of that moment (`frame_id` in /search results). */
  frameId?: number;
  /** Capture as an image URL, used when there is no frame id (e.g. an exported screenshot). */
  imageUrl?: string;
  /** App where it happened, e.g. "Gmail". */
  app?: string;
};

/**
 * Review material for an Automation Flow. The n8n workflow is the source of
 * truth for what runs; this only describes it for the review screen. Flows
 * come from a FlowSource (see source.ts), never from data bundled in the app.
 */
export type AutomationFlow = {
  id: string;
  title: string;
  /** Provenance line, e.g. "Learned from 7 tasks you did, Oct 14–16". */
  learnedFrom: string;
  /** One plain sentence saying what the Flow automates. */
  summary: string;
  /** Short outcomes shown as checks under the summary. */
  checks: string[];
  /** The repetitions the Flow was learned from, oldest first. */
  evidence?: FlowEvidence[];
  questions: FlowQuestion[];
  /** What the Flow handles, plural, used in the screen's text (e.g. "emails"). Defaults to "cases". */
  unit?: string;
  /** Replay of the Flow on the cases it was learned from, before any answer. */
  replay?: { total: number; matched: number };
  /** Text shown in the "View graph" dialog, one line per n8n node. */
  steps: { title: string; detail?: string }[];
  n8n: { workflowId: string | null };
};

export type FlowAnswer = { choiceId: string } | { custom: string };

/** "dismissed": the user dismissed it; it stays listed and can be restored. */
export type FlowStatus = "waiting" | "running" | "paused" | "dismissed";
