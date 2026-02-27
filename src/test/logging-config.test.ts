import assert from "node:assert/strict";
import test from "node:test";
import { resolveLogLevelFromEnv } from "../logging/config.js";

type EnvRecord = Record<string, string | undefined>;

test("explicit log level is honored", () => {
  // Arrange
  const env = {
    VANTA_MCP_LOG_LEVEL: "all",
    VANTA_MCP_VERBOSE: "false",
  } as EnvRecord;

  // Initial Assert
  assert.equal(env.VANTA_MCP_LOG_LEVEL, "all");

  // Act
  const level = resolveLogLevelFromEnv(env);

  // Assert
  assert.equal(level, "all");
});

test("VANTA_MCP_LOG_LEVEL takes precedence over VANTA_MCP_VERBOSE alias", () => {
  // Arrange
  const env = {
    VANTA_MCP_LOG_LEVEL: "quiet",
    VANTA_MCP_VERBOSE: "true",
  } as EnvRecord;

  // Initial Assert
  assert.equal(env.VANTA_MCP_VERBOSE, "true");

  // Act
  const level = resolveLogLevelFromEnv(env);

  // Assert
  assert.equal(level, "quiet");
});

test("verbose alias is honored when explicit level is absent", () => {
  // Arrange
  const env = {
    VANTA_MCP_VERBOSE: "true",
  } as EnvRecord;

  // Initial Assert
  assert.equal(env.VANTA_MCP_LOG_LEVEL, undefined);

  // Act
  const level = resolveLogLevelFromEnv(env);

  // Assert
  assert.equal(level, "verbose");
});

test("invalid explicit level falls back to minimal", () => {
  // Arrange
  const env = {
    VANTA_MCP_LOG_LEVEL: "loud",
  } as EnvRecord;

  // Initial Assert
  assert.equal(env.VANTA_MCP_LOG_LEVEL, "loud");

  // Act
  const level = resolveLogLevelFromEnv(env);

  // Assert
  assert.equal(level, "minimal");
});
