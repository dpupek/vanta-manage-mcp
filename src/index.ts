#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeToken } from "./auth.js";
import { registerAllTools } from "./registry.js";
import {
  hasEnabledToolFilter,
  getEnabledToolNames,
  safeModeEnabled,
  writeEnabled,
} from "./config.js";

const server = new McpServer({
  name: "vanta-mcp-full",
  version: "2.0.0",
});

async function main(): Promise<void> {
  try {
    await initializeToken();
    const registration = registerAllTools(server);

    if (hasEnabledToolFilter) {
      console.error(
        `VANTA_MCP_ENABLED_TOOLS active: ${getEnabledToolNames().join(", ")}`,
      );
    }
    console.error(
      `Safety flags: safeMode=${safeModeEnabled.toString()} writeEnabled=${writeEnabled.toString()}`,
    );
    console.error(
      `Registered tools: ${registration.totalRegistered.toString()} (endpoints=${registration.generatedEndpoints.toString()}, compatibility=${registration.compatibilityReads.toString()}, workflows=${registration.workflows.toString()})`,
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Vanta MCP server started on stdio transport.");
  } catch (error) {
    console.error("Failed to start Vanta MCP server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  console.error("Shutting down Vanta MCP server.");
  process.exit(0);
});

main().catch(error => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
