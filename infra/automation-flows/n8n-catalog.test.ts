// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// The node catalog ScreenPipe checks chat-built Flows against must describe
// the n8n this repo runs. Regenerate it with `bun infra/automation-flows/n8n-catalog.ts`.
// Run: bun test infra/automation-flows/n8n-catalog.test.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const catalog = JSON.parse(readFileSync(join(here, "n8n-catalog.json"), "utf8"));
const compose = readFileSync(join(here, "docker-compose.yml"), "utf8");
const demo = JSON.parse(readFileSync(join(here, "workflows/novadesk-support-tickets.json"), "utf8"));

describe("n8n node catalog", () => {
  test("describes the pinned n8n image", () => {
    const pinned = compose.match(/image:\s*n8nio\/n8n:([\w.-]+)/)?.[1];
    expect(pinned).toBeDefined();
    expect(catalog.n8n).toBe(pinned);
  });

  test("knows every node of the demo workflow, at its version", () => {
    for (const node of demo.nodes) {
      const groups = catalog.nodes[node.type];
      expect(groups, node.type).toBeDefined();
      expect(groups.some((g: { versions: number[] }) => g.versions.includes(node.typeVersion)), `${node.type} ${node.typeVersion}`).toBe(true);
    }
  });

  test("leaves out the nodes this n8n switches off, and has the ScreenPipe nodes", () => {
    expect(catalog.excluded).toContain("n8n-nodes-base.executeCommand");
    expect(catalog.nodes["n8n-nodes-base.executeCommand"]).toBeUndefined();
    for (const type of ["CUSTOM.screenPipe", "CUSTOM.screenPipeTool", "CUSTOM.screenPipeTrigger", "CUSTOM.screenPipeAiTrigger"]) {
      expect(catalog.nodes[type], type).toBeDefined();
    }
  });
});
