import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface OpenApiSpec {
  paths?: Record<string, Record<string, unknown>>;
}

interface ManifestTool {
  toolName: string;
  source: "manage" | "audit" | "connectors";
  method: string;
  path: string;
  operationId: string;
}

interface ManifestFile {
  totalOperations: number;
  stats: {
    manage: { operations: number };
    audit: { operations: number };
    connectors: { operations: number };
  };
  tools: ManifestTool[];
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const openApiDirectory = path.join(repositoryRoot, "openapi");
const generatedDirectory = path.join(repositoryRoot, "src", "generated");

const countOperations = (specPath: string): number => {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8")) as OpenApiSpec;
  let total = 0;
  for (const pathItem of Object.values(spec.paths ?? {})) {
    total += ["get", "post", "put", "patch", "delete", "options", "head"].filter(
      method => Boolean(pathItem[method]),
    ).length;
  }
  return total;
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = (): void => {
  const manifestPath = path.join(generatedDirectory, "manifest.generated.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "Missing generated manifest. Run `npm run generate` before verify:spec-parity.",
    );
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as ManifestFile;

  const manageCount = countOperations(path.join(openApiDirectory, "manage-v1.json"));
  const auditCount = countOperations(path.join(openApiDirectory, "audit-v1.json"));
  const connectorCount = countOperations(
    path.join(openApiDirectory, "connectors-v1.json"),
  );

  assert(
    manifest.stats.manage.operations === manageCount,
    `Manage parity mismatch: expected ${manageCount.toString()}, got ${manifest.stats.manage.operations.toString()}.`,
  );
  assert(
    manifest.stats.audit.operations === auditCount,
    `Audit parity mismatch: expected ${auditCount.toString()}, got ${manifest.stats.audit.operations.toString()}.`,
  );
  assert(
    manifest.stats.connectors.operations === connectorCount,
    `Connectors parity mismatch: expected ${connectorCount.toString()}, got ${manifest.stats.connectors.operations.toString()}.`,
  );

  const expectedTotal = manageCount + auditCount + connectorCount;
  assert(
    manifest.totalOperations === expectedTotal,
    `Total operation parity mismatch: expected ${expectedTotal.toString()}, got ${manifest.totalOperations.toString()}.`,
  );

  const names = new Set<string>();
  for (const tool of manifest.tools) {
    assert(
      /^[a-z0-9_]+$/.test(tool.toolName),
      `Tool name is invalid for MCP naming: ${tool.toolName}`,
    );
    assert(!tool.toolName.includes("."), `Tool name contains dot: ${tool.toolName}`);
    assert(!names.has(tool.toolName), `Duplicate tool name: ${tool.toolName}`);
    names.add(tool.toolName);
  }

  process.stdout.write(
    `spec parity verified: ${expectedTotal.toString()} operations mapped to ${names.size.toString()} unique tools\n`,
  );
};

main();

