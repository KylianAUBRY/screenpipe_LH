// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_FLOW as flow } from "@/lib/automation-flows/__fixtures__/example-flow";
import { setFlowBackend, demoFlowBackend } from "@/lib/automation-flows/backend";
import { useAutomationFlowStore } from "@/lib/automation-flows/store";
import { FlowReview } from "./flow-review";

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));

describe("flow review screen", () => {
  beforeEach(() => {
    useAutomationFlowStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    setFlowBackend(demoFlowBackend);
  });

  it("enables TURN ON only once both questions are answered, free text included", async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    setFlowBackend({ activate, deactivate: vi.fn().mockResolvedValue(undefined) });
    render(<FlowReview flow={flow} onBack={() => {}} />);

    const turnOn = () => screen.getByTestId("flow-turn-on") as HTMLButtonElement;
    expect(turnOn().disabled).toBe(true);
    expect(screen.getByText("2 questions before it can run")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Option A" }));
    expect(screen.getByText("Option A applies")).toBeTruthy();
    expect(turnOn().disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Other answer…" }));
    const saveButton = screen.getByRole("button", { name: "SAVE ANSWER" }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Your answer, in your own words"), {
      target: { value: "Because of Z" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAVE ANSWER" }));

    expect(screen.getByText("Your answer: “Because of Z”")).toBeTruthy();
    const status = screen.getByTestId("flow-status").textContent;
    expect(status).toContain("Ready to turn on");
    expect(status).toContain("same choices as you on 3 of your last 4 examples");
    expect(screen.getByTestId("flow-questions").textContent).toContain("Your own answers apply to new examples.");
    expect(screen.getAllByRole("button", { name: /TURN ON/ })).toHaveLength(1);
    expect(screen.getByTestId("flow-header").className).toContain("sticky");
    expect(turnOn().disabled).toBe(false);

    fireEvent.click(turnOn());
    await waitFor(() => expect(screen.getByTestId("flow-pause")).toBeTruthy());
    expect(activate).toHaveBeenCalledWith(flow);
    expect(useAutomationFlowStore.getState().flows[flow.id]?.status).toBe("running");
    expect(screen.getByTestId("flow-status").textContent).toContain("Watching for new examples");
  });

  it("keeps the Flow off when the backend refuses to activate it", async () => {
    setFlowBackend({ activate: vi.fn().mockRejectedValue(new Error("n8n is down")), deactivate: vi.fn() });
    useAutomationFlowStore.getState().setAnswer(flow.id, "pick-option", { choiceId: "neither" });
    useAutomationFlowStore.getState().setAnswer(flow.id, "explain", { choiceId: "reason-y" });
    render(<FlowReview flow={flow} onBack={() => {}} />);

    fireEvent.click(screen.getByTestId("flow-turn-on"));
    await waitFor(() => expect((screen.getByTestId("flow-turn-on") as HTMLButtonElement).disabled).toBe(false));
    expect(useAutomationFlowStore.getState().flows[flow.id]?.status).toBe("waiting");
  });

  it("Not now moves the Flow to Dismissed and goes back to the list", () => {
    const onBack = vi.fn();
    render(<FlowReview flow={flow} onBack={onBack} />);

    fireEvent.click(screen.getByTestId("flow-not-now"));
    expect(useAutomationFlowStore.getState().flows[flow.id]?.status).toBe("dismissed");
    expect(onBack).toHaveBeenCalled();
  });

  it("a dismissed Flow offers RESTORE instead of TURN ON", () => {
    useAutomationFlowStore.getState().setStatus(flow.id, "dismissed");
    render(<FlowReview flow={flow} onBack={() => {}} />);

    expect(screen.getByTestId("flow-status").textContent).toContain("Dismissed");
    expect(screen.queryByTestId("flow-turn-on")).toBeNull();
    expect(screen.queryByTestId("flow-not-now")).toBeNull();
    fireEvent.click(screen.getByTestId("flow-restore"));
    expect(useAutomationFlowStore.getState().flows[flow.id]?.status).toBe("waiting");
    expect(screen.getByTestId("flow-turn-on")).toBeTruthy();
  });

  it("Change answers pauses a running Flow and brings the questions back", async () => {
    const deactivate = vi.fn().mockResolvedValue(undefined);
    setFlowBackend({ activate: vi.fn().mockResolvedValue(undefined), deactivate });
    const store = useAutomationFlowStore.getState();
    store.setAnswer(flow.id, "pick-option", { choiceId: "option-a" });
    store.setAnswer(flow.id, "explain", { custom: "Because of Z" });
    store.setStatus(flow.id, "running");
    render(<FlowReview flow={flow} onBack={() => {}} />);

    const answers = screen.getByTestId("flow-answers").textContent;
    expect(answers).toContain("Option A applies");
    expect(answers).toContain("Your answer: “Because of Z”");
    expect(screen.queryByTestId("flow-questions")).toBeNull();

    fireEvent.click(screen.getByTestId("flow-change-answers"));
    await waitFor(() => expect(screen.getByTestId("flow-questions")).toBeTruthy());
    expect(deactivate).toHaveBeenCalledWith(flow);
    expect(useAutomationFlowStore.getState().flows[flow.id]?.status).toBe("paused");
    expect(screen.getByTestId("flow-status").textContent).toContain("Paused");
    // Turning it on again stays an explicit action.
    expect((screen.getByTestId("flow-turn-on") as HTMLButtonElement).disabled).toBe(false);
    expect(useAutomationFlowStore.getState().flows[flow.id]?.status).not.toBe("running");
  });

  it("always shows the rules in the Flow's blocks, with the ones learned from the answers", () => {
    useAutomationFlowStore.getState().setAnswer(flow.id, "pick-option", { choiceId: "option-b" });
    render(<FlowReview flow={flow} onBack={() => {}} />);

    const main = screen.getByTestId("flow-rules-main");
    expect(main.textContent).toContain("Main rules");
    expect(main.textContent).toContain("Case B");
    expect(screen.getByTestId("flow-rules-other").textContent).toContain("Edge action");
    expect(screen.queryByRole("button", { name: /Rules/ })).toBeNull();
  });
});
