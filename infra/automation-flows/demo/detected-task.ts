// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Scripted Detected Task for the Automation Flows demo (SPEC "Demo data",
// D8, D10). Evidence is key frames of the team's recording of 2026-10-17
// (starts 04:05:16 local, 02:05:16Z). Embedded images use negative frame IDs:
// they are pixels, never recorder frames (see workflows-ui `screenshots.ts`).
// A capture found in this machine's recordings (`recorded-evidence.ts`) uses
// its recorder frame instead, so the Task Page loads it live.
import type { WorkflowMap, WorkflowStage, WorkflowTimingRun } from "../../../packages/workflows-ui/src/model";

export const DEMO_TASK_ID = "wf-novadesk-support-tickets";
export const DEMO_TASK_URL = `screenpipe://workflows?workflow=${DEMO_TASK_ID}&source=notification`;

/** D10: the only Clarification Questions, verbatim. */
export const CLARIFICATION_QUESTIONS = [
  "Les idées d'amélioration (comme NOVA-27) doivent-elles aussi devenir des tickets ?",
  "Comment choisis-tu la priorité ?",
];

type Capture = { image: string; at: string; app: "Gmail" | "Jira"; quote: string };
/** Where the quote shows on screen: the window title (an opened email) or the frame text. */
export type EvidenceCapture = Capture & { quoteIn: "window" | "text" };
/** A recorder frame: its ID and its exact recorder timestamp. */
export type RecordedFrame = { frameId: number; timestamp: string };

/** SPEC "Demo data": the three repetitions were recorded on 2026-10-17 between 04:00 and 04:20 local time. */
export const DEMO_RECORDING = { start: "2026-10-17T04:00:00+02:00", end: "2026-10-17T04:20:00+02:00" };

type Repetition = {
  name: string;
  description: string;
  email: Capture;
  form: Capture;
  ticket: Capture;
  procedure: { email: string; form: string; ticket: string };
};

const REPETITIONS: Repetition[] = [
  {
    name: "Répétition 1 · Arthur Noteris → NOVA-25 (Bug)",
    description: "L'e-mail « Export des contacts vide dans NovaCRM » devient le Bug NOVA-25, priorité Highest, attribué à Nils Laeremans, étiquette back.",
    email: { image: "r1-email", at: "2026-10-17T02:05:41Z", app: "Gmail", quote: "Export des contacts vide dans NovaCRM" },
    form: { image: "r1-form", at: "2026-10-17T02:08:01Z", app: "Jira", quote: "NovaCRM - Export CSV des contacts filtres vide (en-tetes seuls)" },
    ticket: { image: "r1-ticket", at: "2026-10-17T02:08:36Z", app: "Jira", quote: "NOVA-25 NovaCRM - Export CSV des contacts filtres vide (en-tetes seuls)" },
    procedure: {
      email: "Lire l'e-mail d'Arthur Noteris : l'export CSV des contacts est vide, c'est un défaut bloquant.",
      form: "Créer un Bug dans NOVA : titre « NovaCRM - … », description reprise de l'e-mail, Highest, Nils Laeremans, étiquette back.",
      ticket: "Vérifier le ticket NOVA-25 créé.",
    },
  },
  {
    name: "Répétition 2 · Loris Omont → NOVA-26 (Bug)",
    description: "L'e-mail « NovaPay refuse les montants avec centimes » devient le Bug NOVA-26, priorité Medium (contournement possible), attribué à Arthur Noteris, étiquette back.",
    email: { image: "r2-email", at: "2026-10-17T02:09:41Z", app: "Gmail", quote: "NovaPay refuse les montants avec centimes" },
    form: { image: "r2-form", at: "2026-10-17T02:10:43Z", app: "Jira", quote: "NovaPay - Montant avec virgule refuse dans une note de frais" },
    ticket: { image: "r2-ticket", at: "2026-10-17T02:10:50Z", app: "Jira", quote: "NOVA-26 NovaPay - Montant avec virgule refuse dans une note de frais" },
    procedure: {
      email: "Lire l'e-mail de Loris Omont : un montant avec virgule est refusé, le point fonctionne en contournement.",
      form: "Créer un Bug dans NOVA : titre « NovaPay - … », description reprise de l'e-mail, Medium, Arthur Noteris, étiquette back.",
      ticket: "Vérifier le ticket NOVA-26 créé.",
    },
  },
  {
    name: "Répétition 3 · Nils L. → NOVA-27 (Tâche)",
    description: "L'idée « filtrer les clients par date de dernière relance » devient la Tâche NOVA-27, priorité Low, attribuée à Arthur Noteris, étiquette front, demandeur Nils Laeremans.",
    email: { image: "r3-email", at: "2026-10-17T02:12:56Z", app: "Gmail", quote: "Idée : filtrer les clients par date de dernière relance" },
    form: { image: "r3-form", at: "2026-10-17T02:14:02Z", app: "Jira", quote: "NovaCRM - Filtre \"Derniere relance\" enregistrable dans la liste clients" },
    ticket: { image: "r3-ticket", at: "2026-10-17T02:15:11Z", app: "Jira", quote: "NOVA-27 NovaCRM - Filtre \"Derniere relance\" enregistrable dans la liste clients" },
    procedure: {
      email: "Lire l'e-mail de Nils L. : ce n'est pas un défaut mais une idée d'amélioration.",
      form: "Créer une Tâche dans NOVA : titre « NovaCRM - … », description reprise de l'e-mail, Low, Arthur Noteris, étiquette front.",
      ticket: "Renseigner le demandeur (Nils Laeremans) sur le ticket NOVA-27 créé.",
    },
  },
];

export const EVIDENCE_CAPTURES: EvidenceCapture[] = REPETITIONS.flatMap(r => [
  { ...r.email, quoteIn: "window" as const }, { ...r.form, quoteIn: "text" as const }, { ...r.ticket, quoteIn: "text" as const },
]);
export const EVIDENCE_IMAGES = EVIDENCE_CAPTURES.map(capture => capture.image);

const minutes = (run: WorkflowTimingRun) =>
  (Date.parse(run.end.timestamp) - Date.parse(run.start.timestamp)) / 60_000;

function timingOf(runs: WorkflowTimingRun[]) {
  const values = runs.map(minutes);
  return {
    basis: "estimated-elapsed" as const,
    sampleCount: runs.length,
    averageMinutes: values.reduce((sum, value) => sum + value, 0) / values.length,
    minMinutes: Math.min(...values),
    maxMinutes: Math.max(...values),
    runs,
  };
}

/** `dataUrl(name)` returns the embedded image for `evidence/<name>.webp`.
 * `recorded[name]` replaces that image, and its time, with a recorder frame. */
export function buildDetectedTask(dataUrl: (image: string) => string, now: string,
  recorded: Partial<Record<string, RecordedFrame>> = {}): WorkflowMap {
  let embeddedId = 0;
  const stages: WorkflowStage[] = REPETITIONS.map(repetition => {
    const captures = [repetition.email, repetition.form, repetition.ticket].map(capture => {
      const frame = recorded[capture.image];
      const embedded = --embeddedId;
      return { ...capture, at: frame?.timestamp ?? capture.at, frame, embedded };
    });
    const [email, form, ticket] = captures;
    const run: WorkflowTimingRun = {
      start: { timestamp: email.at, app: email.app, quote: email.quote },
      end: { timestamp: ticket.at, app: ticket.app, quote: ticket.quote },
      summary: repetition.description,
    };
    return {
      name: repetition.name,
      description: repetition.description,
      activeMinutes: 0,
      waitingMinutes: 0,
      apps: ["Gmail", "Jira"],
      confidence: 0.9,
      observedOccurrences: 1,
      observedDays: 1,
      timing: timingOf([run]),
      evidence: captures.map(capture => ({ timestamp: capture.at, app: capture.app, detail: capture.quote, source: "screen" })),
      // A recorder frame has the shape the engine attaches (`workflow_catalog.rs`): no pixels.
      screenshots: captures.map(capture => ({
        frameId: capture.frame?.frameId ?? capture.embedded,
        timestamp: capture.at,
        app: capture.app,
        matchDistanceSeconds: 0,
        visualVerified: true,
        dataUrl: capture.frame ? "" : dataUrl(capture.image),
      })),
      procedure: [
        { kind: "input", text: repetition.procedure.email, quote: email.quote, timestamp: email.at, app: email.app },
        { kind: "action", text: repetition.procedure.form, quote: form.quote, timestamp: form.at, app: form.app },
        { kind: "output", text: repetition.procedure.ticket, quote: ticket.quote, timestamp: ticket.at, app: ticket.app },
      ],
    };
  });
  const evidence = stages.flatMap(stage => stage.evidence);
  return {
    id: DEMO_TASK_ID,
    revision: 1,
    rank: 1,
    analysisDays: 90,
    title: "Transformer les e-mails de bug en tickets Jira",
    description: "Pour chaque e-mail de support qui signale un bug ou propose une amélioration, tu crées un ticket dans le projet Jira NOVA : titre « <Produit> - <résumé court> », Bug pour un défaut ou Tâche pour une idée, description qui reprend l'e-mail, priorité et étiquette back ou front.",
    repetitions: REPETITIONS.length,
    frequency: "",
    trigger: "Un e-mail de bug ou d'idée d'amélioration arrive dans la boîte servicedesk.novadesk@gmail.com.",
    outcome: "Un ticket NOVA avec le bon type, le titre « <Produit> - <résumé> », la priorité et l'étiquette.",
    totalMinutes: 0,
    activeMinutes: 0,
    waitingMinutes: 0,
    durationSource: "unknown",
    timing: timingOf(stages.map(stage => stage.timing!.runs[0])),
    appSwitches: 0,
    confidence: 0.9,
    apps: ["Gmail", "Jira"],
    people: ["Arthur Noteris", "Loris Omont", "Nils Laeremans"],
    handoffs: [],
    variations: ["Une idée d'amélioration (NOVA-27) devient une Tâche en priorité Low, avec le demandeur renseigné."],
    stages,
    bottlenecks: [],
    evidence,
    openQuestions: CLARIFICATION_QUESTIONS,
    userCorrection: null,
    catalogStatus: "current",
    lastReviewedAt: now,
    quality: {
      grade: "good",
      evidenceCount: evidence.length,
      distinctDays: 1,
      stageEvidenceCoverage: 100,
      repeatedStageCoverage: 100,
      screenshotCount: -embeddedId,
      stageScreenshotCoverage: 100,
      reasons: ["Trois répétitions observées le 17 octobre 2026"],
    },
  };
}
