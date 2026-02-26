import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const importBuildModule = async <T>(relativePath: string): Promise<T> => {
  const fullPath = path.join(repositoryRoot, "build", relativePath);
  return import(pathToFileURL(fullPath).href) as Promise<T>;
};

const writeMarkdown = (relativePath: string, text: string): void => {
  const targetPath = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, text, "utf8");
  process.stdout.write(`Wrote ${targetPath}\n`);
};

const main = async (): Promise<void> => {
  const [{ buildHelpCatalog }, contentModule, configModule] = await Promise.all([
    importBuildModule<{
      buildHelpCatalog: () => unknown;
    }>("help/catalog.js"),
    importBuildModule<{
      buildVantaMcpHelpMarkdown: (context: {
        catalog: unknown;
        safeModeEnabled: boolean;
        writeEnabled: boolean;
        hasEnabledToolFilter: boolean;
        enabledToolNames: string[];
      }) => string;
      buildResourcesPromptsReferenceMarkdown: () => string;
    }>("help/content.js"),
    importBuildModule<{
      safeModeEnabled: boolean;
      writeEnabled: boolean;
      hasEnabledToolFilter: boolean;
      getEnabledToolNames: () => string[];
    }>("config.js"),
  ]);

  const context = {
    catalog: buildHelpCatalog(),
    safeModeEnabled: configModule.safeModeEnabled,
    writeEnabled: configModule.writeEnabled,
    hasEnabledToolFilter: configModule.hasEnabledToolFilter,
    enabledToolNames: configModule.getEnabledToolNames(),
  };

  writeMarkdown(
    "docs/vanta-mcp-help.md",
    contentModule.buildVantaMcpHelpMarkdown(context),
  );
  writeMarkdown(
    "docs/mcp-resources-prompts.md",
    contentModule.buildResourcesPromptsReferenceMarkdown(),
  );
};

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate help docs: ${message}`);
  process.exit(1);
});
