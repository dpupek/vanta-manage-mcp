import { BASE_API_URL } from "../api.js";
import { getTokenManager } from "../auth.js";
import { logger } from "../logging/logger.js";

const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const joinUrl = (baseUrl: string, requestPath: string): URL => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = requestPath.startsWith("/")
    ? requestPath.slice(1)
    : requestPath;
  return new URL(normalizedPath, normalizedBase);
};

export interface VantaRequest {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
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
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON response: ${message}`);
    }
  }

  return text;
};

export class VantaApiClient {
  public async request(input: VantaRequest): Promise<VantaResponse> {
    let token = await getTokenManager().getValidToken();
    let attempt = 0;
    let refreshed = false;
    const scopedLogger = logger.child({
      method: input.method.toUpperCase(),
      path: input.path,
    });

    while (attempt <= MAX_RETRIES) {
      const url = joinUrl(BASE_API_URL, input.path);
      if (input.query) {
        const query = buildQueryString(input.query);
        query.forEach((value, key) => {
          url.searchParams.append(key, value);
        });
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "x-vanta-is-mcp": "true",
        ...(input.headers ?? {}),
      };

      let body: BodyInit | undefined;
      if (input.formData) {
        body = input.formData;
      } else if (input.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(input.body);
      }
      scopedLogger.debug("api_request_started", "Sending Vanta API request.", {
        attempt,
        hasQuery: Boolean(input.query),
        hasBody: input.body !== undefined || input.formData !== undefined,
      });

      const response = await fetch(url, {
        method: input.method.toUpperCase(),
        headers,
        body,
      });
      scopedLogger.debug("api_response_received", "Received Vanta API response.", {
        status: response.status,
        ok: response.ok,
        attempt,
      });

      if (response.status === 401 && !refreshed) {
        scopedLogger.warn("api_unauthorized_retry", "Received 401, refreshing token.", {
          attempt,
        });
        token = await getTokenManager().refreshToken();
        refreshed = true;
        attempt += 1;
        continue;
      }

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const parsed = Number.parseInt(retryAfter, 10);
          if (!Number.isNaN(parsed)) {
            await sleep(parsed * 1000);
          } else {
            await sleep((attempt + 1) * 500);
          }
        } else {
          await sleep((attempt + 1) * 500);
        }
        scopedLogger.warn("api_retry_scheduled", "Retrying request after retryable status.", {
          status: response.status,
          statusText: response.statusText,
          attempt,
        });
        attempt += 1;
        continue;
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      scopedLogger.trace("api_response_headers", "Response headers metadata captured.", {
        headers: responseHeaders,
      });

      return {
        status: response.status,
        ok: response.ok,
        data: await parseResponsePayload(response),
        headers: responseHeaders,
      };
    }

    scopedLogger.error(
      "api_retry_exhausted",
      "Request retry policy exhausted without success.",
      { maxRetries: MAX_RETRIES },
    );
    throw new Error("Request retry policy exhausted without a response.");
  }
}
