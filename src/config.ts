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

export const baseApiUrl = (
  process.env.VANTA_API_BASE_URL ?? "https://api.vanta.com/v1"
).trim();
export const oauthBaseUrl = (
  process.env.VANTA_OAUTH_BASE_URL ?? new URL(baseApiUrl).origin
).trim();
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

const parseCredentialString = (
  rawValue: string | undefined,
): string | undefined => {
  if (rawValue === undefined) {
    return undefined;
  }
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseCredentialsFromDotEnv = (
  raw: string,
  resolvedPath: string,
): CredentialRecord => {
  const values: Partial<Record<string, string>> = {};
  const normalizedRaw = raw.replace(/^\uFEFF/, "");

  for (const line of normalizedRaw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const exportStripped = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const splitAt = exportStripped.indexOf("=");
    if (splitAt <= 0) {
      continue;
    }

    const key = exportStripped.slice(0, splitAt).trim();
    const value = parseCredentialString(exportStripped.slice(splitAt + 1));
    if (value === undefined) {
      continue;
    }
    values[key] = value;
  }

  const clientId = values.VANTA_CLIENT_ID ?? values.client_id;
  const clientSecret = values.VANTA_CLIENT_SECRET ?? values.client_secret;
  if (!clientId || !clientSecret) {
    throw new Error(
      `Credential file ${resolvedPath} must include VANTA_CLIENT_ID and VANTA_CLIENT_SECRET (or client_id/client_secret).`,
    );
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
  };
};

const readCredentialsFromEnvFile = (
  envFile: string | undefined,
): CredentialRecord | null => {
  if (!envFile) {
    return null;
  }

  const resolvedPath = path.resolve(envFile);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    let parsed: Partial<CredentialRecord>;
    try {
      parsed = JSON.parse(trimmed) as Partial<CredentialRecord>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Credential file ${resolvedPath} contains invalid JSON: ${message}. Expected JSON with client_id/client_secret or dotenv key/value format.`,
      );
    }
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
  }

  return parseCredentialsFromDotEnv(trimmed, resolvedPath);
};

const readCredentialsFromProcessEnv = (): CredentialRecord | null => {
  const clientId = process.env.VANTA_CLIENT_ID;
  const clientSecret = process.env.VANTA_CLIENT_SECRET;
  if (clientId && !clientSecret) {
    throw new Error(
      "VANTA_CLIENT_ID is set but VANTA_CLIENT_SECRET is missing.",
    );
  }
  if (!clientId && clientSecret) {
    throw new Error(
      "VANTA_CLIENT_SECRET is set but VANTA_CLIENT_ID is missing.",
    );
  }
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
  };
};

export const loadCredentials = (): CredentialRecord => {
  const fromEnv = readCredentialsFromProcessEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const fromFile = readCredentialsFromEnvFile(process.env.VANTA_ENV_FILE);
  if (fromFile) {
    return fromFile;
  }

  throw new Error(
    "No Vanta API credentials found. Provide both VANTA_CLIENT_ID and VANTA_CLIENT_SECRET, or set VANTA_ENV_FILE to a JSON/dotenv credential file.",
  );
};
