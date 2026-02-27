#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeToken } from "./auth.js";
import { registerAllTools } from "./registry.js";
import { registerHelpSurface } from "./help/register-help.js";
import {
  hasEnabledToolFilter,
  getEnabledToolNames,
  safeModeEnabled,
  writeEnabled,
} from "./config.js";
import { logger } from "./logging/logger.js";

const server = new McpServer({
  name: "vanta-mcp-full",
  version: "2.0.0",
});

async function main(): Promise<void> {
  try {
    await initializeToken();
    const registration = registerAllTools(server);
    const helpRegistration = registerHelpSurface(server);

    if (hasEnabledToolFilter) {
      logger.info("tool_allowlist_active", "Tool allowlist is active.", {
        enabledTools: getEnabledToolNames(),
      });
    }
    logger.info("config_summary", "Runtime configuration loaded.", {
      logMode: logger.getMode(),
      enabledSeverities: logger.getEnabledSeverities(),
      safeMode: safeModeEnabled,
      writeEnabled,
    });
    logger.info("registration_summary", "Registered MCP tools and help surface.", {
      tools: {
        total: registration.totalRegistered,
        endpoints: registration.generatedEndpoints,
        compatibility: registration.compatibilityReads,
        workflows: registration.workflows,
      },
      helpSurface: {
        total: helpRegistration.totalRegistered,
        resources: helpRegistration.resources,
        prompts: helpRegistration.prompts,
        helpTool: helpRegistration.fallbackHelpTool,
      },
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("server_started", "Vanta MCP server started on stdio transport.");
  } catch (error) {
    logger.fatal("server_start_failed", "Failed to start Vanta MCP server.", {
      error,
    });
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  logger.info("server_shutdown", "Shutting down Vanta MCP server.");
  process.exit(0);
});

main().catch(error => {
  logger.fatal("fatal_startup_error", "Fatal startup error.", { error });
  process.exit(1);
});
