import fs from "node:fs";
import path from "node:path";

const normalizeName = (name: string): string => name.trim().toLowerCase();

const parseBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const parseCsv = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length > 0);
};

export const baseApiUrl = (process.env.VANTA_API_BASE_URL ?? "https://api.vanta.com").trim();
export const oauthScope = (
  process.env.VANTA_OAUTH_SCOPE ?? "vanta-api.all:read vanta-api.all:write"
).trim();

export const safeModeEnabled = parseBoolean(process.env.VANTA_MCP_SAFE_MODE, true);
export const writeEnabled = parseBoolean(process.env.VANTA_MCP_ENABLE_WRITE, true);

const enabledToolNames = parseCsv(process.env.VANTA_MCP_ENABLED_TOOLS).map(
  normalizeName,
);

export const enabledTools = new Set<string>(enabledToolNames);
export const hasEnabledToolFilter = enabledTools.size > 0;

export const isToolEnabled = (toolName: string): boolean => {
  if (!hasEnabledToolFilter) {
    return true;
  }

  return enabledTools.has(normalizeName(toolName));
};

export const getEnabledToolNames = (): string[] => [...enabledTools];

interface CredentialRecord {
  client_id: string;
  client_secret: string;
}

const readCredentialsFromEnvFile = (
  envFile: string | undefined,
): CredentialRecord | null => {
  if (!envFile) {
    return null;
  }

  const resolvedPath = path.resolve(envFile);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<CredentialRecord>;
  if (typeof parsed.client_id !== "string") {
    throw new Error(
      `Credential file ${resolvedPath} is missing required property 'client_id'.`,
    );
  }
  if (typeof parsed.client_secret !== "string") {
    throw new Error(
      `Credential file ${resolvedPath} is missing required property 'client_secret'.`,
    );
  }

  return {
    client_id: parsed.client_id,
    client_secret: parsed.client_secret,
  };
};

const readCredentialsFromProcessEnv = (): CredentialRecord | null => {
  const clientId = process.env.VANTA_CLIENT_ID;
  const clientSecret = process.env.VANTA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
  };
};

export const loadCredentials = (): CredentialRecord => {
  const fromFile = readCredentialsFromEnvFile(process.env.VANTA_ENV_FILE);
  if (fromFile) {
    return fromFile;
  }

  const fromEnv = readCredentialsFromProcessEnv();
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error(
    "No Vanta API credentials found. Provide VANTA_ENV_FILE or both VANTA_CLIENT_ID and VANTA_CLIENT_SECRET.",
  );
};

