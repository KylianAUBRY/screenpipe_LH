// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

export type N8nConnectionMode = "api" | "webhook";

/** Saved responses redact secret values, so infer their mode from the public URL. */
export function initialN8nMode(
  credentials: Record<string, string> | undefined,
  configured: boolean
): N8nConnectionMode {
  return credentials?.instance_url?.trim() || !configured ? "api" : "webhook";
}

export function n8nFieldKeys(mode: N8nConnectionMode): string[] {
  return mode === "api" ? ["instance_url", "api_key"] : ["webhook_url"];
}

/** Explicitly clear the inactive mode's secrets when saving a connection. */
export function n8nCredentialsForMode(
  mode: N8nConnectionMode,
  credentials: Record<string, string>
): Record<string, string> {
  const active = new Set(n8nFieldKeys(mode));
  return Object.fromEntries(
    ["instance_url", "api_key", "webhook_url"].map((key) => [
      key,
      active.has(key) ? credentials[key] ?? "" : "",
    ])
  );
}
