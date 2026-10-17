// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import { describe, expect, it } from "vitest";
import { EXAMPLE_FLOW as flow } from "./__fixtures__/example-flow";
import { answerText, canTurnOn, hasCustomAnswer, pendingQuestions, replayScore } from "./review";

const [pick, explain] = flow.questions;

describe("automation flow review", () => {
  it("keeps TURN ON blocked until every question is answered", () => {
    expect(pendingQuestions(flow, {})).toHaveLength(2);
    expect(canTurnOn(flow, {})).toBe(false);

    const oneAnswer = { [pick.id]: { choiceId: "option-a" } };
    expect(pendingQuestions(flow, oneAnswer).map((q) => q.id)).toEqual([explain.id]);
    expect(canTurnOn(flow, oneAnswer)).toBe(false);

    expect(canTurnOn(flow, { ...oneAnswer, [explain.id]: { choiceId: "reason-x" } })).toBe(true);
  });

  it("counts a free-text answer only when it says something", () => {
    expect(canTurnOn(flow, { [pick.id]: { choiceId: "neither" }, [explain.id]: { custom: "   " } })).toBe(false);
    const answers = { [pick.id]: { choiceId: "neither" }, [explain.id]: { custom: " Because of Z " } };
    expect(canTurnOn(flow, answers)).toBe(true);
    expect(answerText(explain, answers[explain.id])).toBe("Your answer: “Because of Z”");
    expect(hasCustomAnswer(flow, answers)).toBe(true);
  });

  it("ignores answers that point at an unknown choice", () => {
    expect(canTurnOn(flow, { [pick.id]: { choiceId: "nope" }, [explain.id]: { choiceId: "reason-y" } })).toBe(false);
  });

  it("raises the replay score only for answers that fix past cases", () => {
    expect(replayScore(flow, {})).toBe(2);
    expect(replayScore(flow, { [pick.id]: { choiceId: "option-a" }, [explain.id]: { choiceId: "reason-x" } })).toBe(4);
    expect(replayScore(flow, { [pick.id]: { choiceId: "option-b" }, [explain.id]: { custom: "x" } })).toBe(2);
    expect(replayScore({ ...flow, replay: undefined }, {})).toBeNull();
  });
});
