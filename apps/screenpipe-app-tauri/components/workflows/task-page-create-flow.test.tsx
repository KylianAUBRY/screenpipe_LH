// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { serializeWorkflowData, WorkflowsApp, type WorkflowsPlatform } from "@screenpipe/workflows-ui";
import { createFixtureWorkflowsPlatform } from "@screenpipe/workflows-ui/fixture";
import { buildDetectedTask, CLARIFICATION_QUESTIONS, DEMO_TASK_ID } from "../../../../infra/automation-flows/demo/detected-task";
import { upsertTask } from "../../../../infra/automation-flows/demo/catalog";
import { readWorkflowAnswers } from "../../../../packages/workflows-ui/src/workflow-answers";

// The Task Page of the scripted Detected Task, opened as the notification does.
const at = "2026-10-17T02:05:41Z";
const CREATE = "Créer l'automatisation";

async function openTaskPage(extra: Partial<WorkflowsPlatform> = {}) {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/home?mode=workflows");
  const catalog = JSON.parse(serializeWorkflowData(upsertTask(null, buildDetectedTask(() => "data:image/webp;base64,AAAA", at), at)));
  const platform = { ...createFixtureWorkflowsPlatform(catalog), ...extra };
  await act(async () => {
    render(<WorkflowsApp platform={platform} storageKey={null} reviewRequest={{ key: "demo", workflowId: DEMO_TASK_ID }} />);
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
    answer(CLARIFICATION_QUESTIONS[1], "Bloquant = Highest, contournement = Medium, idée = Low.");
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

  it("marks the questions as required when the host can create Flows", async () => {
    await openTaskPage({ createAutomationFlow: vi.fn(async () => {}) });
    expect(screen.getByText("0 of 2 answered · Required to create the automation")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Not sure" })).toBeNull();
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

  it("shows why creation failed, keeps the answers and allows a retry", async () => {
    const createAutomationFlow = vi.fn()
      .mockRejectedValueOnce(new Error("n8n n'est pas configuré."))
      .mockResolvedValue(undefined);
    await openTaskPage({ createAutomationFlow });
    answer(CLARIFICATION_QUESTIONS[0], "Oui, en Tâche.");
    answer(CLARIFICATION_QUESTIONS[1], "Bloquant = Highest.");
    fireEvent.click(screen.getByRole("button", { name: CREATE }));
    expect(await screen.findByText("n8n n'est pas configuré.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("textbox", { name: CLARIFICATION_QUESTIONS[0] })).toHaveValue("Oui, en Tâche.");
    fireEvent.click(screen.getByRole("button", { name: CREATE }));
    await waitFor(() => expect(createAutomationFlow).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("n8n n'est pas configuré.")).toBeNull());
  });
});
