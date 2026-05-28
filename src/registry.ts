import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VantaApiClient } from "./client/vanta-client.js";
import { registerCompatibilityReadTools } from "./tools/compat-tools.js";
import { registerGeneratedEndpointTools } from "./tools/endpoint-tools.js";
import { registerCapabilityTools } from "./tools/capability-tools.js";
import { registerUnsupportedTools } from "./tools/unsupported-tools.js";
import { registerWorkflowTools } from "./workflows/index.js";
import { getEnabledToolNames, hasEnabledToolFilter } from "./config.js";
import { logger } from "./logging/logger.js";

export interface RegistryCounts {
  generatedEndpoints: number;
  compatibilityReads: number;
  workflows: number;
  capabilities: number;
  unsupported: number;
  totalRegistered: number;
}

export function registerAllTools(server: McpServer): RegistryCounts {
  const client = new VantaApiClient();

  const generatedEndpoints = registerGeneratedEndpointTools(server, client);
  const compatibilityReads = registerCompatibilityReadTools(server, client);
  const workflows = registerWorkflowTools(server, client);
  const capabilities = registerCapabilityTools(server);
  const unsupported = registerUnsupportedTools(server);

  if (hasEnabledToolFilter) {
    logger.info("tool_allowlist_active", "Tool allowlist enabled.", {
      enabledTools: getEnabledToolNames(),
    });
  }

  return {
    generatedEndpoints,
    compatibilityReads,
    workflows,
    capabilities,
    unsupported,
    totalRegistered:
      generatedEndpoints +
      compatibilityReads +
      workflows +
      capabilities +
      unsupported,
  };
}
