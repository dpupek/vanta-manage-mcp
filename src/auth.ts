import { TokenManager } from "./client/token-manager.js";

const tokenManager = new TokenManager();

export async function getValidToken(): Promise<string> {
  return tokenManager.getValidToken();
}

export async function refreshToken(): Promise<string> {
  return tokenManager.refreshToken();
}

export async function initializeToken(): Promise<void> {
  await tokenManager.initialize();
}

export function getTokenManager(): TokenManager {
  return tokenManager;
}
