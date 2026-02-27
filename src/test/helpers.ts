import assert from "node:assert/strict";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const parseToolEnvelope = (
  result: CallToolResult,
): Record<string, unknown> => {
  const entry = result.content[0];
  assert.ok(entry);
  assert.equal(entry.type, "text");
  return JSON.parse(entry.text) as Record<string, unknown>;
};
