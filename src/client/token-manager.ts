import { OAUTH_BASE_URL } from "../api.js";
import { loadCredentials, oauthScope } from "../config.js";

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

const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

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
    this.currentToken = await this.fetchWithLock(true);
    return this.currentToken.token;
  }

  private async fetchWithLock(force = false): Promise<TokenInfo> {
    if (force) {
      this.refreshPromise = null;
    }

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
    const credentials = loadCredentials();
    const oauthUrl = `${trimTrailingSlash(OAUTH_BASE_URL)}/oauth/token`;

    for (let attempt = 0; attempt <= MAX_OAUTH_RETRIES; attempt += 1) {
      const response = await fetch(oauthUrl, {
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
      });

      if (
        !response.ok &&
        OAUTH_RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < MAX_OAUTH_RETRIES
      ) {
        const retryAfterSeconds = Number.parseInt(
          response.headers.get("retry-after") ?? "",
          10,
        );
        const waitMs = Number.isNaN(retryAfterSeconds)
          ? (attempt + 1) * 500
          : retryAfterSeconds * 1000;
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `OAuth token request failed (${response.status.toString()} ${response.statusText}): ${details}`,
        );
      }

      const payload = (await response.json()) as Partial<TokenResponse>;
      if (typeof payload.access_token !== "string") {
        throw new Error("OAuth response did not include a valid access_token.");
      }
      if (typeof payload.expires_in !== "number") {
        throw new Error("OAuth response did not include a valid expires_in.");
      }

      return {
        token: payload.access_token,
        expiresAt: Date.now() + payload.expires_in * 1000 - DEFAULT_EXPIRY_BUFFER_MS,
      };
    }

    throw new Error("OAuth token retry policy exhausted without a response.");
  }
}
