import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCapabilitiesPayload } from "../capabilities.js";
import { successEnvelope, toToolResult } from "../envelope.js";
import { isToolEnabled } from "../config.js";

export const registerCapabilityTools = (server: McpServer): number => {
  const toolName = "capabilities";
  if (!isToolEnabled(toolName)) {
    return 0;
  }

  server.tool(
    toolName,
    "Describe Vanta MCP runtime capabilities, generated API parity, upload support, tenant identity, and unsupported surfaces.",
    {},
    () => toToolResult(successEnvelope(buildCapabilitiesPayload())),
  );
  return 1;
};
