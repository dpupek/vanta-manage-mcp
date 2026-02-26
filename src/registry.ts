import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VantaApiClient } from "./client/vanta-client.js";
import { registerCompatibilityReadTools } from "./tools/compat-tools.js";
import { registerGeneratedEndpointTools } from "./tools/endpoint-tools.js";
import { registerWorkflowTools } from "./workflows/index.js";
import { getEnabledToolNames, hasEnabledToolFilter } from "./config.js";

export interface RegistryCounts {
  generatedEndpoints: number;
  compatibilityReads: number;
  workflows: number;
  totalRegistered: number;
}

export function registerAllTools(server: McpServer): RegistryCounts {
  const client = new VantaApiClient();

  const generatedEndpoints = registerGeneratedEndpointTools(server, client);
  const compatibilityReads = registerCompatibilityReadTools(server, client);
  const workflows = registerWorkflowTools(server, client);

  if (hasEnabledToolFilter) {
    const enabledList = getEnabledToolNames().join(", ");
    console.error(`Tool allowlist enabled: ${enabledList}`);
  }

  return {
    generatedEndpoints,
    compatibilityReads,
    workflows,
    totalRegistered: generatedEndpoints + compatibilityReads + workflows,
  };
}
