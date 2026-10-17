// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_FLOW } from "@/lib/automation-flows/__fixtures__/example-flow";
import { localFileFlowSource, setFlowSource } from "@/lib/automation-flows/source";
import { useAutomationFlowStore } from "@/lib/automation-flows/store";
import { FlowsView } from "./flows-view";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), send: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@/lib/automation-flows/notification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/automation-flows/notification")>()),
  sendFlowProposalNotification: mocks.send,
}));

type DevWindow = Window & { __SCREENPIPE_BROWSER_RUNTIME_INSTALLED__?: boolean };
const ROW = `flow-row-${EXAMPLE_FLOW.id}`;

function Harness({ initial = null }: { initial?: string | null }) {
  const [openFlowId, setOpenFlowId] = useState<string | null>(initial);
  return <FlowsView openFlowId={openFlowId} onOpenFlow={setOpenFlowId} />;
}

describe("Flow tab", () => {
  beforeEach(() => {
    useAutomationFlowStore.getState().reset();
    useAutomationFlowStore.setState({ catalog: [EXAMPLE_FLOW], catalogLoaded: true });
    mocks.toast.mockReset();
    mocks.send.mockReset();
  });
  afterEach(() => {
    cleanup();
    setFlowSource(localFileFlowSource);
    delete (window as DevWindow).__SCREENPIPE_BROWSER_RUNTIME_INSTALLED__;
  });

  it("loads the Flows from the FlowSource, and shows an empty state without any", async () => {
    useAutomationFlowStore.setState({ catalog: [], catalogLoaded: false });
    setFlowSource({ load: async () => [] });
    render(<Harness />);

    expect(await screen.findByTestId("flows-empty")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send test notification" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the notification in-page in the browser dev loop, and Open opens the review", () => {
    (window as DevWindow).__SCREENPIPE_BROWSER_RUNTIME_INSTALLED__ = true;
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Send test notification" }));
    const preview = screen.getByTestId("flow-notification-preview");
    expect(preview.textContent).toContain("New automation: example flow");
    expect(mocks.send).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.queryByTestId("flow-notification-preview")).toBeNull();
    expect(screen.getByTestId("flow-questions")).toBeTruthy();
  });

  it("in the desktop app, says so when screenpipe skips the notification", async () => {
    mocks.send.mockResolvedValue({ shown: false, message: "duplicate notification suppressed" });
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Send test notification" }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "screenpipe did not show the notification",
          description: "duplicate notification suppressed",
        }),
      ),
    );
    expect(screen.queryByTestId("flow-notification-preview")).toBeNull();
  });

  it("lists the proposal under Waiting for you and opens its review", () => {
    render(<Harness />);
    expect(screen.getByText("Waiting for you")).toBeTruthy();
    expect(screen.getByTestId(ROW).textContent).toContain("2 questions to answer");

    fireEvent.click(screen.getByTestId(ROW));
    expect(screen.getByText(EXAMPLE_FLOW.summary)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to Flow" }));
    expect(screen.getByTestId(ROW)).toBeTruthy();
  });

  it("opens the review directly when asked for a known Flow, and ignores unknown ids", () => {
    const { unmount } = render(<Harness initial={EXAMPLE_FLOW.id} />);
    expect(screen.getByTestId("flow-questions")).toBeTruthy();
    unmount();

    render(<Harness initial="unknown-flow" />);
    expect(screen.getByTestId(ROW)).toBeTruthy();
  });

  it("lists a dismissed Flow under Dismissed, and RESTORE brings it back", () => {
    useAutomationFlowStore.getState().setStatus(EXAMPLE_FLOW.id, "dismissed");
    render(<Harness />);

    expect(screen.getByText("Dismissed")).toBeTruthy();
    expect(screen.queryByText("Waiting for you")).toBeNull();
    expect(screen.getByTestId(ROW).textContent).toContain("dismissed");

    fireEvent.click(screen.getByTestId(`flow-restore-${EXAMPLE_FLOW.id}`));
    expect(screen.getByText("Waiting for you")).toBeTruthy();
    expect(screen.queryByText("Dismissed")).toBeNull();
  });

  it("moves a running Flow to the Running group", () => {
    useAutomationFlowStore.getState().setStatus(EXAMPLE_FLOW.id, "running");
    render(<Harness />);
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.queryByText("Waiting for you")).toBeNull();
  });
});
