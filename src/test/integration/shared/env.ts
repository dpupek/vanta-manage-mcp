import type { TestContext } from "node:test";

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
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

const parsePositiveInteger = (
  value: string | undefined,
  defaultValue: number,
): number => {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
};

export interface LiveIntegrationEnv {
  enabled: boolean;
  allowMutations: boolean;
  requireMutation: boolean;
  controlId: string | null;
  vendorId: string | null;
  vulnerabilityId: string | null;
  remediationId: string | null;
  timeoutMs: number;
}

const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const readLiveIntegrationEnv = (): LiveIntegrationEnv => ({
  enabled: parseBoolean(process.env.VANTA_INTEGRATION_LIVE, false),
  allowMutations: parseBoolean(process.env.VANTA_INTEGRATION_ALLOW_MUTATIONS, false),
  requireMutation: parseBoolean(process.env.VANTA_INTEGRATION_REQUIRE_MUTATION, false),
  controlId: (() => {
    const value = process.env.VANTA_INTEGRATION_TEST_CONTROL_ID?.trim();
    if (value === undefined || value.length === 0) {
      return null;
    }
    return value;
  })(),
  vendorId: (() => {
    const value = process.env.VANTA_INTEGRATION_TEST_VENDOR_ID?.trim();
    if (value === undefined || value.length === 0) {
      return null;
    }
    return value;
  })(),
  vulnerabilityId: (() => {
    const value = process.env.VANTA_INTEGRATION_TEST_VULNERABILITY_ID?.trim();
    if (value === undefined || value.length === 0) {
      return null;
    }
    return value;
  })(),
  remediationId: (() => {
    const value = process.env.VANTA_INTEGRATION_TEST_REMEDIATION_ID?.trim();
    if (value === undefined || value.length === 0) {
      return null;
    }
    return value;
  })(),
  timeoutMs: parsePositiveInteger(process.env.VANTA_INTEGRATION_TEST_TIMEOUT_MS, 120_000),
});

export const guardLiveTest = (
  t: TestContext,
  env: LiveIntegrationEnv,
  requiresMutation: boolean,
): boolean => {
  if (!env.enabled) {
    t.skip(
      "Live integration tests are disabled. Set VANTA_INTEGRATION_LIVE=true to run.",
    );
    return false;
  }

  if (!requiresMutation) {
    return true;
  }

  if (env.allowMutations) {
    return true;
  }

  const message =
    "Mutation tests require VANTA_INTEGRATION_ALLOW_MUTATIONS=true in this tenant.";
  if (env.requireMutation) {
    throw new Error(`${message} VANTA_INTEGRATION_REQUIRE_MUTATION=true requested hard failure.`);
  }
  t.skip(message);
  return false;
};

export const requireLiveFixture = (
  t: TestContext,
  env: LiveIntegrationEnv,
  value: string | null,
  envVarName: string,
  reason: string,
): string | null => {
  if (value) {
    return value;
  }

  const message = `${reason} Set ${envVarName} to run this scenario.`;
  if (env.requireMutation) {
    throw new Error(message);
  }
  t.skip(message);
  return null;
};

export const isRetryableLiveStartError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate_limit_exceeded") ||
    normalized.includes("oauth token request failed (429") ||
    normalized.includes("connection closed")
  );
};

export const startLiveWithRetry = async (
  start: () => Promise<void>,
  options?: {
    attempts?: number;
    delayMs?: number;
  },
): Promise<void> => {
  const attempts = options?.attempts ?? 8;
  const delayMs = options?.delayMs ?? 5_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await start();
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableLiveStartError(error)) {
        throw error;
      }
      await sleep(delayMs);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
};

export const skipOnLiveRateLimit = (
  t: TestContext,
  error: unknown,
  context: string,
): boolean => {
  if (!isRetryableLiveStartError(error)) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  t.skip(
    `${context} skipped due to transient Vanta OAuth throttling/startup failure: ${message}`,
  );
  return true;
};
