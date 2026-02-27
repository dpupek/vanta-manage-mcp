import assert from "node:assert/strict";
import test from "node:test";
import { createLogger } from "../logging/logger.js";

test("logger outputs JSON lines and controls error stack visibility by mode", () => {
  // Arrange
  const minimalLines: string[] = [];
  const allLines: string[] = [];
  const minimalLogger = createLogger({
    levelName: "minimal",
    sink: line => minimalLines.push(line),
  });
  const allLogger = createLogger({
    levelName: "all",
    sink: line => allLines.push(line),
  });
  const error = new Error("boom");

  // Initial Assert
  assert.equal(minimalLines.length, 0);
  assert.equal(allLines.length, 0);

  // Act
  minimalLogger.error("minimal_error", "Minimal error", {
    error,
    token: "secret",
  });
  allLogger.error("all_error", "All error", {
    error,
    token: "secret",
  });

  // Assert
  assert.equal(minimalLines.length, 1);
  assert.equal(allLines.length, 1);

  const minimalEntry = JSON.parse(minimalLines[0]) as Record<string, unknown>;
  const allEntry = JSON.parse(allLines[0]) as Record<string, unknown>;
  assert.equal(typeof minimalEntry.ts, "string");
  assert.equal(minimalEntry.level, "error");
  assert.equal(minimalEntry.event, "minimal_error");
  assert.equal(minimalEntry.msg, "Minimal error");

  const minimalFields = minimalEntry.fields as Record<string, unknown>;
  assert.equal(minimalFields.token, "[REDACTED]");
  const minimalError = minimalFields.error as Record<string, unknown>;
  assert.equal(minimalError.name, "Error");
  assert.equal(minimalError.message, "boom");
  assert.equal("stack" in minimalError, false);

  const allFields = allEntry.fields as Record<string, unknown>;
  assert.equal(allFields.token, "[REDACTED]");
  const allError = allFields.error as Record<string, unknown>;
  assert.equal(allError.name, "Error");
  assert.equal(allError.message, "boom");
  assert.equal(typeof allError.stack, "string");
});

