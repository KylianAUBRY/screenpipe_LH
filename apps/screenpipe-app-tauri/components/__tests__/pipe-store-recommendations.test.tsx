// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipeStoreView } from "@/components/pipe-store";
import { EXAMPLE_FLOW } from "@/lib/automation-flows/__fixtures__/example-flow";
import { useAutomationFlowStore } from "@/lib/automation-flows/store";

vi.mock("@/lib/api", () => ({
  localFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as unknown as Response),
}));
vi.mock("@/lib/hooks/use-settings", () => ({ useSettings: () => ({ settings: { user: null } }) }));
vi.mock("@/lib/hooks/use-event-listener", () => ({ useEventListener: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/settings/pipes-section", () => ({ PipesSection: () => <div>installed tasks</div> }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/pipe-store-submission", () => ({ PipeStoreSubmissionDialog: () => null }));
vi.mock("@/lib/stores/feedback-store", () => ({ useFeedbackStore: () => vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

describe("Automations > Recommendations", () => {
  beforeEach(() => {
    useAutomationFlowStore.getState().reset();
    useAutomationFlowStore.setState({ catalog: [EXAMPLE_FLOW], catalogLoaded: true });
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("opens the review screen from ?tab=recommendations&flow= and strips the query", () => {
    window.history.replaceState({}, "", "/home?section=pipes&tab=recommendations&flow=example-flow");
    render(<PipeStoreView />);

    expect(screen.getByTestId("flow-questions")).toBeTruthy();
    expect(window.location.search).toBe("?section=pipes");
  });

  it("keeps a requested tab even for users with no installed task", async () => {
    window.history.replaceState({}, "", "/home?section=pipes&tab=recommendations");
    render(<PipeStoreView />);

    // The installed count (0) arrives after mount; it must not switch to Discover.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("flow-row-example-flow")).toBeTruthy();

    fireEvent.click(screen.getByTestId("tab-my-pipes"));
    expect(screen.getByText("installed tasks")).toBeTruthy();
  });
});
