import { isToolEnabled } from "../config.js";
import { generatedOperations } from "../generated/operations.generated.js";
import { compatibilityToolMetadata } from "../tools/compat-tools.js";
import { workflowToolMetadata } from "../workflows/index.js";
import { HelpCatalog, HelpCatalogEntry } from "./types.js";

const byName = (left: HelpCatalogEntry, right: HelpCatalogEntry): number =>
  left.name.localeCompare(right.name);

export const buildHelpCatalog = (): HelpCatalog => {
  const generatedEntries: HelpCatalogEntry[] = generatedOperations.map(
    operation => ({
      name: operation.toolName,
      description: operation.description,
      category: "generated_endpoint",
      source: operation.source,
      method: operation.method.toUpperCase(),
      path: operation.path,
      operationId: operation.operationId,
      isMutation: operation.isMutation,
      enabled: isToolEnabled(operation.toolName),
    }),
  );

  const compatEntries: HelpCatalogEntry[] = compatibilityToolMetadata.map(
    tool => ({
      name: tool.name,
      description: tool.description,
      category: "compat_read",
      source: "compat",
      mappingIntent: tool.mappingIntent,
      isMutation: false,
      enabled: isToolEnabled(tool.name),
    }),
  );

  const workflowEntries: HelpCatalogEntry[] = workflowToolMetadata.map(
    tool => ({
      name: tool.name,
      description: tool.description,
      category: "workflow",
      source: "workflow",
      mode: tool.mode,
      isMutation: true,
      enabled: isToolEnabled(tool.name),
    }),
  );

  const entries = [
    ...generatedEntries,
    ...compatEntries,
    ...workflowEntries,
  ].sort(byName);

  const summary = {
    total: entries.length,
    enabled: entries.filter(entry => entry.enabled).length,
    byCategory: {
      generated_endpoint: generatedEntries.length,
      compat_read: compatEntries.length,
      workflow: workflowEntries.length,
    },
    generatedBySource: {
      manage: generatedEntries.filter(entry => entry.source === "manage")
        .length,
      audit: generatedEntries.filter(entry => entry.source === "audit").length,
      connectors: generatedEntries.filter(
        entry => entry.source === "connectors",
      ).length,
    },
    mutating: entries.filter(entry => entry.isMutation).length,
  };

  return {
    entries,
    summary,
  };
};
