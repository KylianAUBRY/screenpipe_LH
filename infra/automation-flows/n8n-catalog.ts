// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Builds n8n-catalog.json: the node types the local n8n really loads, so
// ScreenPipe refuses a Flow with an invented, disabled or incomplete node
// (crates/screenpipe-engine/src/flow_checks.rs). For each type: its versions,
// whether it is a trigger, the credentials it requires and the parameters it
// requires, with the display rules (and the defaults those rules read) that
// switch them on. Run it again after changing the n8n image:
//
//   bun infra/automation-flows/n8n-catalog.ts
//
// Reads the running container ($N8N_CONTAINER, default automation-flows-n8n-1)
// and the ScreenPipe nodes in packages/n8n-nodes-screenpipe.
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const container = process.env.N8N_CONTAINER ?? "automation-flows-n8n-1";
const here = import.meta.dir;
const out = join(here, "n8n-catalog.json");

function inContainer(command: string): string {
  const run = Bun.spawnSync(["docker", "exec", container, "sh", "-c", command], { stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) throw new Error(`docker exec ${container} ${command}: ${run.stderr.toString()}`);
  return run.stdout.toString();
}

type Display = { show?: Record<string, unknown[]>; hide?: Record<string, unknown[]> };
type Property = { name: string; type?: string; default?: unknown; required?: boolean; displayOptions?: Display };
type Description = {
  name: string;
  version: number | number[];
  group?: string[];
  polling?: boolean;
  usableAsTool?: unknown;
  credentials?: { name: string; required?: boolean; displayOptions?: Display }[];
  properties?: Property[];
};

/** Only `show` and `hide`: the rules the check evaluates. */
function rules(display: Display | undefined) {
  const kept: Display = {};
  if (display?.show && Object.keys(display.show).length) kept.show = display.show;
  if (display?.hide && Object.keys(display.hide).length) kept.hide = display.hide;
  return kept;
}

/** Parameter names a display rule reads (`/resource` is the root `resource`). */
function readNames(display: Display | undefined): string[] {
  return [display?.show, display?.hide]
    .flatMap((side) => Object.keys(side ?? {}))
    .filter((key) => !key.startsWith("@"))
    .map((key) => key.replace(/^\//, ""));
}

/** One version group: what the check needs, nothing else. */
function group(description: Description) {
  const properties = description.properties ?? [];
  const credentials = (description.credentials ?? [])
    .filter((credential) => credential.required)
    .map((credential) => ({ name: credential.name, ...rules(credential.displayOptions) }));
  // Required parameters, and every definition of a parameter a rule reads
  // (transitively): its default decides whether a rule matches.
  const wanted = new Set<string>(properties.filter((p) => p.required).map((p) => p.name));
  for (const credential of description.credentials ?? []) readNames(credential.displayOptions).forEach((n) => wanted.add(n));
  let size = -1;
  while (size !== wanted.size) {
    size = wanted.size;
    for (const property of properties) if (wanted.has(property.name)) readNames(property.displayOptions).forEach((n) => wanted.add(n));
  }
  const params = properties
    .filter((property) => wanted.has(property.name))
    .map((property) => ({
      name: property.name,
      ...(property.type ? { type: property.type } : {}),
      default: property.default ?? null,
      ...(property.required ? { required: true } : {}),
      ...rules(property.displayOptions),
    }));
  // Not `webhooks`: action nodes such as Gmail have one for « send and wait ».
  const trigger = Boolean(description.group?.includes("trigger") || description.polling);
  return {
    versions: [description.version].flat(),
    ...(trigger ? { trigger: true } : {}),
    credentials,
    params,
  };
}

const n8nVersion = inContainer("n8n --version").trim();

const packages: [string, string][] = inContainer(
  'find /usr/local/lib/node_modules/n8n/node_modules/.pnpm -path "*dist/types/nodes.json"',
)
  .trim()
  .split("\n")
  .map((path) => [path, path.includes("n8n-nodes-langchain") ? "@n8n/n8n-nodes-langchain." : "n8n-nodes-base."]);

// NODES_EXCLUDE when set, else n8n's own default list (from its config).
const excludeEnv = inContainer("printenv NODES_EXCLUDE || true").trim();
const configPath = inContainer('find /usr/local/lib/node_modules/n8n/node_modules/.pnpm -path "*@n8n/config/dist/configs/nodes.config.js" | head -1').trim();
const defaultExclude = inContainer(`cat '${configPath}'`).match(/this\.exclude = (\[[^\]]*\]);/)?.[1];
if (!excludeEnv && !defaultExclude) throw new Error("cannot find n8n's excluded nodes");
const excluded: string[] = JSON.parse((excludeEnv || defaultExclude!).replace(/'/g, '"'));

const nodes: Record<string, ReturnType<typeof group>[]> = {};
const add = (type: string, description: Description) => {
  if (excluded.includes(type)) return;
  (nodes[type] ??= []).push(group(description));
};
for (const [path, prefix] of packages) {
  const descriptions: Description[] = JSON.parse(inContainer(`cat '${path}'`));
  for (const description of descriptions) {
    add(prefix + description.name, description);
    // n8n adds a `<name>Tool` twin of every node usable as an AI Agent tool.
    if (description.usableAsTool) {
      const twin = { ...description, group: [], polling: false };
      if (!descriptions.some((d) => d.name === `${description.name}Tool`)) add(`${prefix}${description.name}Tool`, twin);
    }
  }
}

// The ScreenPipe nodes, loaded by this n8n as custom extensions (`CUSTOM.`).
const customDir = join(here, "../../packages/n8n-nodes-screenpipe/nodes");
for (const dir of readdirSync(customDir)) {
  const module = await import(join(customDir, dir, `${dir}.node.ts`));
  const description: Description = new module[dir]().description;
  add(`CUSTOM.${description.name}`, description);
  if (description.usableAsTool) add(`CUSTOM.${description.name}Tool`, { ...description, group: [], polling: false });
}

const types = Object.keys(nodes).sort();
const body = types.map((type) => `${JSON.stringify(type)}:${JSON.stringify(nodes[type])}`).join(",\n");
writeFileSync(
  out,
  `{"n8n":${JSON.stringify(n8nVersion)},"excluded":${JSON.stringify(excluded)},"nodes":{\n${body}\n}}\n`,
);
console.log(`n8n ${n8nVersion}: ${types.length} node types (${excluded.length} excluded) → ${out}`);
