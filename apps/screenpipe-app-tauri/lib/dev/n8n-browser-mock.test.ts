// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockLocalApiResponse } from "./browser-engine-mock";

const request = (path: string, method = "GET", credentials?: Record<string, string>) =>
  mockLocalApiResponse(new URL(path, "http://localhost:3030"), {
    method,
    ...(credentials ? { body: JSON.stringify({ credentials }) } : {}),
  }, "ready");

beforeEach(() => {
  request("/connections/n8n", "DELETE");
});

describe("synthetic n8n browser connection", () => {
  it("adds n8n metadata without changing the other provider fixtures", async () => {
    const { data } = await request("/connections").json();
    expect(data.filter((item: { id: string }) => item.id !== "n8n")).toEqual([
      { id: "slack", name: "Slack", connected: true },
      { id: "notion", name: "Notion", connected: true, mcp: true },
      { id: "linear", name: "Linear", connected: true, mcp: true },
      { id: "obsidian", name: "Obsidian", connected: true },
    ]);
    expect(data.find((item: { id: string }) => item.id === "n8n")).toMatchObject({
      connected: false,
      fields: [
        { key: "instance_url", secret: false },
        { key: "api_key", secret: true },
        { key: "webhook_url", secret: true },
      ],
    });
  });

  it("simulates API test and save without a network request, and redacts secrets", async () => {
    const externalFetch = vi.fn(() => { throw new Error("Browser fixtures must not contact n8n"); });
    vi.stubGlobal("fetch", externalFetch);
    try {
      const credentials = { instance_url: "http://localhost:5678", api_key: "fictional-key", webhook_url: "" };
      expect(request("/connections/n8n/test", "POST", credentials).ok).toBe(true);
      expect((await request("/connections/n8n").json()).connected).toBe(false);
      expect(request("/connections/n8n", "PUT", credentials).ok).toBe(true);
      expect(await request("/connections/n8n").json()).toEqual({
        connected: true, credentials: { instance_url: "http://localhost:5678" },
      });
      expect(externalFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves a saved legacy webhook mode without returning its secret", async () => {
    expect(request("/connections/n8n", "PUT", { webhook_url: "https://fictional.invalid/webhook/example" }).ok).toBe(true);
    expect(await request("/connections/n8n").json()).toEqual({ connected: true, credentials: {} });
    expect(await request("/connections/n8n/instances").json()).toEqual({ instances: [] });
    request("/connections/n8n", "DELETE");
    expect(await request("/connections/n8n").json()).toEqual({ connected: false, credentials: {} });
  });

  it("rejects an incomplete API pair instead of silently selecting webhook mode", async () => {
    const invalid = { instance_url: "http://localhost:5678", webhook_url: "https://fictional.invalid/webhook/example" };
    expect(request("/connections/n8n/test", "POST", invalid).status).toBe(400);
    expect(request("/connections/n8n", "PUT", invalid).status).toBe(400);
    expect((await request("/connections/n8n").json()).connected).toBe(false);
  });
});
