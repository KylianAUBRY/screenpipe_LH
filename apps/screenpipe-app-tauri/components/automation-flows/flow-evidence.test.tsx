// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowEvidence as Evidence } from "@/lib/automation-flows/types";
import { FlowEvidence } from "./flow-evidence";

const mocks = vi.hoisted(() => ({ push: vi.fn(), setPendingNavigation: vi.fn(), emit: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@tauri-apps/api/event", () => ({ emit: mocks.emit }));
vi.mock("@/lib/hooks/use-timeline-store", () => ({
  useTimelineStore: (select: (store: { setPendingNavigation: typeof mocks.setPendingNavigation }) => unknown) =>
    select({ setPendingNavigation: mocks.setPendingNavigation }),
}));

const EVIDENCE: Evidence[] = [
  { at: "2026-10-14T09:12:00.000Z", label: "Did the task once", frameId: 42, app: "Example app" },
  { at: "2026-10-15T16:40:00.000Z", label: "Did it again" },
];

describe("flow evidence", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows each repetition with its capture, or a placeholder without one", () => {
    render(<FlowEvidence evidence={EVIDENCE} unit="examples" />);

    expect(screen.getByText("The 2 examples you handled by hand.")).toBeTruthy();
    expect(screen.getAllByTestId("flow-evidence-item")).toHaveLength(2);
    const capture = screen.getByRole("img", { name: "Screen capture: Did the task once" }) as HTMLImageElement;
    expect(capture.src).toContain("/frames/42");
    expect(screen.getByText("No capture")).toBeTruthy();

    fireEvent.error(capture);
    expect(screen.getAllByText("No capture")).toHaveLength(2);
  });

  it("falls back to the image URL when there is no screenpipe frame", () => {
    render(
      <FlowEvidence
        evidence={[
          { at: "2026-10-14T09:12:00.000Z", label: "With both", frameId: 7, imageUrl: "/shot-a.png" },
          { at: "2026-10-15T09:12:00.000Z", label: "Image only", imageUrl: "/shot-b.png" },
        ]}
        unit="examples"
      />,
    );
    expect((screen.getByRole("img", { name: "Screen capture: With both" }) as HTMLImageElement).src).toContain("/frames/7");
    expect((screen.getByRole("img", { name: "Screen capture: Image only" }) as HTMLImageElement).src).toContain("/shot-b.png");
  });

  it("opens the timeline at the moment of the repetition", () => {
    vi.useFakeTimers();
    render(<FlowEvidence evidence={EVIDENCE} unit="examples" />);

    fireEvent.click(screen.getAllByRole("button", { name: "View in timeline" })[1]);
    expect(mocks.setPendingNavigation).toHaveBeenCalledWith({ timestamp: "2026-10-15T16:40:00.000Z" });
    expect(mocks.push).toHaveBeenCalledWith("/home?section=timeline");
    vi.advanceTimersByTime(250);
    expect(mocks.emit).toHaveBeenCalledWith("navigate-to-timestamp", "2026-10-15T16:40:00.000Z");
  });

  it("renders nothing without repetitions", () => {
    render(<FlowEvidence evidence={[]} unit="examples" />);
    expect(screen.queryByTestId("flow-evidence")).toBeNull();
  });
});
