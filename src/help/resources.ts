import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getEnabledToolNames,
  hasEnabledToolFilter,
  safeModeEnabled,
  writeEnabled,
} from "../config.js";
import { buildHelpCatalog } from "./catalog.js";
import { buildHelpResourceMarkdown } from "./content.js";
import { HelpResourceId, helpResourceIds } from "./types.js";

interface HelpResourceDefinition {
  name: string;
  uri: HelpResourceId;
  description: string;
}

const helpResourceDefinitions: HelpResourceDefinition[] = [
  {
    name: "vanta_manage_help",
    uri: "resource://vanta-manage/help",
    description: "Core help for Vanta Manage MCP.",
  },
  {
    name: "vanta_manage_cheatsheet",
    uri: "resource://vanta-manage/cheatsheet",
    description: "Quick objective-to-tool mapping and call shapes.",
  },
  {
    name: "vanta_manage_recipes",
    uri: "resource://vanta-manage/recipes",
    description: "Operational recipes for high-value compliance workflows.",
  },
  {
    name: "vanta_manage_tool_catalog",
    uri: "resource://vanta-manage/tool-catalog",
    description: "Generated endpoint and workflow tool catalog.",
  },
  {
    name: "vanta_manage_workflow_playbooks",
    uri: "resource://vanta-manage/workflow-playbooks",
    description: "Plan-first workflow playbooks.",
  },
  {
    name: "vanta_manage_safety",
    uri: "resource://vanta-manage/safety",
    description: "Mutation safety and write controls.",
  },
  {
    name: "vanta_manage_troubleshooting",
    uri: "resource://vanta-manage/troubleshooting",
    description: "Operational troubleshooting guidance.",
  },
];

export const registerHelpResources = (server: McpServer): number => {
  for (const definition of helpResourceDefinitions) {
    server.resource(
      definition.name,
      definition.uri,
      {
        description: definition.description,
        mimeType: "text/markdown",
      },
      uri => {
        const text = buildHelpResourceMarkdown(definition.uri, {
          catalog: buildHelpCatalog(),
          safeModeEnabled,
          writeEnabled,
          hasEnabledToolFilter,
          enabledToolNames: getEnabledToolNames(),
        });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text,
            },
          ],
        };
      },
    );
  }

  return helpResourceIds.length;
};
