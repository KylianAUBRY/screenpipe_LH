// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import type { AutomationFlow, FlowAnswer, FlowQuestion } from "./types";

export type FlowAnswers = Record<string, FlowAnswer | undefined>;

function isCustom(answer: FlowAnswer): answer is { custom: string } {
  return "custom" in answer;
}

/** Free-text answers must say something; an empty one does not count. */
function validAnswer(question: FlowQuestion, answer: FlowAnswer | undefined): boolean {
  if (!answer) return false;
  if (isCustom(answer)) return answer.custom.trim().length > 0;
  return question.choices.some((choice) => choice.id === answer.choiceId);
}

export function pendingQuestions(flow: AutomationFlow, answers: FlowAnswers): FlowQuestion[] {
  return flow.questions.filter((question) => !validAnswer(question, answers[question.id]));
}

/** Nothing activates while a question the AI could not settle is still open. */
export function canTurnOn(flow: AutomationFlow, answers: FlowAnswers): boolean {
  return pendingQuestions(flow, answers).length === 0;
}

/** Sentence shown once a question is answered, or null when it is still open. */
export function answerText(question: FlowQuestion, answer: FlowAnswer | undefined): string | null {
  if (!validAnswer(question, answer) || !answer) return null;
  if (isCustom(answer)) return `Your answer: “${answer.custom.trim()}”`;
  return question.choices.find((choice) => choice.id === answer.choiceId)?.answer ?? null;
}

/**
 * How many of the cases the Flow was learned from it now handles the way the
 * user did, or null without replay data. Free-text answers apply to new cases
 * only, so they do not move it.
 */
export function replayScore(flow: AutomationFlow, answers: FlowAnswers): number | null {
  if (!flow.replay) return null;
  let matched = flow.replay.matched;
  for (const question of flow.questions) {
    const answer = answers[question.id];
    if (!answer || isCustom(answer)) continue;
    matched += question.choices.find((choice) => choice.id === answer.choiceId)?.fixesReplay ?? 0;
  }
  return Math.min(matched, flow.replay.total);
}

export function hasCustomAnswer(flow: AutomationFlow, answers: FlowAnswers): boolean {
  return flow.questions.some((question) => {
    const answer = answers[question.id];
    return Boolean(answer && isCustom(answer) && answer.custom.trim());
  });
}
