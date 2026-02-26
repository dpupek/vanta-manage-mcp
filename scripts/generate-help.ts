import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface ManifestTool {
  toolName: string;
  source: "manage" | "audit" | "connectors";
  method: string;
  path: string;
  isMutation: boolean;
}

interface ManifestFile {
  totalOperations: number;
  tools: ManifestTool[];
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const compatibilityTools = [
  "controls",
  "documents",
  "tests",
  "integrations",
  "frameworks",
  "vulnerabilities",
  "people",
  "vendors",
  "risks",
  "list_control_tests",
  "list_control_documents",
  "list_framework_controls",
  "list_test_entities",
  "document_resources",
  "integration_resources",
];

const workflowTools = [
  "workflow_control_evidence",
  "workflow_triage_failing_controls",
  "workflow_vendor_triage",
  "workflow_people_assets_vuln_triage",
  "workflow_information_request_triage",
];

const main = (): void => {
  const manifestPath = path.join(
    repositoryRoot,
    "src",
    "generated",
    "manifest.generated.json",
  );
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as ManifestFile;

  const lines: string[] = [];
  lines.push("# Vanta MCP Tool Catalog");
  lines.push("");
  lines.push("This catalog documents the full tool surface exposed by this server.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Generated endpoint tools: ${manifest.totalOperations.toString()}`);
  lines.push(`- Compatibility read tools: ${compatibilityTools.length.toString()}`);
  lines.push(`- Workflow tools: ${workflowTools.length.toString()}`);
  lines.push(
    `- Total tools (default): ${(manifest.totalOperations + compatibilityTools.length + workflowTools.length).toString()}`,
  );
  lines.push("");
  lines.push("## Envelope Contract");
  lines.push("");
  lines.push("- Success: `{ success: true, data, message?, notes? }`");
  lines.push(
    "- Error: `{ success: false, error: { code, message, hint?, details? }, notes? }`",
  );
  lines.push("");
  lines.push("## Safety Contract");
  lines.push("");
  lines.push("- Mutating endpoint tools include `confirm?: boolean`.");
  lines.push(
    "- In safe mode (`VANTA_MCP_SAFE_MODE=true`), mutation without `confirm=true` returns `confirmation_required`.",
  );
  lines.push(
    "- Workflow tools require `mode: \"plan\" | \"execute\"`; execute requires `confirm=true`.",
  );
  lines.push("");
  lines.push("## Compatibility Read Tools");
  lines.push("");
  for (const tool of compatibilityTools) {
    lines.push(`- \`${tool}\``);
  }
  lines.push("");
  lines.push("## Workflow Tools");
  lines.push("");
  for (const tool of workflowTools) {
    lines.push(`- \`${tool}\``);
  }
  lines.push("");
  lines.push("## Example Calls");
  lines.push("");
  lines.push("### List controls (compat)");
  lines.push("```json");
  lines.push("{");
  lines.push("  \"tool\": \"controls\",");
  lines.push("  \"input\": { \"pageSize\": 25 }");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("### Mutating endpoint preview (safe mode)");
  lines.push("```json");
  lines.push("{");
  lines.push("  \"tool\": \"create_custom_control\",");
  lines.push("  \"input\": { \"body\": { \"name\": \"Encryption Policy\" } }");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("### Mutating endpoint execute");
  lines.push("```json");
  lines.push("{");
  lines.push("  \"tool\": \"create_custom_control\",");
  lines.push("  \"input\": {");
  lines.push("    \"confirm\": true,");
  lines.push("    \"body\": { \"name\": \"Encryption Policy\" }");
  lines.push("  }");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("### Workflow plan/execute");
  lines.push("```json");
  lines.push("{");
  lines.push("  \"tool\": \"workflow_vendor_triage\",");
  lines.push("  \"input\": { \"mode\": \"plan\" }");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("```json");
  lines.push("{");
  lines.push("  \"tool\": \"workflow_vendor_triage\",");
  lines.push("  \"input\": {");
  lines.push("    \"mode\": \"execute\",");
  lines.push("    \"confirm\": true,");
  lines.push("    \"actions\": [");
  lines.push("      {");
  lines.push("        \"type\": \"set_vendor_status\",");
  lines.push("        \"vendorId\": \"vendor-123\",");
  lines.push("        \"payload\": { \"status\": \"approved\" }");
  lines.push("      }");
  lines.push("    ]");
  lines.push("  }");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("## Generated Endpoint Tools");
  lines.push("");
  lines.push("| Tool | Source | Method | Path | Mutating |");
  lines.push("|---|---|---|---|---|");
  for (const tool of manifest.tools) {
    lines.push(
      `| \`${tool.toolName}\` | ${tool.source} | ${tool.method.toUpperCase()} | \`${tool.path}\` | ${tool.isMutation ? "yes" : "no"} |`,
    );
  }

  const targetPath = path.join(repositoryRoot, "docs", "vanta-mcp-help.md");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, lines.join("\n"), "utf8");
  process.stdout.write(`Wrote ${targetPath}\n`);
};

main();

