// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

/** One "if → then" line of a Flow's rules, shown on the review screen. */
export type FlowRule = {
  /** Id of the `ruleGroups` entry this rule belongs to. */
  group: string;
  when: string;
  then: string;
  /** True when the rule comes from the user's own handling or answers. */
  fromYou?: boolean;
};

export type FlowQuestionChoice = {
  id: string;
  /** Pill label. */
  label: string;
  /** Sentence shown once the question is answered with this choice. */
  answer: string;
  /** Rule this answer adds, if any. */
  rule?: FlowRule;
  /** Past cases that now match what the user did, once this choice is applied. */
  fixesReplay?: number;
};

/** A point the AI could not settle alone. TURN ON stays disabled until each one is answered. */
export type FlowQuestion = {
  id: string;
  /** Short name used for the rule a free-text answer adds. */
  topic: string;
  question: string;
  /** Where the question comes from, e.g. what the user said or did once. */
  context?: string;
  choices: FlowQuestionChoice[];
  placeholder?: string;
  /** Rule group a free-text answer goes to. Defaults to the first group. */
  ruleGroup?: string;
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
  questions: FlowQuestion[];
  /** Titles of the rule blocks, in display order. */
  ruleGroups: { id: string; title: string }[];
  rules: FlowRule[];
  /** What the Flow handles, plural, used in the screen's text (e.g. "emails"). Defaults to "cases". */
  unit?: string;
  /** Replay of the Flow on the cases it was learned from, before any answer. */
  replay?: { total: number; matched: number };
  /** Text shown in the "View graph" dialog, one line per n8n node. */
  steps: { title: string; detail?: string }[];
  n8n: { workflowId: string | null };
};

export type FlowAnswer = { choiceId: string } | { custom: string };

export type FlowStatus = "waiting" | "running" | "paused";
