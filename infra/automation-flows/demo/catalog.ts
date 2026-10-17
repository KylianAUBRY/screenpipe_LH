// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// The desktop-owned workflow catalog the engine serves at GET /workflows/catalog.
// The engine's write routes refuse client-supplied evidence by design, so the
// demo writes the file directly, in the order the app's own writers use
// (engine `persist`, `disk-storage.ts`): backup of the last valid catalog,
// then an atomic replace. The engine reads the file on every request.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AnalysisQuality, WorkflowAnalysis, WorkflowMap } from "../../../packages/workflows-ui/src/model";
import { DEMO_TASK_ID } from "./detected-task";

export type Catalog = WorkflowAnalysis & { revision?: number };

/** `<app local data>/workflows`; the default is the installed macOS app (`screenpi.pe`). */
export function catalogDir(): string {
  const override = process.env.SCREENPIPE_WORKFLOWS_DIR;
  if (override) return override;
  if (process.platform !== "darwin") throw new Error("Set SCREENPIPE_WORKFLOWS_DIR to <app local data>/workflows.");
  return join(homedir(), "Library", "Application Support", "screenpi.pe", "workflows");
}

const isCatalog = (value: unknown): value is Catalog => {
  const catalog = value as Catalog | null;
  return catalog?.schemaVersion === 5 && Array.isArray(catalog?.analysis?.workflows);
};

/** Same fallback as the engine: primary, then backup. Never overwrite an unreadable catalog. */
export function readCatalog(dir: string): Catalog | null {
  let found = false;
  for (const name of ["catalog.json", "catalog.backup.json"]) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    found = true;
    try {
      const value: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (isCatalog(value)) return value;
    } catch {
      // Try the backup.
    }
  }
  if (found) throw new Error(`The workflow catalog in ${dir} is unreadable. It was left untouched.`);
  return null;
}

const EMPTY_QUALITY: AnalysisQuality = {
  grade: "limited", usableDays: 0, requestedDays: 90, capturedMinutes: 0, totalFrames: 0,
  appAttributionCoverage: 0, parsedContextCount: 0, verifiedEvidenceCount: 0,
  screenshotCount: 0, screenshotCoverage: 0, warnings: [],
};

/** Install or reinstall the scripted task in its initial state (no answers). */
export function upsertTask(previous: Catalog | null, task: WorkflowMap, now: string): Catalog {
  const base: Catalog = previous ?? {
    schemaVersion: 5, revision: 0, analysis: { workflows: [] }, analyzedAt: now, days: 90,
    source: "screenpipe", bundleCount: 0, observedActiveMinutes: 0, quality: EMPTY_QUALITY,
  };
  const prior = base.analysis.workflows.find(workflow => workflow.id === task.id);
  const others = base.analysis.workflows.filter(workflow => workflow.id !== task.id);
  // A newer revision makes a stale open Task Page reload before saving answers.
  const installed = { ...task, revision: Math.max(task.revision ?? 1, (prior?.revision ?? 0) + 1) };
  return {
    ...base,
    revision: (base.revision ?? 0) + 1,
    analyzedAt: base.analyzedAt || now,
    quality: base.quality ?? EMPTY_QUALITY,
    analysis: { workflows: [installed, ...others].map((workflow, index) => ({ ...workflow, rank: index + 1 })) },
  };
}

/** Answers live in `userCorrection` (workflows-ui `workflow-answers.ts`). */
export function clearAnswers(catalog: Catalog, id = DEMO_TASK_ID): { catalog: Catalog; changed: boolean } {
  const workflow = catalog.analysis.workflows.find(candidate => candidate.id === id);
  if (!workflow) throw new Error(`${id} is not installed. Run the demo script first.`);
  if (workflow.userCorrection == null) return { catalog, changed: false };
  return {
    changed: true,
    catalog: {
      ...catalog,
      revision: (catalog.revision ?? 0) + 1,
      analysis: { workflows: catalog.analysis.workflows.map(candidate => candidate.id === id
        ? { ...candidate, userCorrection: null, revision: (candidate.revision ?? 0) + 1 } : candidate) },
    },
  };
}

export function writeCatalog(dir: string, previous: Catalog | null, next: Catalog): void {
  mkdirSync(dir, { recursive: true });
  const suffix = `${process.pid}.${Date.now()}.tmp`;
  const replace = (name: string, value: Catalog) => {
    const path = join(dir, name);
    writeFileSync(`${path}.${suffix}`, JSON.stringify(value));
    renameSync(`${path}.${suffix}`, path);
  };
  if (previous) replace("catalog.backup.json", previous);
  replace("catalog.json", next);
}
