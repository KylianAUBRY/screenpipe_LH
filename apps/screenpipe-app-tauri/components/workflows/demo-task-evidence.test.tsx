// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { serializeWorkflowData, WorkflowsApp } from "@screenpipe/workflows-ui";
import { createFixtureWorkflowsPlatform, fixtureWorkflowAnalysis } from "@screenpipe/workflows-ui/fixture";
import { stageScreenshots } from "../../../../packages/workflows-ui/src/screenshots";
import { buildDetectedTask, CLARIFICATION_QUESTIONS, DEMO_TASK_ID } from "../../../../infra/automation-flows/demo/detected-task";
import { upsertTask } from "../../../../infra/automation-flows/demo/catalog";

const stage = fixtureWorkflowAnalysis.analysis.workflows[0].stages[0];
const at = "2026-10-17T02:05:41Z";
const evidence = (name: string) => `data:image/webp;base64,${readFileSync(join(__dirname, "../../../../infra/automation-flows/demo/evidence", `${name}.webp`)).toString("base64")}`;
const shownTime = (timestamp: string) => new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

describe("embedded evidence (scripted Detected Task)", () => {
  it("survives saving and is still shown as step evidence, while recorder frames drop copied pixels", () => {
    const embedded = { frameId: -1, timestamp: at, app: "Gmail", visualVerified: true, matchDistanceSeconds: 0, dataUrl: "data:image/webp;base64,AAAA" };
    const recorder = { ...embedded, frameId: 42, app: "Jira", dataUrl: "data:image/png;base64,BBBB" };
    const saved = JSON.parse(serializeWorkflowData({ stage: { ...stage, screenshot: null, screenshots: [embedded, recorder] } })).stage;
    expect(stageScreenshots(saved).map(image => [image.frameId, image.dataUrl])).toEqual([[-1, embedded.dataUrl], [42, ""]]);
  });

  it("opens from the notification's review request on three repetitions with their images and times, and both questions", async () => {
    window.history.replaceState(null, "", "/home?mode=workflows");
    const task = buildDetectedTask(evidence, at);
    const saved = JSON.parse(serializeWorkflowData(upsertTask(null, task, at)));
    await act(async () => {
      render(<WorkflowsApp platform={createFixtureWorkflowsPlatform(saved)} storageKey={null} reviewRequest={{ key: "demo", workflowId: DEMO_TASK_ID }} />);
    });
    for (const [index, ticket] of ["NOVA-25 (Bug)", "NOVA-26 (Bug)", "NOVA-27 (Tâche)"].entries()) {
      expect((await screen.findByRole<HTMLInputElement>("textbox", { name: `Step ${index + 1} title` })).value).toContain(ticket);
      const step = screen.getByRole("article", { name: `Step ${index + 1}` });
      const images = within(step).getAllByRole("img", { name: /^Captured reference/ });
      expect(images.map(image => image.getAttribute("src")?.slice(0, 23))).toEqual(Array(3).fill("data:image/webp;base64,"));
      expect(within(step).getAllByText(/^(Gmail|Jira) · /).map(caption => caption.textContent))
        .toEqual(task.stages[index].screenshots!.map(capture => `${capture.app} · ${shownTime(capture.timestamp)}`));
    }
    for (const question of CLARIFICATION_QUESTIONS) expect(screen.getByRole("textbox", { name: question })).toBeVisible();
  });
});
