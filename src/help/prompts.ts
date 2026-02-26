import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ControlEvidencePromptArgs,
  FailingControlsPromptArgs,
  InformationRequestPromptArgs,
  PeopleAssetsVulnPromptArgs,
  ToolSelectorPromptArgs,
  VendorTriagePromptArgs,
  helpPromptNames,
} from "./types.js";

const toPromptResult = (description: string, text: string) => ({
  description,
  messages: [
    {
      role: "user" as const,
      content: {
        type: "text" as const,
        text,
      },
    },
  ],
});

const executionReminder =
  "Execute only when approved. For writes: use confirm=true. For workflows: use mode=execute and confirm=true.";

const toolSelectorPrompt = (
  args: ToolSelectorPromptArgs,
): ReturnType<typeof toPromptResult> => {
  const scopeLine = args.scope ? `Scope: ${args.scope}` : "Scope: not specified";
  const constraintsLine = args.constraints
    ? `Constraints: ${args.constraints}`
    : "Constraints: none provided";
  const text = [
    "Create a deterministic Vanta tool-run plan for this objective.",
    `Objective: ${args.goal}`,
    scopeLine,
    constraintsLine,
    "",
    "Output format requirements:",
    "1. Recommended sequence of exact tool names.",
    "2. Distinguish read-first calls from mutating calls.",
    "3. Include safe execution reminders and confirm fields for every mutation.",
    "4. Include post-action readback verification calls.",
    "5. Include fallback path when permission or validation errors occur.",
    "",
    "Tool-family routing guidance:",
    "- Use compatibility read tools for simple object access (controls, documents, tests, people, vendors, vulnerabilities, frameworks, integrations, risks).",
    "- Use generated endpoint tools for object-specific operations and all connector sync endpoints.",
    "- Use workflow tools for multi-step triage and evidence orchestration.",
    "",
    executionReminder,
  ].join("\n");
  return toPromptResult("Route objective to Vanta tools.", text);
};

const controlEvidencePrompt = (
  args: ControlEvidencePromptArgs,
): ReturnType<typeof toPromptResult> => {
  const text = [
    "Build a strict plan for control evidence operations.",
    `Objective: ${args.objective}`,
    `Control ID: ${args.controlId ?? "not provided"}`,
    `Document ID: ${args.documentId ?? "not provided"}`,
    "",
    "Required sequence:",
    "1. Read controls (`controls`) and current links (`list_control_documents`).",
    "2. Run `workflow_control_evidence` in `mode=plan`.",
    "3. If uploading file evidence, use `upload_file_for_document` with `filename`, `contentBase64`, and optional `mimeType`.",
    "4. If linking existing evidence, use `add_document_to_control`.",
    "5. Execute approved writes only with `confirm=true`.",
    "6. Verify linkage via `list_control_documents` and `document_resources`.",
    "",
    executionReminder,
  ].join("\n");
  return toPromptResult("Control evidence playbook.", text);
};

const failingControlsPrompt = (
  args: FailingControlsPromptArgs,
): ReturnType<typeof toPromptResult> => {
  const text = [
    "Build a triage plan for failing controls and related test/document entities.",
    `Objective: ${args.objective}`,
    `Control ID focus: ${args.controlId ?? "all failing controls"}`,
    "",
    "Required sequence:",
    "1. Read candidate controls (`controls`) and control tests (`list_control_tests`).",
    "2. Read failing entities with `list_test_entities` and targeted test reads.",
    "3. Run `workflow_triage_failing_controls` with `mode=plan`.",
    "4. Execute approved updates (owner/status/entity actions) with `mode=execute` and `confirm=true`.",
    "5. Re-read controls/tests/entities and summarize deltas.",
    "",
    "Failure checks:",
    "- On validation errors, stop and correct required IDs before retry.",
    "- On permission errors, mark unresolved items and return read-only findings.",
    "",
    executionReminder,
  ].join("\n");
  return toPromptResult("Failing controls triage playbook.", text);
};

const vendorTriagePrompt = (
  args: VendorTriagePromptArgs,
): ReturnType<typeof toPromptResult> => {
  const text = [
    "Build a vendor lifecycle and findings triage plan.",
    `Objective: ${args.objective}`,
    `Vendor ID: ${args.vendorId ?? "not provided"}`,
    "",
    "Required sequence:",
    "1. Read baseline vendor state (`vendors`), documents, findings, and security reviews.",
    "2. Run `workflow_vendor_triage` in `mode=plan`.",
    "3. Execute approved vendor updates (`update_vendor`, `set_status_for_vendor`, finding updates, document uploads) with `confirm=true`.",
    "4. Verify by re-reading vendor, findings, and review documents.",
    "",
    "Failure checks:",
    "- If scope is ambiguous, return candidate vendors and request selection before writes.",
    "- If upload fails, preserve metadata-only update plan and retry file step separately.",
    "",
    executionReminder,
  ].join("\n");
  return toPromptResult("Vendor triage playbook.", text);
};

const peopleAssetsVulnPrompt = (
  args: PeopleAssetsVulnPromptArgs,
): ReturnType<typeof toPromptResult> => {
  const text = [
    "Build a triage plan across people, vulnerable assets, and vulnerabilities.",
    `Objective: ${args.objective}`,
    `Vulnerability ID focus: ${args.vulnerabilityId ?? "not provided"}`,
    "",
    "Required sequence:",
    "1. Read baseline with `people`, `list_vulnerable_assets`, `vulnerabilities`, and `list_vulnerability_remediations`.",
    "2. Run `workflow_people_assets_vuln_triage` with `mode=plan`.",
    "3. Execute approved lifecycle actions (`deactivate_vulnerabilities`, `reactivate_vulnerabilities`, `acknowledge_sla_miss_vulnerability_remediations`) with `confirm=true`.",
    "4. Verify with readback of vulnerabilities, remediations, and affected assets.",
    "",
    "Failure checks:",
    "- Ensure all target IDs are in scope before execution.",
    "- Distinguish temporary operational exceptions from permanent risk acceptance.",
    "",
    executionReminder,
  ].join("\n");
  return toPromptResult("People/assets/vulnerability triage playbook.", text);
};

const informationRequestPrompt = (
  args: InformationRequestPromptArgs,
): ReturnType<typeof toPromptResult> => {
  const text = [
    "Build an audit information-request triage plan.",
    `Objective: ${args.objective}`,
    `Audit ID: ${args.auditId}`,
    "",
    "Required sequence:",
    "1. Read open requests and current evidence (`list_information_requests`, `list_information_request_evidence`).",
    "2. Run `workflow_information_request_triage` with `mode=plan` and `auditId`.",
    "3. Execute approved actions (comments, flag evidence, accept evidence, request updates) with `mode=execute` and `confirm=true`.",
    "4. Verify transitions via activity and status reads (`list_information_request_activity`).",
    "",
    "Failure checks:",
    "- If request status changed during triage, refresh and re-plan before writes.",
    "- Preserve reviewer notes in comments for audit traceability.",
    "",
    executionReminder,
  ].join("\n");
  return toPromptResult("Audit information request playbook.", text);
};

export const registerHelpPrompts = (server: McpServer): number => {
  server.prompt(
    "playbook_tool_selector",
    "Route an objective to the right Vanta tool sequence.",
    {
      goal: z.string(),
      scope: z.string().optional(),
      constraints: z.string().optional(),
    },
    args => toolSelectorPrompt(args as ToolSelectorPromptArgs),
  );

  server.prompt(
    "playbook_control_evidence",
    "Control evidence workflow planning prompt.",
    {
      objective: z.string(),
      controlId: z.string().optional(),
      documentId: z.string().optional(),
    },
    args => controlEvidencePrompt(args as ControlEvidencePromptArgs),
  );

  server.prompt(
    "playbook_failing_controls_triage",
    "Failing controls and entities triage prompt.",
    {
      objective: z.string(),
      controlId: z.string().optional(),
    },
    args => failingControlsPrompt(args as FailingControlsPromptArgs),
  );

  server.prompt(
    "playbook_vendor_triage",
    "Vendor triage and findings workflow prompt.",
    {
      objective: z.string(),
      vendorId: z.string().optional(),
    },
    args => vendorTriagePrompt(args as VendorTriagePromptArgs),
  );

  server.prompt(
    "playbook_people_assets_vuln_triage",
    "People/assets/vulnerability triage workflow prompt.",
    {
      objective: z.string(),
      vulnerabilityId: z.string().optional(),
    },
    args => peopleAssetsVulnPrompt(args as PeopleAssetsVulnPromptArgs),
  );

  server.prompt(
    "playbook_information_request_triage",
    "Audit information request triage workflow prompt.",
    {
      objective: z.string(),
      auditId: z.string(),
    },
    args => informationRequestPrompt(args as InformationRequestPromptArgs),
  );

  return helpPromptNames.length;
};
