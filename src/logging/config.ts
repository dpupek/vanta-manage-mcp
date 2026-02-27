import { LogLevelName } from "./types.js";

const LOG_LEVEL_NAMES = new Set<LogLevelName>([
  "quiet",
  "minimal",
  "verbose",
  "all",
]);

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

const parseLogLevelName = (
  value: string | undefined,
): LogLevelName | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (LOG_LEVEL_NAMES.has(normalized as LogLevelName)) {
    return normalized as LogLevelName;
  }
  return null;
};

export const resolveLogLevelFromEnv = (
  env: Record<string, string | undefined> = process.env,
): LogLevelName => {
  const explicitLevel = parseLogLevelName(env.VANTA_MCP_LOG_LEVEL);
  if (explicitLevel) {
    return explicitLevel;
  }

  if (env.VANTA_MCP_LOG_LEVEL !== undefined) {
    return "minimal";
  }

  if (parseBoolean(env.VANTA_MCP_VERBOSE, false)) {
    return "verbose";
  }

  return "minimal";
};

export const logLevelName = resolveLogLevelFromEnv();
