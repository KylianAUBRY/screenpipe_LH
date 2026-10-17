// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import type { AutomationFlow, FlowAnswer, FlowQuestion, FlowRule } from "./types";

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

/** Group ids in display order: the declared ones, then any only rules use. */
function groupOrder(flow: AutomationFlow, rules: FlowRule[]): string[] {
  return [...new Set([...flow.ruleGroups.map((group) => group.id), ...rules.map((rule) => rule.group)])];
}

/** Base rules plus the ones added by the user's answers, in reading order. */
export function effectiveRules(flow: AutomationFlow, answers: FlowAnswers): FlowRule[] {
  const added: FlowRule[] = [];
  for (const question of flow.questions) {
    const answer = answers[question.id];
    if (!validAnswer(question, answer) || !answer) continue;
    if (isCustom(answer)) {
      added.push({
        group: question.ruleGroup ?? flow.ruleGroups[0]?.id ?? "rules",
        when: `${question.topic}: “${answer.custom.trim()}”`,
        then: "As you wrote it",
        fromYou: true,
      });
    } else {
      const rule = question.choices.find((choice) => choice.id === answer.choiceId)?.rule;
      if (rule) added.push(rule);
    }
  }
  // Each learned rule sits at the end of the group it adjusts.
  return groupOrder(flow, [...flow.rules, ...added]).flatMap((group) => [
    ...flow.rules.filter((rule) => rule.group === group),
    ...added.filter((rule) => rule.group === group),
  ]);
}

/** Rules split into the Flow's blocks, empty blocks left out. */
export function ruleGroups(
  flow: AutomationFlow,
  answers: FlowAnswers,
): { id: string; title: string; rules: FlowRule[] }[] {
  const rules = effectiveRules(flow, answers);
  return groupOrder(flow, rules)
    .map((id) => ({
      id,
      title: flow.ruleGroups.find((group) => group.id === id)?.title ?? id,
      rules: rules.filter((rule) => rule.group === id),
    }))
    .filter((entry) => entry.rules.length > 0);
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
