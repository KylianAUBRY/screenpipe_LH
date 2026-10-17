// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import type { AutomationFlow } from "../types";

/** Neutral Flow used by the tests. Real proposals come from a FlowSource. */
export const EXAMPLE_FLOW: AutomationFlow = {
  id: "example-flow",
  title: "Example flow",
  learnedFrom: "Learned from 4 examples",
  summary: "Does the example task for you.",
  checks: ["First outcome", "Second outcome", "Third outcome"],
  unit: "examples",
  questions: [
    {
      id: "pick-option",
      question: "Which option should apply?",
      context: "Seen once",
      choices: [
        { id: "option-a", label: "Option A", answer: "Option A applies", fixesReplay: 1 },
        { id: "option-b", label: "Option B", answer: "Option B applies" },
        { id: "neither", label: "Neither", answer: "Nothing changes" },
      ],
      placeholder: "Describe what it should do",
    },
    {
      id: "explain",
      question: "Why did you do it differently?",
      choices: [
        { id: "reason-x", label: "Reason X", answer: "Reason X applies", fixesReplay: 1 },
        { id: "reason-y", label: "Reason Y", answer: "Reason Y applies" },
      ],
    },
  ],
  replay: { total: 4, matched: 2 },
  steps: [{ title: "Step one", detail: "first" }],
  n8n: { workflowId: null },
};
