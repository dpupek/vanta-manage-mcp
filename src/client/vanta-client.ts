import { BASE_API_URL } from "../api.js";
import { getTokenManager } from "../auth.js";
import { logger } from "../logging/logger.js";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

import {
  abortable,
  configuredRequestTimeout,
  currentRequestSignal,
  retryDelayMs,
  waitForRetry,
  withDeadline,
} from "./request-context.js";

export interface VantaClientOptions {
  timeoutMs?: number;
  fetch?: typeof fetch;
  wait?: typeof waitForRetry;
  tokenManager?: {
    getValidToken: () => Promise<string>;
    refreshToken: () => Promise<string>;
  };
}

export const resolveVantaUrl = (
  baseUrl: string,
  requestPath: string,
  source: VantaRequest["source"] = "manage",
): URL => {
  // Connector specs include /v1 in paths; Manage/Audit put it in servers.url.
  const familyBase =
    source === "connectors" ? baseUrl.replace(/\/v1\/?$/u, "") : baseUrl;
  const normalizedBase = familyBase.endsWith("/")
    ? familyBase
    : `${familyBase}/`;
  const normalizedPath = requestPath.startsWith("/")
    ? requestPath.slice(1)
    : requestPath;
  return new URL(normalizedPath, normalizedBase);
};

export interface VantaRequest {
  source?: "manage" | "audit" | "connectors";
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
  signal?: AbortSignal;
}

export interface VantaResponse {
  status: number;
  ok: boolean;
  data: unknown;
  headers: Record<string, string>;
}

const buildQueryString = (query: Record<string, unknown>): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
      continue;
    }

    params.set(key, String(value));
  }
  return params;
};

const parseResponsePayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      // Some gateways label plain-text errors as JSON. Preserve the HTTP
      // failure and its original body so callers can report the actual cause.
      if (!response.ok) return text;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON response: ${message}`);
    }
  }

  return text;
};

export class VantaApiClient {
  public constructor(private readonly options: VantaClientOptions = {}) {}

  public async request(input: VantaRequest): Promise<VantaResponse> {
    return withDeadline(
      this.options.timeoutMs ?? configuredRequestTimeout(),
      input.signal ?? currentRequestSignal(),
      signal => this.requestWithinDeadline(input, signal),
    );
  }

  private async requestWithinDeadline(
    input: VantaRequest,
    signal: AbortSignal,
  ): Promise<VantaResponse> {
    const tokens = this.options.tokenManager ?? getTokenManager();
    const send = this.options.fetch ?? fetch;
    const wait = this.options.wait ?? waitForRetry;
    const method = input.method.toUpperCase();
    const retrySafe = ["GET", "HEAD", "OPTIONS"].includes(method);
    let token = await abortable(signal, () => tokens.getValidToken());
    let refreshed = false;
    const url = resolveVantaUrl(BASE_API_URL, input.path, input.source);
    if (input.query)
      buildQueryString(input.query).forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    const scopedLogger = logger.child({ method, path: input.path });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      signal.throwIfAborted();
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "x-vanta-is-mcp": "true",
        ...input.headers,
      };
      let body: BodyInit | undefined = input.formData;
      if (!body && input.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(input.body);
      }
      let response: Response;
      try {
        response = await abortable(signal, () =>
          send(url, { method, headers, body, signal }),
        );
      } catch (error) {
        signal.throwIfAborted();
        if (!retrySafe || attempt === MAX_RETRIES) throw error;
        scopedLogger.warn(
          "api_transport_retry",
          "Retrying a read after transport failure.",
          { attempt },
        );
        await abortable(signal, () =>
          wait(retryDelayMs(null, attempt), signal),
        );
        continue;
      }
      scopedLogger.debug(
        "api_response_received",
        "Received Vanta API response.",
        { status: response.status, attempt },
      );
      if (response.status === 401 && !refreshed && attempt < MAX_RETRIES) {
        await response.body?.cancel();
        token = await abortable(signal, () => tokens.refreshToken());
        refreshed = true;
        continue;
      }
      // 429 rejects the request before execution. Other ambiguous write failures
      // require caller readback, not a blind replay of create/upload/patch actions.
      if (
        attempt < MAX_RETRIES &&
        (response.status === 429 ||
          (retrySafe && RETRYABLE_STATUS_CODES.has(response.status)))
      ) {
        const waitMs = retryDelayMs(
          response.headers.get("retry-after"),
          attempt,
        );
        await response.body?.cancel();
        scopedLogger.warn(
          "api_retry_scheduled",
          "Retrying a rejected request or transient read failure.",
          { status: response.status, attempt, waitMs },
        );
        // Do not shorten Retry-After; the overall deadline aborts long waits.
        await abortable(signal, () => wait(waitMs, signal));
        continue;
      }
      const headersOut: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersOut[key] = value;
      });
      return {
        status: response.status,
        ok: response.ok,
        headers: headersOut,
        data: await abortable(signal, () => parseResponsePayload(response)),
      };
    }
    throw new Error("Request retry policy exhausted without a response.");
  }
}
