// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
import type { AutomationHandoff } from "../detected";

const body = (text: string) => `Request\nHello,\n${text}\nThanks,\nAda Example`;

/** Neutral detector handoff used by the tests: messages in "Mail" become records in "Tracker". */
export const EXAMPLE_HANDOFF: AutomationHandoff = {
  schema: "screenpipe.automation-handoff/v1",
  generatedAt: "2026-10-17T10:00:00.000Z",
  problem: "Each request received in Mail becomes a Tracker record created by hand.",
  trigger: { app: "Mail", account: "desk@example.com" },
  target: { app: "Tracker", keyPrefix: "ACME", baseUrl: "https://tracker.example.com" },
  evidence: {
    occurrences: 4,
    starredOccurrences: 3,
    sessions: 2,
    days: 1,
    returnedToSource: "3/4",
    createdKeys: ["ACME-41", "ACME-42", "ACME-43", "ACME-44"],
  },
  detector: { range: { start: "2026-10-17T00:00:00.000Z", end: "2026-10-17T09:59:00.000Z" } },
  examples: [
    {
      starred: true,
      input: { title: "Login page broken", text: body("The login page shows a blank screen after the latest update on every browser.") },
      output: { key: "ACME-41", title: "Login page broken", text: "ACME-41\nLogin page broken\nDescription\nThe login page shows a blank screen after the latest update on every browser." },
    },
    {
      starred: true,
      input: { title: "Export button missing", text: body("The export button disappeared from the reports screen since yesterday morning.") },
      output: { key: "ACME-42", title: "Export button missing", text: "ACME-42\nExport button missing\nDescription\nThe export button disappeared from the reports screen since yesterday morning." },
    },
    {
      starred: true,
      input: {
        title: "it does not work",
        text: "it does not work\nNothing works since this morning.\nCould you tell me which app and what error?\nOn Friday, Ada Example wrote:\nNothing works since this morning.",
      },
      output: { key: "ACME-43", title: "Invoices - error 504 on submit", text: "ACME-43\nInvoices - error 504 on submit" },
    },
  ],
};
