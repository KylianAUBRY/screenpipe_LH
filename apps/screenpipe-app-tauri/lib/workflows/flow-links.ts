// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Links to an Automation Flow's Review Screen (`screenpipe://flows/<id>`): the
// chat skill ends with one, and a Failed Run notification opens one (ticket
// 24). Kept free of the Flows client so the notification router can use it.

/** The Review Screen link of Flow `flowId`. */
export function flowReviewLink(flowId: string): string {
  return `screenpipe://flows/${encodeURIComponent(flowId)}`;
}

/** The Flow id a Review Screen link points at, or null for any other link. */
export function flowIdFromReviewLink(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "screenpipe:" || url.host !== "flows") return null;
    return decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "") || null;
  } catch {
    return null;
  }
}

/**
 * Where the Home window shows a Flow's Review Screen: its `page` for
 * `showWindowActivated` (a cold Home window opens on it) and its route for
 * the `navigate` event (a Home window already open goes there).
 */
export function flowReviewDestination(flowId: string): { page: string; url: string } {
  const page = `pipes&tab=flows&flow=${encodeURIComponent(flowId)}`;
  return { page, url: `/home?section=${page}` };
}

/**
 * In the Home window, on a `navigate` to the Flows tab: puts it in the address
 * (an Automations view mounted later reads it) and switches an Automations
 * view already mounted to it. Any other destination is left alone.
 */
export function followFlowNavigation(url: URL): void {
  const params = url.searchParams;
  if (params.get("section") !== "pipes" || params.get("tab") !== "flows") return;
  const flow = params.get("flow");
  const target = new URLSearchParams({ section: "pipes", tab: "flows" });
  if (flow) target.set("flow", flow);
  window.history.replaceState(window.history.state, "", `/home?${target}`);
  window.dispatchEvent(
    new CustomEvent("switch-pipes-tab", { detail: flow ? { tab: "flows", flow } : { tab: "flows" } }),
  );
}
