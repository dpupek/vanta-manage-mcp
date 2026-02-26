import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getEnabledToolNames,
  hasEnabledToolFilter,
  isToolEnabled,
  safeModeEnabled,
  writeEnabled,
} from "../config.js";
import { successEnvelope, toToolResult } from "../envelope.js";
import { buildHelpCatalog } from "./catalog.js";
import { buildHelpToolMarkdown } from "./content.js";
import { registerHelpPrompts } from "./prompts.js";
import { registerHelpResources } from "./resources.js";

export interface HelpSurfaceCounts {
  resources: number;
  prompts: number;
  fallbackHelpTool: number;
  totalRegistered: number;
}

const registerFallbackHelpTool = (server: McpServer): number => {
  if (!isToolEnabled("help")) {
    return 0;
  }

  server.tool(
    "help",
    "Return a compact index for available Vanta MCP resources and prompts.",
    () =>
      toToolResult(
        successEnvelope(
          {
            markdown: buildHelpToolMarkdown({
              catalog: buildHelpCatalog(),
              safeModeEnabled,
              writeEnabled,
              hasEnabledToolFilter,
              enabledToolNames: getEnabledToolNames(),
            }),
          },
          "Vanta MCP help index",
        ),
      ),
  );

  return 1;
};

export const registerHelpSurface = (server: McpServer): HelpSurfaceCounts => {
  const resources = registerHelpResources(server);
  const prompts = registerHelpPrompts(server);
  const fallbackHelpTool = registerFallbackHelpTool(server);
  return {
    resources,
    prompts,
    fallbackHelpTool,
    totalRegistered: resources + prompts + fallbackHelpTool,
  };
};
