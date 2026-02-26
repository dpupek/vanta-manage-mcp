import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

interface FakeRouteResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  closeConnection?: boolean;
}

export interface FakeRouteRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage["headers"];
  rawBody: string;
  jsonBody: unknown;
}

type FakeRouteHandler = (
  request: FakeRouteRequest,
) => FakeRouteResponse | Promise<FakeRouteResponse>;

const routeKey = (method: string, path: string): string =>
  `${method.toUpperCase()} ${path}`;

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }
    chunks.push(Buffer.from(String(chunk), "utf8"));
  }
  return Buffer.concat(chunks).toString("utf8");
};

export class FakeVantaServer {
  private readonly server: Server;
  private readonly handlers = new Map<string, FakeRouteHandler>();
  private readonly calls = new Map<string, FakeRouteRequest[]>();
  private readonly oauthTokens: string[];
  private readonly oauthExpirySeconds: number;
  private nextTokenIndex = 0;
  private port: number | null = null;

  public constructor(oauthTokens: string[] = ["fake-token-1", "fake-token-2"]) {
    this.oauthTokens = oauthTokens;
    this.oauthExpirySeconds = 3600;
    this.server = createServer((request, response) => {
      this.handleRequest(request, response).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        response.statusCode = 500;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ error: "fake_server_error", message }));
      });
    });
  }

  public get baseUrl(): string {
    if (this.port === null) {
      throw new Error("Fake Vanta server is not started.");
    }
    return `http://127.0.0.1:${this.port.toString()}`;
  }

  public queueRoute(
    method: string,
    path: string,
    responses: FakeRouteResponse[],
  ): void {
    const queue = [...responses];
    this.handlers.set(routeKey(method, path), () => {
      const next = queue.shift();
      if (next) {
        return next;
      }
      return {
        status: 500,
        body: {
          error: "missing_fake_response",
          message: `No queued response for ${method.toUpperCase()} ${path}`,
        },
      };
    });
  }

  public setRoute(method: string, path: string, handler: FakeRouteHandler): void {
    this.handlers.set(routeKey(method, path), handler);
  }

  public getCallCount(method: string, path: string): number {
    return this.getCalls(method, path).length;
  }

  public getCalls(method: string, path: string): FakeRouteRequest[] {
    return this.calls.get(routeKey(method, path)) ?? [];
  }

  public async start(): Promise<void> {
    if (this.port !== null) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server.listen(0, "127.0.0.1", () => {
        resolve();
      });
      this.server.once("error", reject);
    });

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine fake Vanta server port.");
    }
    this.port = address.port;
  }

  public async stop(): Promise<void> {
    if (this.port === null) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.port = null;
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const method = request.method?.toUpperCase() ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const rawBody = await readRequestBody(request);
    const jsonBody = this.tryParseJson(rawBody);

    const routeRequest: FakeRouteRequest = {
      method,
      path,
      query: url.searchParams,
      headers: request.headers,
      rawBody,
      jsonBody,
    };
    const key = routeKey(method, path);
    const existingCalls = this.calls.get(key) ?? [];
    existingCalls.push(routeRequest);
    this.calls.set(key, existingCalls);

    if (method === "POST" && path === "/oauth/token") {
      this.writeJson(response, {
        status: 200,
        body: {
          access_token: this.nextOauthToken(),
          expires_in: this.oauthExpirySeconds,
        },
      });
      return;
    }

    const handler = this.handlers.get(key);
    if (!handler) {
      this.writeJson(response, {
        status: 404,
        body: {
          error: "route_not_configured",
          method,
          path,
        },
      });
      return;
    }

    const fakeResponse = await handler(routeRequest);
    if (fakeResponse.closeConnection) {
      request.socket.destroy();
      return;
    }
    this.writeJson(response, fakeResponse);
  }

  private writeJson(response: ServerResponse, fakeResponse: FakeRouteResponse): void {
    response.statusCode = fakeResponse.status;
    for (const [key, value] of Object.entries(fakeResponse.headers ?? {})) {
      response.setHeader(key, value);
    }

    if (fakeResponse.body === undefined) {
      response.end();
      return;
    }

    if (
      typeof fakeResponse.body === "string" ||
      Buffer.isBuffer(fakeResponse.body)
    ) {
      response.end(fakeResponse.body);
      return;
    }

    if (!response.hasHeader("content-type")) {
      response.setHeader("content-type", "application/json");
    }
    response.end(JSON.stringify(fakeResponse.body));
  }

  private nextOauthToken(): string {
    const next = this.oauthTokens[this.nextTokenIndex];
    if (this.nextTokenIndex < this.oauthTokens.length - 1) {
      this.nextTokenIndex += 1;
    }
    return next;
  }

  private tryParseJson(raw: string): unknown {
    if (raw.length === 0) {
      return null;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
}
