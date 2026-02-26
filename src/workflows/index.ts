import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VantaApiClient } from "../client/vanta-client.js";
import { errorEnvelope, successEnvelope, toToolResult } from "../envelope.js";
import { isToolEnabled, writeEnabled } from "../config.js";
import {
  getGeneratedToolNameByOperationId,
  invokeGeneratedOperation,
} from "../tools/endpoint-tools.js";

export interface WorkflowToolMetadata {
  name: string;
  description: string;
  mode: "plan_execute_confirmed";
}

export const workflowToolMetadata: WorkflowToolMetadata[] = [
  {
    name: "workflow_control_evidence",
    description:
      "Plan or execute control evidence actions (document linkage and document uploads).",
    mode: "plan_execute_confirmed",
  },
  {
    name: "workflow_triage_failing_controls",
    description:
      "Plan or execute triage for failing controls/tests/documents and optionally set owners.",
    mode: "plan_execute_confirmed",
  },
  {
    name: "workflow_vendor_triage",
    description:
      "Plan or execute vendor lifecycle actions (status updates, findings, and security-review documents).",
    mode: "plan_execute_confirmed",
  },
  {
    name: "workflow_people_assets_vuln_triage",
    description:
      "Plan or execute people/assets/vulnerability triage actions including vulnerability lifecycle updates.",
    mode: "plan_execute_confirmed",
  },
  {
    name: "workflow_information_request_triage",
    description:
      "Plan or execute audit information request triage actions (comments, evidence flag/accept).",
    mode: "plan_execute_confirmed",
  },
];

const workflowModeSchema = z.enum(["plan", "execute"]);

const workflowExecuteGate = (
  mode: "plan" | "execute",
  confirm: boolean | undefined,
) => {
  if (mode === "plan") {
    return null;
  }
  if (!writeEnabled) {
    return errorEnvelope(
      "write_disabled",
      "Workflow execution is disabled by VANTA_MCP_ENABLE_WRITE=false.",
    );
  }
  if (confirm !== true) {
    return errorEnvelope(
      "confirmation_required",
      "Workflow execute mode requires confirm=true.",
      "Call the workflow with mode=execute and confirm=true to apply changes.",
    );
  }
  return null;
};

const executeOperation = async (
  operationId: string,
  args: Record<string, unknown>,
  client: VantaApiClient,
  source: "manage" | "audit" | "connectors" = "manage",
) => {
  const toolName = getGeneratedToolNameByOperationId(operationId, source);
  if (!toolName) {
    return toToolResult(
      errorEnvelope(
        "missing_generated_operation",
        `Operation '${operationId}' not found in generated tools.`,
      ),
    );
  }
  return invokeGeneratedOperation(toolName, args, client);
};

const parseEnvelope = (resultText: string): unknown => {
  try {
    return JSON.parse(resultText);
  } catch {
    return resultText;
  }
};

const getResultPayload = (result: Awaited<ReturnType<typeof executeOperation>>) => {
  const first = result.content[0];
  if (first.type !== "text") {
    return null;
  }
  return parseEnvelope(first.text);
};

const registerControlEvidenceWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_control_evidence";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  server.tool(
    toolName,
    "Plan or execute control evidence actions (document linkage and document uploads).",
    {
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      controlId: z.string().optional(),
      documentId: z.string().optional(),
      filename: z.string().optional(),
      contentBase64: z.string().optional(),
      mimeType: z.string().optional(),
      effectiveAtDate: z.string().optional(),
      description: z.string().optional(),
    },
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      if (args.mode === "plan") {
        const controls = await executeOperation(
          "ListControls",
          { pageSize: 25 },
          client,
        );
        const currentControl =
          args.controlId !== undefined
            ? await executeOperation(
                "GetControl",
                { controlId: args.controlId },
                client,
              )
            : null;

        return toToolResult(
          successEnvelope(
            {
              summary: "Control evidence workflow plan.",
              recommendedActions: [
                "Review selected controls and mapped evidence.",
                "Attach an existing document via documentId, or upload to an existing document using filename/contentBase64.",
              ],
              context: {
                selectedControlId: args.controlId ?? null,
                selectedDocumentId: args.documentId ?? null,
              },
              reads: {
                controls: getResultPayload(controls),
                control: currentControl ? getResultPayload(currentControl) : null,
              },
            },
            "Plan generated. No mutations were executed.",
          ),
        );
      }

      if (!args.controlId) {
        return toToolResult(
          errorEnvelope(
            "validation_error",
            "controlId is required in execute mode.",
          ),
        );
      }

      const executionResults: { step: string; result: unknown }[] = [];

      if (args.documentId) {
        const attachResult = await executeOperation(
          "AddDocumentToControl",
          {
            controlId: args.controlId,
            body: {
              documentId: args.documentId,
            },
            confirm: true,
          },
          client,
        );
        executionResults.push({
          step: "attach_document_to_control",
          result: getResultPayload(attachResult),
        });
      }

      if (args.documentId && args.filename && args.contentBase64) {
        const uploadResult = await executeOperation(
          "UploadFileForDocument",
          {
            documentId: args.documentId,
            filename: args.filename,
            contentBase64: args.contentBase64,
            mimeType: args.mimeType,
            effectiveAtDate: args.effectiveAtDate,
            description: args.description,
            confirm: true,
          },
          client,
        );
        executionResults.push({
          step: "upload_file_for_document",
          result: getResultPayload(uploadResult),
        });
      }

      return toToolResult(
        successEnvelope(
          {
            executed: executionResults,
          },
          "Control evidence workflow executed.",
        ),
      );
    },
  );

  return true;
};

const registerFailingControlsWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_triage_failing_controls";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  const actionSchema = z.object({
    type: z.enum([
      "deactivate_test_entity",
      "reactivate_test_entity",
      "update_control_metadata",
    ]),
    controlId: z.string().optional(),
    testId: z.string().optional(),
    entityId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  server.tool(
    toolName,
    "Plan or execute triage actions for failing controls/tests/entities.",
    {
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      actions: z.array(actionSchema).optional(),
    },
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      if (args.mode === "plan") {
        const tests = await executeOperation(
          "ListTests",
          { pageSize: 50, statusFilter: "NEEDS_ATTENTION" },
          client,
        );
        return toToolResult(
          successEnvelope(
            {
              summary: "Failing controls triage plan.",
              recommendations: [
                "Inspect failing tests and affected entities.",
                "Choose actions to deactivate/reactivate entities or update control metadata.",
              ],
              failingTests: getResultPayload(tests),
            },
            "Plan generated. No mutations were executed.",
          ),
        );
      }

      const actions = args.actions ?? [];
      const results: { action: unknown; result: unknown }[] = [];
      for (const action of actions) {
        if (action.type === "deactivate_test_entity") {
          if (!action.testId || !action.entityId) {
            results.push({
              action,
              result: errorEnvelope(
                "validation_error",
                "testId and entityId are required for deactivate_test_entity.",
              ),
            });
            continue;
          }
          const result = await executeOperation(
            "DeactivateTestEntity",
            {
              testId: action.testId,
              entityId: action.entityId,
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }

        if (action.type === "reactivate_test_entity") {
          if (!action.testId || !action.entityId) {
            results.push({
              action,
              result: errorEnvelope(
                "validation_error",
                "testId and entityId are required for reactivate_test_entity.",
              ),
            });
            continue;
          }
          const result = await executeOperation(
            "ReactivateTestEntity",
            {
              testId: action.testId,
              entityId: action.entityId,
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }

        if (!action.controlId || !action.metadata) {
          results.push({
            action,
            result: errorEnvelope(
              "validation_error",
              "controlId and metadata are required for update_control_metadata.",
            ),
          });
          continue;
        }
        const result = await executeOperation(
          "UpdateControlMetadata",
          {
            controlId: action.controlId,
            body: action.metadata,
            confirm: true,
          },
          client,
        );
        results.push({ action, result: getResultPayload(result) });
      }

      return toToolResult(
        successEnvelope({ executed: results }, "Failing controls triage executed."),
      );
    },
  );

  return true;
};

const registerVendorWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_vendor_triage";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  const actionSchema = z.object({
    type: z.enum([
      "update_vendor",
      "set_vendor_status",
      "create_finding",
      "update_finding",
      "upload_security_review_document",
    ]),
    vendorId: z.string(),
    findingId: z.string().optional(),
    securityReviewId: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    filename: z.string().optional(),
    contentBase64: z.string().optional(),
    mimeType: z.string().optional(),
  });

  server.tool(
    toolName,
    "Plan or execute vendor lifecycle triage actions.",
    {
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      vendorId: z.string().optional(),
      actions: z.array(actionSchema).optional(),
    },
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      if (args.mode === "plan") {
        const vendors = await executeOperation(
          "ListVendors",
          { pageSize: 25 },
          client,
        );
        return toToolResult(
          successEnvelope(
            {
              summary: "Vendor triage plan.",
              recommendations: [
                "Review vendor statuses and open findings.",
                "Execute targeted vendor/finding/document updates.",
              ],
              vendors: getResultPayload(vendors),
            },
            "Plan generated. No mutations were executed.",
          ),
        );
      }

      const results: { action: unknown; result: unknown }[] = [];
      for (const action of args.actions ?? []) {
        if (action.type === "update_vendor") {
          const result = await executeOperation(
            "UpdateVendor",
            {
              vendorId: action.vendorId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        if (action.type === "set_vendor_status") {
          const result = await executeOperation(
            "SetStatusForVendor",
            {
              vendorId: action.vendorId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        if (action.type === "create_finding") {
          const result = await executeOperation(
            "CreateVendorFinding",
            {
              vendorId: action.vendorId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        if (action.type === "update_finding") {
          const result = await executeOperation(
            "UpdateVendorFinding",
            {
              vendorId: action.vendorId,
              findingId: action.findingId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }

        const result = await executeOperation(
          "UploadDocumentForSecurityReview",
          {
            vendorId: action.vendorId,
            securityReviewId: action.securityReviewId,
            filename: action.filename,
            contentBase64: action.contentBase64,
            mimeType: action.mimeType,
            ...action.payload,
            confirm: true,
          },
          client,
        );
        results.push({ action, result: getResultPayload(result) });
      }

      return toToolResult(
        successEnvelope({ executed: results }, "Vendor triage executed."),
      );
    },
  );

  return true;
};

const registerPeopleAssetsVulnWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_people_assets_vuln_triage";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  const actionSchema = z.object({
    type: z.enum([
      "deactivate_vulnerabilities",
      "reactivate_vulnerabilities",
      "acknowledge_sla_miss",
    ]),
    payload: z.record(z.string(), z.unknown()),
  });

  server.tool(
    toolName,
    "Plan or execute people/assets/vulnerability triage actions.",
    {
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      actions: z.array(actionSchema).optional(),
    },
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      if (args.mode === "plan") {
        const vulnerabilities = await executeOperation(
          "ListVulnerabilities",
          { pageSize: 50, severity: "HIGH" },
          client,
        );
        const assets = await executeOperation(
          "ListVulnerableAssets",
          { pageSize: 50 },
          client,
        );
        const people = await executeOperation("ListPeople", { pageSize: 50 }, client);
        return toToolResult(
          successEnvelope(
            {
              summary: "People/assets/vulnerabilities triage plan.",
              vulnerabilities: getResultPayload(vulnerabilities),
              vulnerableAssets: getResultPayload(assets),
              people: getResultPayload(people),
            },
            "Plan generated. No mutations were executed.",
          ),
        );
      }

      const results: { action: unknown; result: unknown }[] = [];
      for (const action of args.actions ?? []) {
        if (action.type === "deactivate_vulnerabilities") {
          const result = await executeOperation(
            "DeactivateVulnerabilities",
            {
              body: action.payload,
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        if (action.type === "reactivate_vulnerabilities") {
          const result = await executeOperation(
            "ReactivateVulnerabilities",
            {
              body: action.payload,
              confirm: true,
            },
            client,
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        const result = await executeOperation(
          "AcknowledgeSlaMissVulnerabilityRemediations",
          {
            body: action.payload,
            confirm: true,
          },
          client,
        );
        results.push({ action, result: getResultPayload(result) });
      }

      return toToolResult(
        successEnvelope(
          { executed: results },
          "People/assets/vulnerability triage executed.",
        ),
      );
    },
  );

  return true;
};

const registerInformationRequestWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_information_request_triage";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  const actionSchema = z.object({
    type: z.enum([
      "update_request",
      "create_comment",
      "flag_evidence",
      "accept_evidence",
    ]),
    requestId: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
  });

  server.tool(
    toolName,
    "Plan or execute audit information request triage actions.",
    {
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      auditId: z.string(),
      actions: z.array(actionSchema).optional(),
    },
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      if (args.mode === "plan") {
        const list = await executeOperation(
          "ListInformationRequests",
          {
            auditId: args.auditId,
            pageSize: 100,
          },
          client,
          "audit",
        );
        return toToolResult(
          successEnvelope(
            {
              summary: "Information request triage plan.",
              openRequests: getResultPayload(list),
            },
            "Plan generated. No mutations were executed.",
          ),
        );
      }

      const results: { action: unknown; result: unknown }[] = [];
      for (const action of args.actions ?? []) {
        if (action.type === "update_request") {
          const result = await executeOperation(
            "UpdateInformationRequest",
            {
              auditId: args.auditId,
              requestId: action.requestId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
            "audit",
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        if (action.type === "create_comment") {
          const result = await executeOperation(
            "CreateCommentForInformationRequest",
            {
              auditId: args.auditId,
              requestId: action.requestId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
            "audit",
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        if (action.type === "flag_evidence") {
          const result = await executeOperation(
            "FlagInformationRequestEvidence",
            {
              auditId: args.auditId,
              requestId: action.requestId,
              body: action.payload ?? {},
              confirm: true,
            },
            client,
            "audit",
          );
          results.push({ action, result: getResultPayload(result) });
          continue;
        }
        const result = await executeOperation(
          "AcceptInformationRequestEvidence",
          {
            auditId: args.auditId,
            requestId: action.requestId,
            body: action.payload ?? {},
            confirm: true,
          },
          client,
          "audit",
        );
        results.push({ action, result: getResultPayload(result) });
      }

      return toToolResult(
        successEnvelope(
          { executed: results },
          "Information request triage executed.",
        ),
      );
    },
  );

  return true;
};

export function registerWorkflowTools(
  server: McpServer,
  client: VantaApiClient,
): number {
  let registered = 0;
  if (registerControlEvidenceWorkflow(server, client)) {
    registered += 1;
  }
  if (registerFailingControlsWorkflow(server, client)) {
    registered += 1;
  }
  if (registerVendorWorkflow(server, client)) {
    registered += 1;
  }
  if (registerPeopleAssetsVulnWorkflow(server, client)) {
    registered += 1;
  }
  if (registerInformationRequestWorkflow(server, client)) {
    registered += 1;
  }
  return registered;
}
