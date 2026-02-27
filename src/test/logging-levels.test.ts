import assert from "node:assert/strict";
import test from "node:test";
import { createLogger } from "../logging/logger.js";
import { LogSeverity } from "../logging/types.js";

const allSeverities: LogSeverity[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

const logBySeverity = (
  logger: ReturnType<typeof createLogger>,
  severity: LogSeverity,
): void => {
  switch (severity) {
    case "fatal":
      logger.fatal("test_event", "fatal");
      return;
    case "error":
      logger.error("test_event", "error");
      return;
    case "warn":
      logger.warn("test_event", "warn");
      return;
    case "info":
      logger.info("test_event", "info");
      return;
    case "debug":
      logger.debug("test_event", "debug");
      return;
    case "trace":
      logger.trace("test_event", "trace");
      return;
    default:
      return;
  }
};

test("log mode gating matches quiet/minimal/verbose/all contract", () => {
  // Arrange
  const captured: string[] = [];
  const quiet = createLogger({
    levelName: "quiet",
    sink: line => captured.push(line),
  });
  const minimal = createLogger({
    levelName: "minimal",
    sink: line => captured.push(line),
  });
  const verbose = createLogger({
    levelName: "verbose",
    sink: line => captured.push(line),
  });
  const all = createLogger({
    levelName: "all",
    sink: line => captured.push(line),
  });

  // Initial Assert
  assert.equal(captured.length, 0);
  assert.deepEqual(quiet.getEnabledSeverities(), ["fatal"]);
  assert.deepEqual(minimal.getEnabledSeverities(), ["fatal", "error", "warn", "info"]);
  assert.deepEqual(verbose.getEnabledSeverities(), [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
  ]);
  assert.deepEqual(all.getEnabledSeverities(), [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
  ]);

  // Act
  for (const severity of allSeverities) {
    logBySeverity(quiet, severity);
  }
  const quietCount = captured.length;

  for (const severity of allSeverities) {
    logBySeverity(minimal, severity);
  }
  const minimalCount = captured.length - quietCount;

  for (const severity of allSeverities) {
    logBySeverity(verbose, severity);
  }
  const verboseCount = captured.length - quietCount - minimalCount;

  for (const severity of allSeverities) {
    logBySeverity(all, severity);
  }
  const allCount = captured.length - quietCount - minimalCount - verboseCount;

  // Assert
  assert.equal(quietCount, 1);
  assert.equal(minimalCount, 4);
  assert.equal(verboseCount, 5);
  assert.equal(allCount, 6);
});

