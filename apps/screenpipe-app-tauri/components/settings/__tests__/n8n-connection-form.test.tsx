// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectionCredentialForm, type IntegrationField } from "@/components/settings/connections-section";

const mocks = vi.hoisted(() => ({ localFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ localFetch: mocks.localFetch }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("@/lib/hooks/use-settings", () => ({
  useSettings: () => ({ settings: {}, updateSettings: vi.fn() }),
}));
vi.mock("@/lib/utils/tauri", () => ({ commands: {} }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(), revealItemInDir: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: {}, writeTextFile: vi.fn(), exists: vi.fn(), readTextFile: vi.fn(), mkdir: vi.fn(),
}));
vi.mock("@tauri-apps/api/path", () => ({
  downloadDir: vi.fn(), join: vi.fn(), homeDir: vi.fn(), tempDir: vi.fn(), dirname: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ Command: {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ message: vi.fn(), open: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

const fields: IntegrationField[] = [
  { key: "instance_url", label: "Instance URL (optional)", secret: false, placeholder: "http://localhost:5678", help_url: "" },
  { key: "api_key", label: "API key (optional)", secret: true, placeholder: "n8n API key", help_url: "" },
  { key: "webhook_url", label: "Webhook URL (optional)", secret: true, placeholder: "https://example.invalid/webhook/test", help_url: "" },
];

const credentialsSent = () => mocks.localFetch.mock.calls.map(([url, init]) => ({
  url,
  method: init.method,
  credentials: init.body ? JSON.parse(init.body).credentials : undefined,
}));

beforeEach(() => {
  sessionStorage.clear();
  mocks.localFetch.mockReset();
  mocks.localFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("n8n connection modes", () => {
  it("defaults to API and requires both API fields without requiring a webhook", () => {
    render(<ConnectionCredentialForm integrationId="n8n" fields={fields} />);
    const connect = screen.getByRole("button", { name: "Connect" });
    expect(screen.getByRole("button", { name: "API" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Webhook URL")).toBeNull();
    expect(connect).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Instance URL"), { target: { value: "http://localhost:5678" } });
    expect(connect).toBeDisabled();
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "   " } });
    expect(connect).toBeDisabled();
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "api-key-sentinel" } });
    expect(connect).toBeEnabled();
    expect(mocks.localFetch).not.toHaveBeenCalled();
  });

  it("tests and saves API credentials to a named instance, then redacts the saved key", async () => {
    render(<ConnectionCredentialForm integrationId="n8n" fields={fields} instanceName="local work" />);
    fireEvent.change(screen.getByLabelText("Instance URL"), { target: { value: "http://localhost:5678/api/v1" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "api-key-sentinel" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await screen.findByRole("button", { name: "Disconnect" });
    const credentials = { instance_url: "http://localhost:5678/api/v1", api_key: "api-key-sentinel", webhook_url: "" };
    expect(credentialsSent()).toEqual([
      { url: "/connections/n8n/test", method: "POST", credentials },
      { url: "/connections/n8n/instances/local%20work", method: "PUT", credentials },
    ]);
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByLabelText("API key")).toHaveAttribute("placeholder", "Stored securely");
    expect(screen.getByRole("button", { name: "Webhook" })).toBeDisabled();
  });

  it("clears API credentials when changing to webhook and sends only the selected mode", async () => {
    render(<ConnectionCredentialForm integrationId="n8n" fields={fields} />);
    fireEvent.change(screen.getByLabelText("Instance URL"), { target: { value: "http://localhost:5678" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "do-not-retain" } });
    fireEvent.click(screen.getByRole("button", { name: "Webhook" }));
    expect(screen.queryByLabelText("API key")).toBeNull();
    expect(screen.getByText(/Connecting sends a test event/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Webhook URL"), { target: { value: "https://example.invalid/webhook/test" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await screen.findByRole("button", { name: "Disconnect" });
    expect(credentialsSent()[1].credentials).toEqual({
      instance_url: "", api_key: "", webhook_url: "https://example.invalid/webhook/test",
    });
    expect(screen.getByLabelText("Webhook URL")).toHaveValue("");
  });

  it("recognizes a saved legacy webhook even when its secret is redacted", () => {
    render(<ConnectionCredentialForm integrationId="n8n" fields={fields} configured initialCredentials={{}} />);
    expect(screen.getByRole("button", { name: "Webhook" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Webhook URL")).toHaveValue("");
    expect(screen.getByLabelText("Webhook URL")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Webhook URL")).toHaveAttribute("placeholder", "Stored securely");
    expect(screen.queryByLabelText("Instance URL")).toBeNull();
    expect(mocks.localFetch).not.toHaveBeenCalled();
  });

  it("infers saved API mode from the public URL and never populates returned secrets", () => {
    render(<ConnectionCredentialForm integrationId="n8n" fields={fields} configured initialCredentials={{
      instance_url: "http://localhost:5678", api_key: "hidden-key", webhook_url: "hidden-webhook",
    }} />);
    expect(screen.getByLabelText("Instance URL")).toHaveValue("http://localhost:5678");
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.queryByDisplayValue("hidden-key")).toBeNull();
    expect(screen.queryByDisplayValue("hidden-webhook")).toBeNull();
    expect(screen.getByRole("button", { name: "API" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Webhook" })).toBeDisabled();
  });

  it("allows mode changes after disconnect and ignores stale saved props", async () => {
    const props = { integrationId: "n8n", fields, configured: true, initialCredentials: {} };
    const { rerender } = render(<ConnectionCredentialForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "API" })).toBeEnabled());
    rerender(<ConnectionCredentialForm {...props} initialCredentials={{ webhook_url: "old-secret" }} />);
    expect(screen.getByRole("button", { name: "API" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(mocks.localFetch).toHaveBeenCalledWith("/connections/n8n", { method: "DELETE" });
  });

  it("does not save credentials if the API access check fails", async () => {
    mocks.localFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "API key cannot access workflows" }) });
    render(<ConnectionCredentialForm integrationId="n8n" fields={fields} />);
    fireEvent.change(screen.getByLabelText("Instance URL"), { target: { value: "http://localhost:5678" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "invalid-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await screen.findByText("API key cannot access workflows");
    expect(mocks.localFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("keeps older webhook-only n8n metadata usable", () => {
    render(<ConnectionCredentialForm integrationId="n8n" fields={[{ ...fields[2], label: "Webhook URL" }]} />);
    expect(screen.queryByRole("group", { name: "n8n connection mode" })).toBeNull();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Webhook URL"), { target: { value: "https://example.invalid/webhook/test" } });
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
  });

  it("leaves unrelated connection validation and payloads unchanged", async () => {
    render(<ConnectionCredentialForm integrationId="other" fields={[
      { ...fields[1], label: "API key" },
      { ...fields[0], label: "Instance URL (optional)" },
    ]} />);
    expect(screen.queryByRole("group", { name: "n8n connection mode" })).toBeNull();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "other-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await screen.findByRole("button", { name: "Disconnect" });
    expect(credentialsSent()[1]).toEqual({
      url: "/connections/other", method: "PUT", credentials: { api_key: "other-key", instance_url: "" },
    });
  });
});
