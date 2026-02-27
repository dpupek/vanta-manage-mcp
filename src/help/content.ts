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
  "resource://vanta-manage/recipes":
    "Task recipes for vulnerability, people, vendor, and policy-evidence workflows.",
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
  playbook_vulnerability_due_soon_triage:
    "Prioritize vulnerabilities due soon and enrich with scanner context.",
  playbook_employee_onboarding_verification:
    "Verify onboarding task status and identify blockers per employee.",
  playbook_employee_offboarding_tracker:
    "Track offboarding completion tasks and unresolved risk.",
  playbook_vendor_risk_assessment:
    "Assist vendor risk review using findings, docs, and status updates.",
  playbook_policy_document_evidence_linkage:
    "Cross-reference policy evidence and document evidence with readback verification.",
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

const renderRecipeSteps = (): string[] => [
  "## Recipe: Top 5 Vulnerable Devices (Asset-First, Exact)",
  "",
  "1. Pull candidate assets first with `list_vulnerable_assets` (use `pageSize` 100 when supported).",
  "2. If asset rows expose vulnerability rollups, rank directly by `critical` desc, `high` desc, `total` desc, then earliest SLA due date asc.",
  "3. If rollups are missing, enrich only candidate assets with `list_vulnerabilities` using `vulnerableAssetId` + `isDeactivated=false`.",
  "4. Compute a deterministic top-5 ranking and return device name, asset ID, and top CVEs per device.",
  "5. Use `get_vulnerable_asset` for final device metadata when needed (owner, scanner, network identifiers).",
  "6. Prefer this pattern over full global vulnerability pagination when objective is top devices.",
  "",
  "## Recipe: Triaging Vulnerabilities (Next 2 Weeks + Defender Context)",
  "",
  "1. Pull upcoming SLA items: `list_vulnerabilities` with `slaDeadlineBeforeDate` set to now + 14 days.",
  "2. Pull vulnerable assets for each candidate: `list_vulnerable_assets` filtered by `vulnerableAssetId` when available.",
  "3. Cross-reference scanner/integration context using `integration_resources` (for Defender or connected scanners).",
  "4. Prioritize by severity + due date + internet-facing/critical asset context.",
  "5. Generate remediation instructions and execute lifecycle changes with `workflow_people_assets_vuln_triage` (`mode=plan` first, then `mode=execute` + `confirm=true`).",
  "",
  "## Recipe: Employee Onboarding Verification",
  "",
  "1. Query onboarding status with `people` using `taskTypeMatchesAny` and `taskStatusMatchesAny` filters.",
  "2. For each person, verify required tasks are complete (`COMPLETED`) and no blocking failures remain (`FAILED`).",
  "3. For incomplete users, collect missing task types and expected due actions.",
  "4. Re-check after updates and keep an auditable snapshot of status transitions.",
  "",
  "## Recipe: Employee Offboarding Tracker",
  "",
  "1. Pull people/tasks scoped to offboarding using `people` with `taskTypeMatchesAny` for offboarding task types.",
  "2. Segment by status (`NOT_STARTED`, `IN_PROGRESS`, `FAILED`, `COMPLETED`) to surface blockers.",
  "3. Correlate with asset/vulnerability exposure using `list_vulnerable_assets` and `list_vulnerabilities` where relevant.",
  "4. Track open actions to completion and re-run read checks on a fixed cadence.",
  "",
  "## Recipe: Vendor Risk Assessment Assistance",
  "",
  "1. Pull vendors by status and criticality using `vendors`/`list_vendors`.",
  "2. Pull supporting records: `list_vendor_findings`, `list_vendor_documents`, `get_security_reviews_by_vendor_id`.",
  "3. Plan updates in `workflow_vendor_triage` (`mode=plan`) with explicit action list.",
  "4. Execute approved updates (`update_vendor`, `set_status_for_vendor`, findings updates, review document uploads) with `confirm=true`.",
  "5. Verify by reading vendor status/findings/review documents after execution.",
  "",
  "## Recipe: Policy Evidence <-> Document Evidence Cross-Reference",
  "",
  "1. Pull policy and evidence set: `list_policies` + `get_policy`, then `list_documents`/`get_document`.",
  "2. For each policy-backed evidence document, attach a reference link using `create_link_for_document` (policy URL or canonical policy locator).",
  "3. If needed, map document to controls with `add_document_to_control` so policy-evidence context is traceable in control reviews.",
  "4. Verify with `document_resources` (`resourceType=links` and `resourceType=controls`) and `list_control_documents` readback.",
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
    lines.push("- Set `VANTA_CLIENT_ID` + `VANTA_CLIENT_SECRET` directly (preferred).");
    lines.push(
      "- Or set `VANTA_ENV_FILE` to JSON (`client_id`/`client_secret`) or dotenv (`VANTA_CLIENT_ID`/`VANTA_CLIENT_SECRET`).",
    );
    lines.push("- Default scope: `vanta-api.all:read vanta-api.all:write`.");
    lines.push("");
    lines.push("## Tool Envelope Contract");
    lines.push("");
    lines.push("- Success: `{ success: true, data, message?, notes? }`");
    lines.push(
      "- Error: `{ success: false, error: { code, message, hint?, agentHint?, details? }, notes? }`",
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
    lines.push("- Upload evidence to a document: `upload_file_for_document` with `filePath`");
    lines.push("- Map document to control: `add_document_to_control`");
    lines.push("- Triage failing controls: `workflow_triage_failing_controls`");
    lines.push("- Triage vendor findings/reviews: `workflow_vendor_triage`");
    lines.push("- Triage vulnerabilities: `workflow_people_assets_vuln_triage`");
    lines.push("- Top 5 vulnerable devices (fast): `list_vulnerable_assets` first, then targeted `list_vulnerabilities` by `vulnerableAssetId`");
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
          filePath: "C:\\\\evidence\\\\evidence.pdf",
          mimeType: "application/pdf",
        },
      }),
    );
    return lines.join("\n");
  }

  if (resourceId === "resource://vanta-manage/recipes") {
    return ["# Vanta MCP Recipes", "", ...renderRecipeSteps()].join("\n");
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
  lines.push("- Ensure `filePath` points to an existing readable local file.");
  lines.push("- Use a supported extension (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip`, `.ps`).");
  lines.push("- Set `mimeType` when known (for example `application/pdf`) and keep it aligned with the file extension.");
  lines.push("");
  lines.push("## Pagination and Cursor Flow");
  lines.push("");
  lines.push("- Carry forward `pageCursor` from previous response.");
  lines.push("- Respect `pageSize` limits (default API constraints apply).");
  lines.push(
    "- For `top vulnerable devices` requests, avoid full global vulnerability paging: use asset-first ranking with `list_vulnerable_assets`, then targeted `list_vulnerabilities(vulnerableAssetId=...)`.",
  );
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
  lines.push("- `resource://vanta-manage/recipes`: step-by-step operational recipes for common compliance tasks.");
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
  lines.push("- `playbook_vulnerability_due_soon_triage(objective, dueWindowDays?, integrationHint?)`");
  lines.push("- `playbook_employee_onboarding_verification(objective, personId?)`");
  lines.push("- `playbook_employee_offboarding_tracker(objective, personId?)`");
  lines.push("- `playbook_vendor_risk_assessment(objective, vendorId?)`");
  lines.push("- `playbook_policy_document_evidence_linkage(objective, policyId?, documentId?)`");
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
