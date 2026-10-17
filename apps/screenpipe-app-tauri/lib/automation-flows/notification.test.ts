// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import { afterEach, describe, expect, it, vi } from "vitest";
import { routeNotificationDeeplink, windowForDeeplink } from "@/lib/notifications/actions";
import { EXAMPLE_FLOW as flow } from "./__fixtures__/example-flow";
import {
  automationFlowDeeplink,
  automationFlowLink,
  buildFlowProposalNotification,
  isBrowserDevRuntime,
  OPEN_AUTOMATION_FLOW_EVENT,
  sendFlowProposalNotification,
} from "./notification";

const appServer = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/notifications/app-server", () => ({ appServerFetch: appServer.fetch }));

function notifyResponse(message: string): Response {
  return { ok: true, status: 200, json: async () => ({ success: true, message }) } as Response;
}

describe("automation flow notification", () => {
  it("parses only well-formed automation flow links", () => {
    expect(automationFlowLink(automationFlowDeeplink(flow.id))).toEqual({ flowId: flow.id });
    expect(automationFlowLink("screenpipe://automation-flow")).toBeNull();
    expect(automationFlowLink("screenpipe://automation-flow?id=../etc")).toBeNull();
    expect(automationFlowLink("https://automation-flow?id=example-flow")).toBeNull();
    expect(automationFlowLink("not a url")).toBeNull();
  });

  it("builds a notification whose primary action opens the review screen", () => {
    const payload = buildFlowProposalNotification(flow, 2);
    expect(payload.title).toBe("New automation: example flow");
    expect(payload.body).toBe("Learned from 4 examples. **2 questions** to answer before it runs.");
    expect(payload.actions).toEqual([
      expect.objectContaining({ type: "deeplink", url: automationFlowDeeplink(flow.id), primary: true }),
    ]);
    expect(buildFlowProposalNotification(flow, 0).body).toContain("Ready to turn on");
  });

  it("gives each send its own id, since the server drops ids it already stored", () => {
    expect(buildFlowProposalNotification(flow, 2, 1).id).not.toBe(buildFlowProposalNotification(flow, 2, 2).id);
  });

  it("reports whether screenpipe really showed the notification", async () => {
    appServer.fetch.mockResolvedValueOnce(notifyResponse("Notification sent successfully"));
    await expect(sendFlowProposalNotification(flow, 2)).resolves.toEqual({
      shown: true,
      message: "Notification sent successfully",
    });

    appServer.fetch.mockResolvedValueOnce(notifyResponse("duplicate notification suppressed"));
    await expect(sendFlowProposalNotification(flow, 2)).resolves.toEqual({
      shown: false,
      message: "duplicate notification suppressed",
    });

    appServer.fetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(sendFlowProposalNotification(flow, 2)).rejects.toThrow("HTTP 500");
  });

  it("detects the browser dev loop from its runtime flag", () => {
    expect(isBrowserDevRuntime()).toBe(false);
    (window as Window & { __SCREENPIPE_BROWSER_RUNTIME_INSTALLED__?: boolean }).__SCREENPIPE_BROWSER_RUNTIME_INSTALLED__ = true;
    expect(isBrowserDevRuntime()).toBe(true);
  });

  afterEach(() => {
    delete (window as Window & { __SCREENPIPE_BROWSER_RUNTIME_INSTALLED__?: boolean }).__SCREENPIPE_BROWSER_RUNTIME_INSTALLED__;
  });

  it("routes the link to the Recommendations tab with the Flow open", async () => {
    const url = automationFlowDeeplink(flow.id);
    const showWindowActivated = vi.fn().mockResolvedValue(undefined);
    const emitEvent = vi.fn().mockResolvedValue(undefined);

    expect(windowForDeeplink(url)).toEqual({
      Home: { page: "pipes&tab=recommendations&flow=example-flow" },
    });

    await routeNotificationDeeplink(url, {
      showWindowActivated,
      emitEvent,
      sleepMs: vi.fn().mockResolvedValue(undefined),
    });

    expect(showWindowActivated).toHaveBeenCalledWith({
      Home: { page: "pipes&tab=recommendations&flow=example-flow" },
    });
    expect(emitEvent).toHaveBeenCalledWith("navigate", {
      url: "/home?section=pipes&tab=recommendations&flow=example-flow",
    });
    expect(emitEvent).toHaveBeenCalledWith(OPEN_AUTOMATION_FLOW_EVENT, { flowId: flow.id });
    expect(emitEvent).not.toHaveBeenCalledWith("deep-link-received", url);
  });
});
