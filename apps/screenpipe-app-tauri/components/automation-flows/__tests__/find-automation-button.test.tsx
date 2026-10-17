// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FindAutomationButton } from "../find-automation-button";
import type { FindAutomationResult } from "@/lib/automation-flows/find-automation";

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("FindAutomationButton", () => {
  it("shows the search while it runs, then leaves the Task Page to the notification", async () => {
    const search = deferred<FindAutomationResult>();
    const openTask = vi.fn(async () => {});
    render(<FindAutomationButton find={() => search.promise} openTask={openTask} />);

    fireEvent.click(screen.getByRole("button", { name: "Find an automation" }));
    const busy = screen.getByRole("button", { name: "Searching your activity…" });
    expect(busy.hasAttribute("disabled")).toBe(true);

    await act(async () => search.resolve({ notified: true }));
    expect(screen.getByRole("button", { name: "Find an automation" }).hasAttribute("disabled")).toBe(false);
    expect(openTask).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("opens the Task Page itself, and says why, when the notification is not shown", async () => {
    const openTask = vi.fn(async () => {});
    render(<FindAutomationButton find={async () => ({ notified: false, reason: "duplicate notification suppressed" })} openTask={openTask} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Find an automation" })));
    expect(openTask).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Notification not shown",
      description: expect.stringContaining("duplicate notification suppressed"),
    }));
  });

  it("reports a failed search and opens nothing", async () => {
    const openTask = vi.fn(async () => {});
    render(<FindAutomationButton find={async () => { throw new Error("The saved workflow catalog is unreadable."); }} openTask={openTask} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Find an automation" })));
    expect(openTask).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Could not look for an automation",
      description: "The saved workflow catalog is unreadable.",
      variant: "destructive",
    }));
  });
});
