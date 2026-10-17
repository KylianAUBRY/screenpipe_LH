// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import {
  NodeApiError,
  NodeConnectionTypes,
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type JsonObject,
} from "n8n-workflow";

const DEFAULT_MAX_TEXT_LENGTH = 1000;

/**
 * Reads the user's ScreenPipe memory (screen captures, audio, activity).
 * Usable as a workflow step and, through `usableAsTool`, as an AI Agent tool.
 */
export class ScreenPipe implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ScreenPipe",
    name: "screenPipe",
    icon: "file:screenpipe.png",
    group: ["input"],
    version: 1,
    subtitle: '={{ $parameter["operation"] }}',
    description: "Search what the user saw, heard and did, as recorded by ScreenPipe",
    defaults: { name: "ScreenPipe" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: "screenpipeApi", required: true }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "searchContent",
        options: [
          {
            name: "Search Content",
            value: "searchContent",
            action: "Search screen, audio and input history",
            description: "Find captures (screen text, transcriptions, inputs) matching a query",
          },
          {
            name: "Get Activity Summary",
            value: "activitySummary",
            action: "Summarize activity over a time range",
            description: "Apps and windows used, time spent, key screen texts and transcriptions",
          },
        ],
      },
      {
        displayName: "Start Time",
        name: "startTime",
        type: "string",
        default: "1h ago",
        required: true,
        description: 'ISO 8601 date or relative value such as "2h ago" or "today"',
        displayOptions: { show: { operation: ["activitySummary"] } },
      },
      {
        displayName: "End Time",
        name: "endTime",
        type: "string",
        default: "now",
        required: true,
        description: 'ISO 8601 date or relative value such as "now"',
        displayOptions: { show: { operation: ["activitySummary"] } },
      },
      {
        displayName: "Filters",
        name: "summaryFilters",
        type: "collection",
        placeholder: "Add Filter",
        default: {},
        displayOptions: { show: { operation: ["activitySummary"] } },
        options: [
          { displayName: "App Name", name: "appName", type: "string", default: "" },
          {
            displayName: "Query",
            name: "query",
            type: "string",
            default: "",
            description: "Keyword that filters memories and snippets",
          },
        ],
      },
      {
        displayName: "Query",
        name: "query",
        type: "string",
        default: "",
        description: "Words to look for. Leave empty to list the latest captures.",
        displayOptions: { show: { operation: ["searchContent"] } },
      },
      {
        displayName: "Content Type",
        name: "contentType",
        type: "options",
        default: "all",
        options: [
          { name: "All", value: "all" },
          { name: "Screen (Accessibility)", value: "accessibility" },
          { name: "Screen (OCR)", value: "ocr" },
          { name: "Audio", value: "audio" },
          { name: "Input", value: "input" },
          { name: "Memory", value: "memory" },
        ],
        displayOptions: { show: { operation: ["searchContent"] } },
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 10,
        description: "Max number of results to return",
        displayOptions: { show: { operation: ["searchContent"] } },
      },
      {
        displayName: "Filters",
        name: "filters",
        type: "collection",
        placeholder: "Add Filter",
        default: {},
        displayOptions: { show: { operation: ["searchContent"] } },
        options: [
          { displayName: "App Name", name: "appName", type: "string", default: "" },
          { displayName: "Window Name", name: "windowName", type: "string", default: "" },
          {
            displayName: "Start Time",
            name: "startTime",
            type: "string",
            default: "",
            description: 'ISO 8601 date or relative value such as "2h ago" or "today"',
          },
          {
            displayName: "End Time",
            name: "endTime",
            type: "string",
            default: "",
            description: 'ISO 8601 date or relative value such as "now"',
          },
        ],
      },
      {
        displayName: "Max Text Length",
        name: "maxTextLength",
        type: "number",
        typeOptions: { minValue: 50 },
        default: DEFAULT_MAX_TEXT_LENGTH,
        description: "Longer texts are cut, so a workflow or an AI gets a short answer",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials("screenpipeApi");
    const baseUrl = String(credentials.baseUrl).replace(/\/+$/, "");
    const apiKey = String(credentials.apiKey ?? "");
    const output: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter("operation", i) as string;
        const run = operation === "activitySummary" ? activitySummary : searchContent;
        for (const json of await run(this, i, baseUrl, apiKey)) {
          output.push({ json, pairedItem: { item: i } });
        }
      } catch (error) {
        if (!this.continueOnFail()) throw error;
        const { message, description } = error as { message: string; description?: string };
        output.push({ json: { error: description ? `${message}: ${description}` : message }, pairedItem: { item: i } });
      }
    }
    return [output];
  }
}

type Operation = (ctx: IExecuteFunctions, i: number, baseUrl: string, apiKey: string) => Promise<IDataObject[]>;

const searchContent: Operation = async (ctx, i, baseUrl, apiKey) => {
  const maxTextLength = ctx.getNodeParameter("maxTextLength", i, DEFAULT_MAX_TEXT_LENGTH) as number;
  const filters = ctx.getNodeParameter("filters", i, {}) as IDataObject;
  const response = await getJson(ctx, baseUrl, apiKey, "/search", withoutEmpty({
    q: ctx.getNodeParameter("query", i, ""),
    content_type: ctx.getNodeParameter("contentType", i, "all"),
    limit: ctx.getNodeParameter("limit", i, 10),
    app_name: filters.appName,
    window_name: filters.windowName,
    start_time: filters.startTime,
    end_time: filters.endTime,
  }));
  return ((response.data ?? []) as IDataObject[]).map((hit) => toCapture(hit, maxTextLength));
};

const activitySummary: Operation = async (ctx, i, baseUrl, apiKey) => {
  const maxTextLength = ctx.getNodeParameter("maxTextLength", i, DEFAULT_MAX_TEXT_LENGTH) as number;
  const filters = ctx.getNodeParameter("summaryFilters", i, {}) as IDataObject;
  const summary = await getJson(ctx, baseUrl, apiKey, "/activity-summary", withoutEmpty({
    start_time: ctx.getNodeParameter("startTime", i),
    end_time: ctx.getNodeParameter("endTime", i),
    app_name: filters.appName,
    q: filters.query,
  }));
  return [truncateTexts(summary, maxTextLength) as IDataObject];
};

/** GET a ScreenPipe API path; any non-2xx answer becomes a NodeApiError. */
async function getJson(
  ctx: IExecuteFunctions,
  baseUrl: string,
  apiKey: string,
  path: string,
  qs: IDataObject,
): Promise<IDataObject> {
  let response: { statusCode: number; body: unknown };
  try {
    response = await ctx.helpers.httpRequest({
      method: "GET",
      url: `${baseUrl}${path}`,
      qs,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      json: true,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    });
  } catch (error) {
    // Only the message: the raw client error can carry request headers (the API key).
    const reason = (error as Error).message;
    throw new NodeApiError(ctx.getNode(), { message: reason } as JsonObject, {
      message: `Cannot reach ScreenPipe at ${baseUrl}: is ScreenPipe running?`,
      description: reason,
    });
  }
  const body = response.body;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const detail =
      body && typeof body === "object" ? String((body as IDataObject).error ?? JSON.stringify(body)) : String(body ?? "");
    throw new NodeApiError(ctx.getNode(), (body && typeof body === "object" ? body : { detail }) as JsonObject, {
      message: `ScreenPipe returned HTTP ${response.statusCode} for ${path}`,
      description: detail,
      httpCode: String(response.statusCode),
    });
  }
  return (body ?? {}) as IDataObject;
}

function withoutEmpty(values: IDataObject): IDataObject {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

/** One /search hit, flattened to what a workflow or an AI needs. */
function toCapture(hit: IDataObject, maxTextLength: number): IDataObject {
  const c = (hit.content ?? {}) as IDataObject;
  return withoutEmpty({
    type: hit.type,
    timestamp: c.timestamp,
    app: c.app_name,
    window: c.window_name,
    url: c.browser_url,
    frameId: c.frame_id,
    text: truncate(String(c.text ?? c.transcription ?? c.content ?? c.text_content ?? ""), maxTextLength),
  });
}

/** Cuts every string in a JSON value to `max` characters. */
function truncateTexts(value: unknown, max: number): unknown {
  if (typeof value === "string") return truncate(value, max);
  if (Array.isArray(value)) return value.map((v) => truncateTexts(v, max));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, truncateTexts(v, max)]));
  }
  return value;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}… [${text.length - max} more characters]`;
}
