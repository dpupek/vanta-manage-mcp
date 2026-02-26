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
  timeoutMs: number;
}

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
