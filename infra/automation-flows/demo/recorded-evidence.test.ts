// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import { afterEach, describe, expect, it } from "bun:test";
import type { WorkflowMap } from "../../../packages/workflows-ui/src/model";
import { buildDemoTask } from "./demo";

const now = "2026-10-17T12:00:00Z";
const KEY = "sp-fake-local-key";

type Frame = { frame_id: number; timestamp: string; app_name: string; window_name: string; browser_url?: string; text: string };

/** A local ScreenPipe holding `frames`, answering `/search` like the engine:
 * every word of `q` in the frame, every word of `window_name` in its title,
 * inclusive time bounds, ordered, limited. */
function fakeScreenpipe(frames: Frame[], fail?: (params: URLSearchParams) => number | undefined) {
  const auth: (string | null)[] = [];
  const words = (value: string | null) => (value ?? "").split(/\s+/).filter(Boolean).map(word => word.toLowerCase());
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      auth.push(request.headers.get("authorization"));
      if (url.pathname !== "/search") return new Response("not found", { status: 404 });
      const params = url.searchParams;
      const status = fail?.(params);
      if (status) return Response.json({ error: "fake failure" }, { status });
      const start = Date.parse(params.get("start_time") ?? "");
      const end = Date.parse(params.get("end_time") ?? "");
      const rows = frames.filter(frame => {
        const at = Date.parse(frame.timestamp);
        const all = `${frame.text} ${frame.window_name} ${frame.app_name}`.toLowerCase();
        return params.get("content_type") === "ocr"
          && (!Number.isFinite(start) || at >= start) && (!Number.isFinite(end) || at <= end)
          && words(params.get("q")).every(word => all.includes(word))
          && words(params.get("window_name")).every(word => frame.window_name.toLowerCase().includes(word));
      }).sort((a, b) => (Date.parse(a.timestamp) - Date.parse(b.timestamp)) * (params.get("order") === "ascending" ? 1 : -1))
        .slice(0, Number(params.get("limit") ?? 20));
      return Response.json({ data: rows.map(content => ({ type: "OCR", content })), pagination: { limit: rows.length, offset: 0, total: rows.length } });
    },
  });
  servers.push(server);
  return { url: server.url.origin, auth };
}
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });

const shot = (task: WorkflowMap, stage: number, index: number) => task.stages[stage].screenshots![index];

// Repetition 1 as this machine recorded it (Chrome, CEST = UTC+2).
const R1_EMAIL: Frame = { frame_id: 7101, timestamp: "2026-10-17T02:05:39.418211Z", app_name: "Google Chrome",
  window_name: "Export des contacts vide dans NovaCRM - servicedesk.novadesk@gmail.com - Gmail",
  browser_url: "https://mail.google.com/mail/u/0/#inbox/FMfcgzQ", text: "Arthur Noteris Export des contacts vide dans NovaCRM Bonjour, l'export CSV des contacts filtres est vide" };
const R1_FORM: Frame = { frame_id: 7140, timestamp: "2026-10-17T02:08:00.733Z", app_name: "Google Chrome",
  window_name: "Tableau NOVA - Jira", browser_url: "https://novadesk.atlassian.net/jira/software/projects/NOVA/boards/1",
  text: "Créer Bug Résumé NovaCRM - Export CSV des contacts filtres vide (en-tetes seuls) Priorité Highest" };
const R1_TICKET: Frame = { frame_id: 7152, timestamp: "2026-10-17T02:08:37.006Z", app_name: "Google Chrome",
  window_name: "[NOVA-25] NovaCRM - Export CSV des contacts filtres vide (en-tetes seuls) - Jira",
  browser_url: "https://novadesk.atlassian.net/browse/NOVA-25", text: "NOVA-25 NovaCRM - Export CSV des contacts filtres vide (en-tetes seuls) Bug Highest" };

describe("demo task evidence from this machine's recordings", () => {
  it("points each found capture at its recorded frame and exact time; the other captures keep their embedded image", async () => {
    const api = fakeScreenpipe([R1_EMAIL, R1_FORM, R1_TICKET]);
    const { task } = await buildDemoTask(now, { url: api.url, key: KEY });

    expect(task.stages[0].screenshots!.map(image => [image.frameId, image.timestamp, image.app, image.dataUrl])).toEqual([
      [7101, R1_EMAIL.timestamp, "Gmail", ""], [7140, R1_FORM.timestamp, "Jira", ""], [7152, R1_TICKET.timestamp, "Jira", ""],
    ]);
    // The same moments everywhere the page names them: evidence, procedure, timing.
    expect(task.stages[0].evidence.map(entry => entry.timestamp)).toEqual([R1_EMAIL.timestamp, R1_FORM.timestamp, R1_TICKET.timestamp]);
    expect(task.stages[0].procedure!.map(step => step.timestamp)).toEqual([R1_EMAIL.timestamp, R1_FORM.timestamp, R1_TICKET.timestamp]);
    expect(task.stages[0].timing!.runs[0]).toMatchObject({ start: { timestamp: R1_EMAIL.timestamp }, end: { timestamp: R1_TICKET.timestamp } });
    // Nothing recorded for repetitions 2 and 3: embedded key frames, unchanged.
    for (const stage of [1, 2]) for (const index of [0, 1, 2]) {
      expect(shot(task, stage, index).frameId).toBeLessThan(0);
      expect(shot(task, stage, index).dataUrl).toStartWith("data:image/webp;base64,");
    }
    expect(api.auth.length).toBeGreaterThan(0);
    expect(api.auth.every(header => header === `Bearer ${KEY}`)).toBe(true);
  });
});
