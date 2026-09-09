import { OAUTH_BASE_URL } from "../api.js";
import { loadCredentials, oauthScope } from "../config.js";
import { logger } from "../logging/logger.js";

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface TokenInfo {
  token: string;
  expiresAt: number;
}

const DEFAULT_EXPIRY_BUFFER_MS = 60_000;
const OAUTH_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_OAUTH_RETRIES = 2;

import {
  abortable,
  configuredRequestTimeout,
  retryDelayMs,
  waitForRetry,
  withDeadline,
} from "./request-context.js";

const trimTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

export class TokenManager {
  private currentToken: TokenInfo | null = null;
  private refreshPromise: Promise<TokenInfo> | null = null;

  public async initialize(): Promise<void> {
    await this.getValidToken();
  }

  public async getValidToken(): Promise<string> {
    if (!this.currentToken || Date.now() >= this.currentToken.expiresAt) {
      this.currentToken = await this.fetchWithLock();
    }

    return this.currentToken.token;
  }

  public async refreshToken(): Promise<string> {
    this.currentToken = await this.fetchWithLock();
    return this.currentToken.token;
  }

  private async fetchWithLock(): Promise<TokenInfo> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.fetchNewToken();
    }

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async fetchNewToken(): Promise<TokenInfo> {
    return withDeadline(configuredRequestTimeout(), undefined, signal =>
      this.fetchWithinDeadline(signal),
    );
  }

  private async fetchWithinDeadline(signal: AbortSignal): Promise<TokenInfo> {
    const credentials = loadCredentials();
    const oauthUrl = `${trimTrailingSlash(OAUTH_BASE_URL)}/oauth/token`;
    logger.debug("oauth_token_fetch_started", "Starting OAuth token fetch.", {
      oauthUrl,
      maxRetries: MAX_OAUTH_RETRIES,
    });

    for (let attempt = 0; attempt <= MAX_OAUTH_RETRIES; attempt += 1) {
      const response = await abortable(signal, () =>
        fetch(oauthUrl, {
          signal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            grant_type: "client_credentials",
            scope: oauthScope,
          }),
        }),
      );

      if (
        !response.ok &&
        OAUTH_RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < MAX_OAUTH_RETRIES
      ) {
        const waitMs = retryDelayMs(
          response.headers.get("retry-after"),
          attempt,
        );
        await response.body?.cancel();
        logger.warn(
          "oauth_token_retry_scheduled",
          "Retrying OAuth token request after retryable response.",
          {
            status: response.status,
            statusText: response.statusText,
            attempt,
            waitMs,
          },
        );
        await waitForRetry(waitMs, signal);
        continue;
      }

      if (!response.ok) {
        const details = await abortable(signal, () => response.text());
        logger.error(
          "oauth_token_fetch_failed",
          "OAuth token request failed.",
          {
            status: response.status,
            statusText: response.statusText,
            attempt,
            details,
          },
        );
        throw new Error(
          `OAuth token request failed (${response.status.toString()} ${response.statusText}): ${details}`,
        );
      }

      const payload = (await abortable(signal, () =>
        response.json(),
      )) as Partial<TokenResponse>;
      if (typeof payload.access_token !== "string") {
        throw new Error("OAuth response did not include a valid access_token.");
      }
      if (
        typeof payload.expires_in !== "number" ||
        !Number.isFinite(payload.expires_in) ||
        payload.expires_in <= 0
      ) {
        throw new Error("OAuth response did not include a valid expires_in.");
      }
      logger.debug(
        "oauth_token_fetch_succeeded",
        "OAuth token fetch succeeded.",
        {
          expiresInSeconds: payload.expires_in,
          attempt,
        },
      );

      return {
        token: payload.access_token,
        expiresAt:
          Date.now() +
          payload.expires_in * 1000 -
          Math.min(DEFAULT_EXPIRY_BUFFER_MS, payload.expires_in * 100),
      };
    }

    logger.error(
      "oauth_token_retry_exhausted",
      "OAuth token retry policy exhausted without success.",
      { maxRetries: MAX_OAUTH_RETRIES },
    );
    throw new Error("OAuth token retry policy exhausted without a response.");
  }
}
