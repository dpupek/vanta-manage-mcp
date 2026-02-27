import assert from "node:assert/strict";
import test from "node:test";
import { createLogger } from "../logging/logger.js";

test("logger handles startup-style events and cyclic fields without throwing", () => {
  // Arrange
  const lines: string[] = [];
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const logger = createLogger({
    levelName: "all",
    sink: line => lines.push(line),
  });

  // Initial Assert
  assert.equal(lines.length, 0);

  // Act
  logger.info("config_summary", "Runtime configuration loaded.", {
    safeMode: true,
    writeEnabled: true,
  });
  logger.info(
    "server_started",
    "Vanta MCP server started on stdio transport.",
    {
      transport: "stdio",
      cycle,
    },
  );

  // Assert
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]) as Record<string, unknown>;
  const second = JSON.parse(lines[1]) as Record<string, unknown>;
  assert.equal(first.event, "config_summary");
  assert.equal(second.event, "server_started");
  const secondFields = second.fields as Record<string, unknown>;
  assert.equal(
    (secondFields.cycle as Record<string, unknown>).self,
    "[Circular]",
  );
});
