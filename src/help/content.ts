import {
  HelpCatalog,
  helpPromptNames,
  helpResourceIds,
  HelpResourceId,
} from "./types.js";

export interface HelpRenderContext {
  catalog: HelpCatalog;
  safeModeEnabled: boolean;
  writeEnabled: boolean;
  hasEnabledToolFilter: boolean;
  enabledToolNames: string[];
}

const escapePipe = (value: string): string => value.replaceAll("|", "\\|");

const jsonBlock = (value: unknown): string =>
  ["```json", JSON.stringify(value, null, 2), "```"].join("\n");

const asYesNo = (value: boolean): string => (value ? "yes" : "no");

const resourcePurpose: Record<HelpResourceId, string> = {
  "resource://vanta-manage/help":
    "Core onboarding for auth, envelopes, safe writes, and discovery.",
  "resource://vanta-manage/cheatsheet":
    "Fast path from objective to tools and minimal call shapes.",
  "resource://vanta-manage/tool-catalog":
    "Live catalog of generated endpoint tools plus compat/workflow tools.",
  "resource://vanta-manage/workflow-playbooks":
    "Plan-first/execute-confirmed playbooks for high-value workflows.",
  "resource://vanta-manage/safety":
    "Mutation safety model, write flags, and confirmation behavior.",
  "resource://vanta-manage/troubleshooting":
    "Common errors and deterministic resolution steps.",
};

export const promptDescriptions: Record<string, string> = {
  playbook_tool_selector:
    "Route a task to compat, generated endpoint, and workflow tools.",
  playbook_control_evidence:
    "Control evidence flow using plan-first then execute-confirmed steps.",
  playbook_failing_controls_triage:
    "Triage failing controls/tests/documents with deterministic readback.",
  playbook_vendor_triage:
    "Vendor lifecycle and findings/security-review evidence updates.",
  playbook_people_assets_vuln_triage:
    "Correlate people/assets/vulnerabilities and apply allowed updates.",
  playbook_information_request_triage:
    "Audit information request comments/evidence/status triage.",
};

const renderDiscoverySection = (): string[] => {
  const lines: string[] = [];
  lines.push("## Resources");
  lines.push("");
  for (const uri of helpResourceIds) {
    lines.push(`- \`${uri}\` - ${resourcePurpose[uri]}`);
  }
  lines.push("");
  lines.push("## Prompts");
  lines.push("");
  for (const promptName of helpPromptNames) {
    lines.push(`- \`${promptName}\` - ${promptDescriptions[promptName]}`);
  }
  return lines;
};

const renderCatalogSummary = (context: HelpRenderContext): string[] => {
  const { summary } = context.catalog;
  return [
    "## Summary",
    "",
    `- Total tools: ${summary.total.toString()}`,
    `- Enabled tools: ${summary.enabled.toString()}`,
    `- Generated endpoint tools: ${summary.byCategory.generated_endpoint.toString()}`,
    `- Compatibility read tools: ${summary.byCategory.compat_read.toString()}`,
    `- Workflow tools: ${summary.byCategory.workflow.toString()}`,
    `- Mutating tools: ${summary.mutating.toString()}`,
    `- Generated manage tools: ${summary.generatedBySource.manage.toString()}`,
    `- Generated audit tools: ${summary.generatedBySource.audit.toString()}`,
    `- Generated connector tools: ${summary.generatedBySource.connectors.toString()}`,
    "",
  ];
};

const renderSafetySummary = (context: HelpRenderContext): string[] => {
  const enabledTools = context.hasEnabledToolFilter
    ? context.enabledToolNames.join(", ")
    : "(all tools enabled)";
  return [
    "## Runtime Safety",
    "",
    `- \`VANTA_MCP_SAFE_MODE\`: ${context.safeModeEnabled.toString()}`,
    `- \`VANTA_MCP_ENABLE_WRITE\`: ${context.writeEnabled.toString()}`,
    `- \`VANTA_MCP_ENABLED_TOOLS\`: ${enabledTools}`,
    "",
  ];
};

const renderEndpointTable = (context: HelpRenderContext): string[] => {
  const lines: string[] = [];
  lines.push("## Generated Endpoint Tools");
  lines.push("");
  lines.push("| Tool | Source | Method | Path | Mutating | Enabled |");
  lines.push("|---|---|---|---|---|---|");
  for (const entry of context.catalog.entries) {
    if (entry.category !== "generated_endpoint") {
      continue;
    }
    lines.push(
      `| \`${entry.name}\` | ${entry.source} | ${entry.method ?? ""} | \`${escapePipe(entry.path ?? "")}\` | ${asYesNo(entry.isMutation)} | ${asYesNo(entry.enabled)} |`,
    );
  }
  return lines;
};

const renderCompatTable = (context: HelpRenderContext): string[] => {
  const lines: string[] = [];
  lines.push("## Compatibility Read Tools");
  lines.push("");
  lines.push("| Tool | Mapping Intent | Enabled |");
  lines.push("|---|---|---|");
  for (const entry of context.catalog.entries) {
    if (entry.category !== "compat_read") {
      continue;
    }
    lines.push(
      `| \`${entry.name}\` | ${escapePipe(entry.mappingIntent ?? "")} | ${asYesNo(entry.enabled)} |`,
    );
  }
  return lines;
};

const renderWorkflowTable = (context: HelpRenderContext): string[] => {
  const lines: string[] = [];
  lines.push("## Workflow Tools");
  lines.push("");
  lines.push("| Tool | Mode | Enabled |");
  lines.push("|---|---|---|");
  for (const entry of context.catalog.entries) {
    if (entry.category !== "workflow") {
      continue;
    }
    lines.push(
      `| \`${entry.name}\` | ${entry.mode ?? "plan_execute_confirmed"} | ${asYesNo(entry.enabled)} |`,
    );
  }
  return lines;
};

const renderWorkflowSteps = (): string[] => [
  "## Workflow Tool Patterns",
  "",
  "### workflow_control_evidence",
  "",
  "1. Read current controls and optional target control (`controls`, `get_control`).",
  "2. Run `workflow_control_evidence` with `mode=plan`.",
  "3. Execute with `mode=execute` and `confirm=true` when actions are approved.",
  "4. Verify by reading control/doc mappings (`list_control_documents`, `document_resources`).",
  "",
  "### workflow_triage_failing_controls",
  "",
  "1. Read failing tests/entities (`tests`, `list_test_entities`, `list_control_tests`).",
  "2. Run `workflow_triage_failing_controls` with `mode=plan`.",
  "3. Execute approved actions with `mode=execute`, `confirm=true`.",
  "4. Read back updated controls/tests/entities.",
  "",
  "### workflow_vendor_triage",
  "",
  "1. Read vendors/findings/reviews (`vendors`, `list_vendor_findings`, `list_vendor_documents`).",
  "2. Run `workflow_vendor_triage` with `mode=plan`.",
  "3. Execute with explicit actions and `confirm=true`.",
  "4. Validate vendor status/findings and review document linkage.",
  "",
  "### workflow_people_assets_vuln_triage",
  "",
  "1. Read people/assets/vulnerabilities (`people`, `list_vulnerable_assets`, `vulnerabilities`).",
  "2. Run `workflow_people_assets_vuln_triage` with `mode=plan`.",
  "3. Execute approved lifecycle actions with `confirm=true`.",
  "4. Re-read vulnerability and remediation state.",
  "",
  "### workflow_information_request_triage",
  "",
  "1. Read open audit information requests and evidence.",
  "2. Run `workflow_information_request_triage` with `mode=plan`.",
  "3. Execute comments/flag/accept actions with `confirm=true`.",
  "4. Verify status and activity transitions through read endpoints.",
  "",
];

export const buildHelpResourceMarkdown = (
  resourceId: HelpResourceId,
  context: HelpRenderContext,
): string => {
  if (resourceId === "resource://vanta-manage/help") {
    const lines: string[] = [];
    lines.push("# Vanta Manage MCP Help");
    lines.push("");
    lines.push(
      "Use this server for full Vanta API coverage (manage, audit, and connectors) with safe write defaults.",
    );
    lines.push("");
    lines.push("## Auth");
    lines.push("");
    lines.push("- `VANTA_ENV_FILE` points to JSON with `client_id` and `client_secret`.");
    lines.push("- Or set `VANTA_CLIENT_ID` + `VANTA_CLIENT_SECRET` directly.");
    lines.push("- Default scope: `vanta-api.all:read vanta-api.all:write`.");
    lines.push("");
    lines.push("## Tool Envelope Contract");
    lines.push("");
    lines.push("- Success: `{ success: true, data, message?, notes? }`");
    lines.push(
      "- Error: `{ success: false, error: { code, message, hint?, details? }, notes? }`",
    );
    lines.push("");
    lines.push("## Write Safety Contract");
    lines.push("");
    lines.push("- Mutating endpoint tools require `confirm=true` in safe mode.");
    lines.push("- Workflow execute mode requires `mode=execute` and `confirm=true`.");
    lines.push("- Without confirmation, server returns `confirmation_required` and no write occurs.");
    lines.push("");
    lines.push(...renderCatalogSummary(context));
    lines.push(...renderSafetySummary(context));
    lines.push(...renderDiscoverySection());
    lines.push("");
    lines.push("## Fallback Help Tool");
    lines.push("");
    lines.push("- Call `help` to return this index in tool format if your client does not fetch resources.");
    return lines.join("\n");
  }

  if (resourceId === "resource://vanta-manage/cheatsheet") {
    const lines: string[] = [];
    lines.push("# Vanta MCP Cheatsheet");
    lines.push("");
    lines.push("## Common Goals");
    lines.push("");
    lines.push("- Read controls: `controls`");
    lines.push("- Read control evidence links: `list_control_documents`");
    lines.push("- Upload evidence to a document: `upload_file_for_document` with `filename` + `contentBase64`");
    lines.push("- Map document to control: `add_document_to_control`");
    lines.push("- Triage failing controls: `workflow_triage_failing_controls`");
    lines.push("- Triage vendor findings/reviews: `workflow_vendor_triage`");
    lines.push("- Triage vulnerabilities: `workflow_people_assets_vuln_triage`");
    lines.push("- Triage audit information requests: `workflow_information_request_triage`");
    lines.push("");
    lines.push("## Minimal Call Shapes");
    lines.push("");
    lines.push(jsonBlock({ tool: "controls", input: { pageSize: 25 } }));
    lines.push("");
    lines.push(
      jsonBlock({
        tool: "workflow_control_evidence",
        input: { mode: "plan", controlId: "control-123" },
      }),
    );
    lines.push("");
    lines.push(
      jsonBlock({
        tool: "add_document_to_control",
        input: {
          controlId: "control-123",
          confirm: true,
          body: { documentId: "document-456" },
        },
      }),
    );
    lines.push("");
    lines.push(
      jsonBlock({
        tool: "upload_file_for_document",
        input: {
          documentId: "document-456",
          confirm: true,
          filename: "evidence.pdf",
          contentBase64: "<base64>",
          mimeType: "application/pdf",
        },
      }),
    );
    return lines.join("\n");
  }

  if (resourceId === "resource://vanta-manage/tool-catalog") {
    return [
      "# Vanta MCP Tool Catalog",
      "",
      ...renderCatalogSummary(context),
      ...renderEndpointTable(context),
      "",
      ...renderCompatTable(context),
      "",
      ...renderWorkflowTable(context),
    ].join("\n");
  }

  if (resourceId === "resource://vanta-manage/workflow-playbooks") {
    return [
      "# Vanta MCP Workflow Playbooks",
      "",
      "All workflow tools support `mode=plan` and `mode=execute`.",
      "Execute mode always requires `confirm=true`.",
      "",
      ...renderWorkflowSteps(),
    ].join("\n");
  }

  if (resourceId === "resource://vanta-manage/safety") {
    const lines: string[] = [];
    lines.push("# Vanta MCP Safety");
    lines.push("");
    lines.push(...renderSafetySummary(context));
    lines.push("## Mutation Rules");
    lines.push("");
    lines.push("- Endpoint write tools enforce `confirm=true` when safe mode is enabled.");
    lines.push("- Workflow tools execute only when `mode=execute` and `confirm=true`.");
    lines.push("- If write mode is disabled, writes return `write_disabled`.");
    lines.push("");
    lines.push("## Preview Behavior");
    lines.push("");
    lines.push("- Missing confirmation returns `success=false` with `error.code=confirmation_required`.");
    lines.push("- The response includes operation intent details without applying changes.");
    lines.push("");
    lines.push("## Operational Guidance");
    lines.push("");
    lines.push("- Use read endpoints first to scope targets before any write.");
    lines.push("- Prefer workflow tools for multi-step triage because they already enforce plan-first flow.");
    lines.push("- Always do readback verification after writes.");
    return lines.join("\n");
  }

  const lines: string[] = [];
  lines.push("# Vanta MCP Troubleshooting");
  lines.push("");
  lines.push("## Auth or Token Errors");
  lines.push("");
  lines.push("- Symptom: `request_failed` or 401/403 responses.");
  lines.push("- Check `VANTA_ENV_FILE` or direct env vars are valid.");
  lines.push("- Verify OAuth scopes include write scope for mutations.");
  lines.push("");
  lines.push("## confirmation_required");
  lines.push("");
  lines.push("- Symptom: mutation request returns `confirmation_required`.");
  lines.push("- Add `confirm=true` for endpoint writes.");
  lines.push("- For workflows, set `mode=execute` and `confirm=true`.");
  lines.push("");
  lines.push("## validation_error");
  lines.push("");
  lines.push("- Symptom: missing required IDs or invalid payload structure.");
  lines.push("- Recheck tool schema and required path/body fields.");
  lines.push("- Validate enum fields and date formats exactly as expected by endpoint.");
  lines.push("");
  lines.push("## Multipart Upload Issues");
  lines.push("");
  lines.push("- Ensure `filename` and `contentBase64` are present.");
  lines.push("- Set `mimeType` when known (for example `application/pdf`).");
  lines.push("- Use valid base64 without URL-safe substitutions.");
  lines.push("");
  lines.push("## Pagination and Cursor Flow");
  lines.push("");
  lines.push("- Carry forward `pageCursor` from previous response.");
  lines.push("- Respect `pageSize` limits (default API constraints apply).");
  lines.push("");
  lines.push("## API-side Permission Errors");
  lines.push("");
  lines.push("- Some objects may be inaccessible in current tenant/audit scope.");
  lines.push("- Verify object IDs belong to the same scope as your access token.");
  return lines.join("\n");
};

export const buildHelpToolMarkdown = (context: HelpRenderContext): string => {
  const lines: string[] = [];
  lines.push("# Vanta MCP Help Index");
  lines.push("");
  lines.push("Use resources for detailed guidance and prompts for task-focused runbooks.");
  lines.push("");
  lines.push(...renderDiscoverySection());
  lines.push("");
  lines.push(...renderCatalogSummary(context));
  return lines.join("\n");
};

export const buildVantaMcpHelpMarkdown = (context: HelpRenderContext): string =>
  [
    "# Vanta MCP Help",
    "",
    "Canonical reference generated from runtime metadata.",
    "",
    ...renderCatalogSummary(context),
    ...renderSafetySummary(context),
    ...renderDiscoverySection(),
    "",
    ...renderWorkflowSteps(),
    "",
    ...renderEndpointTable(context),
    "",
    ...renderCompatTable(context),
    "",
    ...renderWorkflowTable(context),
  ].join("\n");

export const buildResourcesPromptsReferenceMarkdown = (): string => {
  const lines: string[] = [];
  lines.push("# MCP Resources and Prompts");
  lines.push("");
  lines.push("Quick reference for agents using the Vanta Manage MCP help surface.");
  lines.push("");
  lines.push("## Usage Pattern");
  lines.push("");
  lines.push("1. Read `resource://vanta-manage/help` first.");
  lines.push("2. Pull `resource://vanta-manage/tool-catalog` to select exact tools.");
  lines.push("3. Use a `playbook_*` prompt to produce deterministic execution steps.");
  lines.push("4. Execute writes only with `confirm=true` and verify with readback calls.");
  lines.push("");
  lines.push("## Resources");
  lines.push("");
  lines.push("- `resource://vanta-manage/help`: onboarding, auth, safety, and discovery.");
  lines.push("- `resource://vanta-manage/cheatsheet`: quick mapping from objective to tools.");
  lines.push("- `resource://vanta-manage/tool-catalog`: live endpoint/compat/workflow catalog.");
  lines.push("- `resource://vanta-manage/workflow-playbooks`: workflow-specific plan/execute runbooks.");
  lines.push("- `resource://vanta-manage/safety`: mutation guardrails and confirmation contract.");
  lines.push("- `resource://vanta-manage/troubleshooting`: common failures and corrective steps.");
  lines.push("");
  lines.push("## Prompts");
  lines.push("");
  lines.push("- `playbook_tool_selector(goal, scope?, constraints?)`");
  lines.push("- `playbook_control_evidence(objective, controlId?, documentId?)`");
  lines.push("- `playbook_failing_controls_triage(objective, controlId?)`");
  lines.push("- `playbook_vendor_triage(objective, vendorId?)`");
  lines.push("- `playbook_people_assets_vuln_triage(objective, vulnerabilityId?)`");
  lines.push("- `playbook_information_request_triage(objective, auditId)`");
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Prompt arguments are strings.");
  lines.push("- Prompts provide guidance only; they do not perform writes.");
  lines.push("- Workflow tools support `mode=plan` and `mode=execute`.");
  lines.push("- `mode=execute` always requires `confirm=true`.");
  lines.push("");
  lines.push("## Smoke Validation");
  lines.push("");
  lines.push(
    "- Run `npm run smoke:help-surface` to validate live MCP discovery of all resources/prompts plus the fallback `help` tool.",
  );
  lines.push(
    "- The smoke command requires Vanta credentials and skips if credentials are not configured.",
  );
  return lines.join("\n");
};
