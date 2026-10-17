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
      topic: "Options",
      question: "Which option should apply?",
      context: "Seen once",
      ruleGroup: "main",
      choices: [
        {
          id: "option-a",
          label: "Option A",
          answer: "Option A applies",
          rule: { group: "main", when: "Case A", then: "Do A", fromYou: true },
          fixesReplay: 1,
        },
        {
          id: "option-b",
          label: "Option B",
          answer: "Option B applies",
          rule: { group: "main", when: "Case B", then: "Do B", fromYou: true },
        },
        { id: "neither", label: "Neither", answer: "Nothing changes" },
      ],
      placeholder: "Describe the rule",
    },
    {
      id: "explain",
      topic: "Reasons",
      question: "Why did you do it differently?",
      ruleGroup: "main",
      choices: [
        { id: "reason-x", label: "Reason X", answer: "Reason X applies", fixesReplay: 1 },
        { id: "reason-y", label: "Reason Y", answer: "Reason Y applies" },
      ],
    },
  ],
  ruleGroups: [
    { id: "main", title: "Main rules" },
    { id: "other", title: "Other rules" },
  ],
  rules: [
    { group: "main", when: "Base case", then: "Base action" },
    { group: "other", when: "Edge case", then: "Edge action" },
  ],
  replay: { total: 4, matched: 2 },
  steps: [{ title: "Step one", detail: "first" }],
  n8n: { workflowId: null },
};
