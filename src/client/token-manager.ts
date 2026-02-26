import { BASE_API_URL } from "../api.js";
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

    const response = await fetch(`${BASE_API_URL}/oauth/token`, {
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
}

