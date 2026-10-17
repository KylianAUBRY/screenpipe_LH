// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { serializeWorkflowData, WorkflowsApp, type WorkflowsPlatform } from "@screenpipe/workflows-ui";
import { createFixtureWorkflowsPlatform } from "@screenpipe/workflows-ui/fixture";
import { buildDetectedTask, CLARIFICATION_QUESTIONS, DEMO_TASK_ID } from "@/lib/automation-flows/demo-task/detected-task";
import { upsertTask } from "@/lib/automation-flows/demo-task/catalog";
import { readWorkflowAnswers } from "../../../../packages/workflows-ui/src/workflow-answers";

// The Task Page of the scripted Detected Task, opened as the notification does.
const at = "2026-10-17T02:05:41Z";
const CREATE = "Create automation";

async function openTaskPage(extra: Partial<WorkflowsPlatform> = {}, taskId = DEMO_TASK_ID) {
  window.localStorage.clear(); window.sessionStorage.clear();
  window.history.replaceState(null, "", "/home?mode=workflows");
  const task = { ...buildDetectedTask(() => "data:image/webp;base64,AAAA", at), id: taskId };
  const catalog = JSON.parse(serializeWorkflowData(upsertTask(null, task, at)));
  const platform = { ...createFixtureWorkflowsPlatform(catalog), ...extra };
  await act(async () => {
    render(<WorkflowsApp platform={platform} storageKey={null} reviewRequest={{ key: "demo", workflowId: taskId }} />);
  });
  await screen.findByRole("textbox", { name: CLARIFICATION_QUESTIONS[0] });
  return platform;
}

const answer = (question: string, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: question }), { target: { value } });

describe("Task Page: Clarification Questions unlock Flow creation", () => {
  it("keeps the action disabled until every question is answered", async () => {
    await openTaskPage({ createAutomationFlow: vi.fn(async () => {}) });
    const create = screen.getByRole("button", { name: CREATE });
    expect(create).toBeDisabled();
    answer(CLARIFICATION_QUESTIONS[0], "Oui, en Tâche.");
    expect(create).toBeDisabled();
    answer(CLARIFICATION_QUESTIONS[1], "Blocking = Highest, workaround = Medium, idea = Low.");
    expect(create).toBeEnabled();
    answer(CLARIFICATION_QUESTIONS[0], "   ");
    expect(create).toBeDisabled();
  });

  it("leaves the page unchanged on hosts that cannot create Flows", async () => {
    await openTaskPage();
    expect(screen.queryByRole("button", { name: CREATE })).toBeNull();
    expect(screen.getByText("0 of 2 answered · All optional")).toBeVisible();
    expect(screen.getAllByRole("checkbox", { name: "Not sure" })).toHaveLength(2);
  });

  it("leaves the page unchanged for a task the host cannot turn into a Flow", async () => {
    const createAutomationFlow = vi.fn(async () => {});
    await openTaskPage({ createAutomationFlow, canCreateAutomationFlow: id => id === DEMO_TASK_ID }, "wf-other-task");
    expect(screen.queryByRole("button", { name: CREATE })).toBeNull();
    expect(screen.getByRole("heading", { name: "Help make this workflow accurate" })).toBeVisible();
    expect(screen.getByText("0 of 2 answered · All optional")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save answers" })).toBeDisabled();
    expect(screen.getAllByRole("checkbox", { name: "Not sure" })).toHaveLength(2);
    expect(createAutomationFlow).not.toHaveBeenCalled();
  });

  it("keeps the required mode for the task the host can turn into a Flow", async () => {
    await openTaskPage({ createAutomationFlow: vi.fn(async () => {}), canCreateAutomationFlow: id => id === DEMO_TASK_ID });
    expect(screen.getByRole("button", { name: CREATE })).toBeDisabled();
    expect(screen.queryByRole("checkbox", { name: "Not sure" })).toBeNull();
  });

  it("marks the questions as required when the host can create Flows", async () => {
    await openTaskPage({ createAutomationFlow: vi.fn(async () => {}) });
    expect(screen.getByText("0 of 2 answered · Required to create the automation")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Not sure" })).toBeNull();
  });

  it("words the question block for creating the automation", async () => {
    await openTaskPage({ createAutomationFlow: vi.fn(async () => {}), canCreateAutomationFlow: id => id === DEMO_TASK_ID });
    const block = within(screen.getByRole("region", { name: "Questions and feedback" }));
    expect(block.getByRole("heading", { name: "Help screenpipe understand this task" })).toBeVisible();
    expect(block.getByRole("button", { name: "Answer with voice" })).toBeVisible();
    expect(block.getByRole("textbox", { name: "Anything else to know?" })).toHaveAttribute("placeholder", "Another remark…");
    expect(block.getByRole("textbox", { name: CLARIFICATION_QUESTIONS[0] })).toHaveAttribute("placeholder", "Your answer…");
    // One way to confirm: creating the automation saves the answers first.
    expect(block.queryByRole("button", { name: "Save answers" })).toBeNull();
    expect(block.getByRole("button", { name: CREATE })).toBeDisabled();
    answer(CLARIFICATION_QUESTIONS[0], "Yes, as a Task.");
    expect(block.getByRole("button", { name: "Clear" })).toBeVisible();
    expect(block.getByLabelText("Answered")).toBeVisible();
    // Not the optional wording of other tasks.
    expect(block.queryByText(/All optional|Help make this workflow accurate/)).toBeNull();
  });

  it("creates the automation when the answers are confirmed with Enter, not only saves them", async () => {
    const createAutomationFlow = vi.fn(async () => {});
    await openTaskPage({ createAutomationFlow });
    answer(CLARIFICATION_QUESTIONS[0], "Yes, as a Task.");
    answer(CLARIFICATION_QUESTIONS[1], "Blocking = Highest.");
    fireEvent.submit(screen.getByRole("textbox", { name: CLARIFICATION_QUESTIONS[1] }).closest("form")!);
    await waitFor(() => expect(createAutomationFlow).toHaveBeenCalledTimes(1));
  });

  it("saves the answers, then asks the host once to create the Flow from the task", async () => {
    const order: string[] = [];
    const createAutomationFlow = vi.fn(async () => { order.push("create"); });
    const platform = await openTaskPage({ createAutomationFlow });
    const save = platform.saveWorkflowAnswers!;
    platform.saveWorkflowAnswers = vi.fn(async (...args) => { order.push("save"); return save(...args); });
    answer(CLARIFICATION_QUESTIONS[0], "Oui, en Tâche.");
    answer(CLARIFICATION_QUESTIONS[1], "Bloquant = Highest.");
    const create = screen.getByRole("button", { name: CREATE });
    fireEvent.click(create); fireEvent.click(create);
    await waitFor(() => expect(createAutomationFlow).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["save", "create"]);
    expect(createAutomationFlow).toHaveBeenCalledWith(DEMO_TASK_ID, [
      { question: CLARIFICATION_QUESTIONS[0], answer: "Oui, en Tâche." },
      { question: CLARIFICATION_QUESTIONS[1], answer: "Bloquant = Highest." },
    ]);
    // Persisted: the saved catalog holds both answers (read back below).
    const saved = (await platform.loadCapturedWork!(30))!.analysis.workflows.find(w => w.id === DEMO_TASK_ID)!;
    expect(readWorkflowAnswers(saved.userCorrection)).toEqual([
      { question: CLARIFICATION_QUESTIONS[0], answer: "Oui, en Tâche." },
      { question: CLARIFICATION_QUESTIONS[1], answer: "Bloquant = Highest." },
    ]);
  });

  it("keeps an answer being typed when the user leaves the page and comes back, without saving", async () => {
    const platform = await openTaskPage({ createAutomationFlow: vi.fn(async () => {}), canCreateAutomationFlow: id => id === DEMO_TASK_ID });
    const save = vi.spyOn(platform, "saveWorkflowAnswers");
    answer(CLARIFICATION_QUESTIONS[0], "Oui, en Tâche.");
    cleanup();
    await act(async () => {
      render(<WorkflowsApp platform={platform} storageKey={null} reviewRequest={{ key: "back", workflowId: DEMO_TASK_ID }} />);
    });
    expect(await screen.findByRole("textbox", { name: CLARIFICATION_QUESTIONS[0] })).toHaveValue("Oui, en Tâche.");
    expect(screen.getByRole("textbox", { name: CLARIFICATION_QUESTIONS[1] })).toHaveValue("");
    expect(save).not.toHaveBeenCalled();
  });

  it("shows why creation failed, keeps the answers and allows a retry", async () => {
    const createAutomationFlow = vi.fn()
      .mockRejectedValueOnce(new Error("n8n is not set up."))
      .mockResolvedValue(undefined);
    await openTaskPage({ createAutomationFlow });
    answer(CLARIFICATION_QUESTIONS[0], "Oui, en Tâche.");
    answer(CLARIFICATION_QUESTIONS[1], "Bloquant = Highest.");
    fireEvent.click(screen.getByRole("button", { name: CREATE }));
    expect(await screen.findByText("n8n is not set up.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("textbox", { name: CLARIFICATION_QUESTIONS[0] })).toHaveValue("Oui, en Tâche.");
    fireEvent.click(screen.getByRole("button", { name: CREATE }));
    await waitFor(() => expect(createAutomationFlow).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("n8n is not set up.")).toBeNull());
  });
});
