// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Test harness: a fake ScreenPipe API (Bun.serve) and a minimal n8n execute
// context. The context mirrors what n8n 2.42.2 gives a node at run time:
// parameters, credentials, input items and `helpers.httpRequest`, whose
// semantics (qs, json, returnFullResponse, ignoreHttpStatusErrors) follow
// @n8n/backend-network's axios request.

import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from "n8n-workflow";

export type RecordedRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  authorization: string | null;
};

type Reply = { status?: number; body: unknown };

/** Local stand-in for ScreenPipe's HTTP API on a random port. */
export function fakeScreenpipe(routes: Record<string, Reply | ((req: RecordedRequest) => Reply)>) {
  const requests: RecordedRequest[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      const recorded: RecordedRequest = {
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        authorization: req.headers.get("authorization"),
      };
      requests.push(recorded);
      const route = routes[url.pathname];
      if (!route) return Response.json({ error: "not found" }, { status: 404 });
      const reply = typeof route === "function" ? route(recorded) : route;
      return Response.json(reply.body, { status: reply.status ?? 200 });
    },
  });
  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    requests,
    stop: () => server.stop(true),
  };
}

type ContextOptions = {
  parameters: Record<string, unknown>;
  credentials: { baseUrl: string; apiKey: string };
  items?: INodeExecutionData[];
  continueOnFail?: boolean;
};

/** Minimal `this` for `INodeType.execute`, backed by real HTTP. */
export function executeContext(options: ContextOptions): IExecuteFunctions {
  const items = options.items ?? [{ json: {} }];
  const node = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "ScreenPipe",
    type: "CUSTOM.screenPipe",
    typeVersion: 1,
    position: [0, 0] as [number, number],
    parameters: options.parameters as IDataObject,
  };
  const context = {
    getInputData: () => items,
    getNode: () => node,
    continueOnFail: () => options.continueOnFail ?? false,
    getNodeParameter(name: string, _itemIndex: number, fallback?: unknown) {
      const value = options.parameters[name];
      if (value === undefined) {
        if (arguments.length >= 3) return fallback;
        throw new Error(`Could not get parameter "${name}"`);
      }
      return value;
    },
    async getCredentials(type: string) {
      if (type !== "screenpipeApi") throw new Error(`unexpected credential type ${type}`);
      return { ...options.credentials };
    },
    helpers: { httpRequest },
  };
  return context as unknown as IExecuteFunctions;
}

async function httpRequest(request: IHttpRequestOptions) {
  const url = new URL(request.url, request.baseURL);
  for (const [key, value] of Object.entries(request.qs ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const headers = new Headers(request.headers as Record<string, string> | undefined);
  if (request.json && !headers.has("accept")) headers.set("accept", "application/json");
  const response = await fetch(url, { method: request.method ?? "GET", headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!request.ignoreHttpStatusErrors && (response.status < 200 || response.status >= 300)) {
    throw Object.assign(new Error(`Request failed with status code ${response.status}`), {
      response: { status: response.status, data: body },
    });
  }
  if (request.returnFullResponse) {
    return { body, headers: Object.fromEntries(response.headers), statusCode: response.status, statusMessage: response.statusText };
  }
  return body;
}
