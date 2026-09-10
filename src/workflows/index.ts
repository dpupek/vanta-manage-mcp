import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VantaApiClient } from "../client/vanta-client.js";
import { errorEnvelope, successEnvelope, toToolResult } from "../envelope.js";
import { isToolEnabled, writeEnabled } from "../config.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { generatedOperationByToolName } from "../generated/operations.generated.js";
import { buildOperationSchema } from "../tools/operation-schema.js";
import { prepareUploadFileInput } from "../uploads/file-validation.js";
import { cleanupMarkdownConversionArtifacts } from "../uploads/markdown-conversion.js";
import { UploadValidationResult } from "../uploads/types.js";
import {
  currentRequestSignal,
  withRequestSignal,
} from "../client/request-context.js";
import { collectInventory, CollectionOptions } from "./pagination.js";
import {
  getGeneratedToolNameByOperationId,
  invokeGeneratedOperation,
} from "../tools/endpoint-tools.js";

export interface WorkflowToolMetadata {
  name: string;
  description: string;
  mode: "plan_execute_confirmed" | "plan_only";
}

export const workflowToolMetadata: WorkflowToolMetadata[] = [
  {
    name: "workflow_issue_event_triage",
    description:
      "Plan issue and event-log review with independent, bounded inventories; no mutations.",
    mode: "plan_only",
  },
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
    name: "workflow_resource_owner_assignment",
    description:
      "Plan or execute integration resource owner and description updates with CURRENT employee validation.",
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

const registerWorkflow = <Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: Shape,
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>,
): void => {
  const schema = z.object(shape);
  server.tool<z.ZodRawShape>(name, description, shape, async (raw, extra) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      return toToolResult(
        errorEnvelope(
          "validation_error",
          "Invalid workflow arguments.",
          "Correct the indicated fields before executing.",
          { issues: parsed.error.issues },
        ),
      );
    try {
      return await withRequestSignal(extra.signal, () => handler(parsed.data));
    } catch (error) {
      return toToolResult(
        errorEnvelope(
          "request_failed",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  });
};

interface PlannedAction {
  action: unknown;
  operationId: string;
  args: Record<string, unknown>;
  source?: "manage" | "audit" | "connectors";
  dependsOnPrevious?: boolean;
  bulkUpdates?: boolean;
}

const actionArguments = (
  operationId: string,
  ids: Record<string, unknown>,
  payload?: Record<string, unknown>,
  source: PlannedAction["source"] = "manage",
): Record<string, unknown> => {
  const name = getGeneratedToolNameByOperationId(operationId, source);
  const operation = name ? generatedOperationByToolName[name] : undefined;
  return operation?.requestBody?.kind === "multipart"
    ? { ...payload, ...ids, confirm: true }
    : {
        ...ids,
        ...(operation?.requestBody ? { body: payload ?? {} } : {}),
        confirm: true,
      };
};

const batchEnvelope = (
  executed: {
    action?: unknown;
    step?: string;
    result: unknown;
    skipped?: boolean;
  }[],
  message: string,
) => {
  const counts = { succeeded: 0, failed: 0, skipped: 0 };
  const outcomes = executed.map(item => {
    const status = item.skipped
      ? "skipped"
      : readRecord(item.result)?.success === true
        ? "succeeded"
        : "failed";
    counts[status] += 1;
    return { ...item, status };
  });
  const data = { executed: outcomes, counts };
  return counts.failed || counts.skipped
    ? errorEnvelope(
        "workflow_failed",
        "Workflow did not complete successfully.",
        "Inspect per-action outcomes; re-plan before retrying failed work.",
        data,
      )
    : successEnvelope(data, message);
};

const executeActionBatch = async (
  actions: PlannedAction[],
  client: VantaApiClient,
  message: string,
): Promise<CallToolResult> => {
  const uploads = new Map<number, UploadValidationResult>();
  try {
    // Validate the complete batch before applying its first write.
    for (const [index, action] of actions.entries()) {
      const name = getGeneratedToolNameByOperationId(
        action.operationId,
        action.source ?? "manage",
      );
      const operation = name ? generatedOperationByToolName[name] : undefined;
      const parsed = operation
        ? buildOperationSchema(operation).safeParse(action.args)
        : undefined;
      if (!parsed?.success)
        return toToolResult(
          errorEnvelope(
            "validation_error",
            "Workflow batch validation failed; no actions were executed.",
            undefined,
            {
              index,
              operationId: action.operationId,
              issues: parsed?.error.issues,
            },
          ),
        );
      if (
        operation?.requestBody?.fileFieldName &&
        action.args.filePath !== undefined
      ) {
        const upload = await prepareUploadFileInput(
          name ?? action.operationId,
          action.args,
        );
        uploads.set(index, upload);
        if (!upload.success)
          return toToolResult(
            errorEnvelope(
              "validation_error",
              "Workflow upload preflight failed; no actions were executed.",
              upload.error.hint,
              { index, error: upload.error },
            ),
          );
      }
    }
    const executed: { action: unknown; result: unknown; skipped?: boolean }[] =
      [];
    for (const [index, action] of actions.entries()) {
      if (currentRequestSignal()?.aborted) {
        executed.push({
          action: action.action,
          result: { reason: "Workflow cancelled." },
          skipped: true,
        });
        continue;
      }
      if (
        action.dependsOnPrevious &&
        readRecord(executed[index - 1]?.result)?.success !== true
      ) {
        executed.push({
          action: action.action,
          result: { reason: "Prerequisite action failed." },
          skipped: true,
        });
        continue;
      }
      const upload = uploads.get(index);
      const result = await executeOperation(
        action.operationId,
        action.args,
        client,
        action.source,
        upload ? () => Promise.resolve(upload) : undefined,
      );
      let payload = getResultPayload(result);
      if (action.bulkUpdates && readRecord(payload)?.success === true) {
        const envelope = readRecord(payload);
        const updates = readRecord(action.args.body)?.updates as Record<
          string,
          unknown
        >[];
        const results = readBulkResults(envelope?.data);
        const succeeded: Record<string, unknown>[] = [];
        const failed: Record<string, unknown>[] = [];
        for (const [index, update] of updates.entries()) {
          const item = results.at(index);
          if (item && item.id === update.id && item.status === "SUCCESS") {
            succeeded.push(item);
          } else {
            failed.push(
              item && item.id === update.id
                ? item
                : {
                    id: update.id,
                    status: "ERROR",
                    message:
                      "Missing or mismatched bulk result; verify before retrying.",
                    received: item,
                  },
            );
          }
        }
        if (failed.length > 0 || results.length !== updates.length) {
          payload = errorEnvelope(
            "bulk_update_failed",
            "Bulk action did not confirm success for every requested update.",
            "Inspect per-item results and read back unconfirmed updates before retrying.",
            { succeeded, failed, apiResponse: envelope?.data },
          );
        }
      }
      executed.push({
        action: action.action,
        result: payload,
      });
    }
    return toToolResult(batchEnvelope(executed, message));
  } finally {
    for (const upload of uploads.values())
      if (upload.success)
        await cleanupMarkdownConversionArtifacts(upload.cleanupPaths);
  }
};

const planEnvelope = (data: Record<string, unknown>) => {
  const state = { failed: false, incomplete: false };
  const inspect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    const record = readRecord(value);
    if (!record) return;
    if (record.success === false) state.failed = true;
    if (readRecord(record.collection)?.complete === false)
      state.incomplete = true;
    Object.values(record).forEach(inspect);
  };
  inspect(data);
  return state.failed
    ? errorEnvelope(
        "workflow_read_failed",
        "Unable to complete workflow planning reads.",
        "Inspect failed reads before executing any actions.",
        { plan: data },
      )
    : successEnvelope(
        data,
        "Plan generated. No mutations were executed.",
        undefined,
        {
          warnings: state.incomplete
            ? [
                "Plan uses an incomplete inventory. Inspect collection.nextPageCursor and resume each affected inventory before treating this plan as exhaustive.",
              ]
            : [],
          metadata: { complete: !state.incomplete },
        },
      );
};

const collectionShape = {
  pageSize: z.number().int().min(1).max(100).optional(),
  pageCursor: z.string().min(1).optional(),
  maxPages: z.number().int().min(1).max(100).optional(),
};

const readInventory = (
  operationId: string,
  args: Record<string, unknown>,
  client: VantaApiClient,
  options: CollectionOptions,
  source: PlannedAction["source"] = "manage",
) =>
  collectInventory(
    async pagination =>
      getResultPayload(
        await executeOperation(
          operationId,
          compactRecord({ ...args, ...pagination }),
          client,
          source,
        ),
      ),
    options,
  );

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
  prepareUpload?: typeof prepareUploadFileInput,
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
  return invokeGeneratedOperation(toolName, args, client, prepareUpload);
};

const parseEnvelope = (resultText: string): unknown => {
  try {
    return JSON.parse(resultText);
  } catch {
    return resultText;
  }
};

const getResultPayload = (
  result: Awaited<ReturnType<typeof executeOperation>>,
) => {
  const first = result.content[0];
  if (first.type !== "text") {
    return null;
  }
  return parseEnvelope(first.text);
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const readArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const compactRecord = (
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      compacted[key] = value;
    }
  }
  return compacted;
};

const readPaginatedData = (data: unknown): Record<string, unknown>[] => {
  const root = readRecord(data);
  const results = readRecord(root?.results);
  const values = readArray(results?.data).length
    ? readArray(results?.data)
    : readArray(root?.results);
  return values.flatMap(value => {
    const record = readRecord(value);
    return record ? [record] : [];
  });
};

const readBulkResults = (data: unknown): Record<string, unknown>[] => {
  const root = readRecord(data);
  return readArray(root?.results).flatMap(value => {
    const record = readRecord(value);
    return record ? [record] : [];
  });
};

const readEmploymentStatus = (person: Record<string, unknown>): string | null =>
  readString(readRecord(person.employment)?.status);

const readEmailAddress = (person: Record<string, unknown>): string | null =>
  readString(person.emailAddress)?.toLowerCase() ?? null;

const readPersonName = (person: Record<string, unknown>): string | null =>
  readString(readRecord(person.name)?.display);

const resourceIdFromRecord = (
  resource: Record<string, unknown>,
): string | null => readString(resource.resourceId) ?? readString(resource.id);

const chunk = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

interface ResolvedOwner {
  id: string;
  emailAddress?: string;
  displayName?: string;
  employmentStatus: string;
}

const resolveOwner = async (
  client: VantaApiClient,
  args: { ownerId?: string; ownerEmail?: string; maxPages?: number },
): Promise<
  | { success: true; owner: ResolvedOwner }
  | { success: false; envelope: ReturnType<typeof errorEnvelope> }
> => {
  if (!args.ownerId && !args.ownerEmail) {
    return {
      success: false,
      envelope: errorEnvelope(
        "validation_error",
        "Provide ownerId or ownerEmail for resource owner assignment.",
        "Use list_people or ownerEmail to resolve a CURRENT employee before assigning resources.",
      ),
    };
  }

  if (args.ownerId) {
    const response = await client.request({
      method: "get",
      path: `/people/${encodeURIComponent(args.ownerId)}`,
    });
    if (!response.ok) {
      return {
        success: false,
        envelope: errorEnvelope(
          "api_error",
          `Unable to validate ownerId '${args.ownerId}'.`,
          "Verify the person ID and Vanta API scopes.",
          response.data,
        ),
      };
    }
    const person = readRecord(response.data);
    const status = person ? readEmploymentStatus(person) : null;
    if (!person || status !== "CURRENT") {
      return {
        success: false,
        envelope: errorEnvelope(
          "validation_error",
          "Resource owners must be CURRENT employees.",
          "Choose a CURRENT person before assigning integration resources.",
          {
            ownerId: args.ownerId,
            employmentStatus: status,
          },
        ),
      };
    }
    return {
      success: true,
      owner: {
        id: args.ownerId,
        emailAddress: readString(person.emailAddress) ?? undefined,
        displayName: readPersonName(person) ?? undefined,
        employmentStatus: status,
      },
    };
  }

  const ownerEmail = args.ownerEmail?.toLowerCase() ?? "";
  const inventory = await readInventory("ListPeople", {}, client, {
    maxPages: args.maxPages,
  });
  if (!inventory.success) return { success: false, envelope: inventory };
  const payload = readRecord(inventory.data);
  if (readRecord(payload?.collection)?.complete !== true)
    return {
      success: false,
      envelope: errorEnvelope(
        "workflow_read_incomplete",
        "Owner lookup reached its page limit.",
        "Increase maxPages or supply ownerId before executing.",
        payload,
      ),
    };
  const matches = readPaginatedData(inventory.data).filter(
    person =>
      readEmailAddress(person) === ownerEmail &&
      readEmploymentStatus(person) === "CURRENT",
  );

  if (matches.length !== 1) {
    return {
      success: false,
      envelope: errorEnvelope(
        "validation_error",
        matches.length === 0
          ? "No CURRENT Vanta person matched ownerEmail."
          : "Multiple CURRENT Vanta people matched ownerEmail.",
        "Resolve the owner manually and retry with ownerId.",
        {
          ownerEmail: args.ownerEmail,
          matches: matches.map(person => ({
            id: readString(person.id),
            emailAddress: readString(person.emailAddress),
            displayName: readPersonName(person),
          })),
        },
      ),
    };
  }

  const person = matches[0];
  const ownerId = readString(person.id);
  if (!ownerId) {
    return {
      success: false,
      envelope: errorEnvelope(
        "validation_error",
        "Matched Vanta person did not include an ID.",
        "Retry with ownerId copied from Vanta.",
        { ownerEmail: args.ownerEmail },
      ),
    };
  }

  return {
    success: true,
    owner: {
      id: ownerId,
      emailAddress: readString(person.emailAddress) ?? undefined,
      displayName: readPersonName(person) ?? undefined,
      employmentStatus: readEmploymentStatus(person) ?? "CURRENT",
    },
  };
};

const listIntegrationResourcesForOwnerWorkflow = async (
  client: VantaApiClient,
  args: CollectionOptions & {
    integrationId: string;
    resourceKind: string;
    hasOwner?: boolean;
    hasDescription?: boolean;
    isInScope?: boolean;
  },
): Promise<
  | {
      success: true;
      resources: Record<string, unknown>[];
      pageInfo?: unknown;
      collection?: Record<string, unknown>;
    }
  | { success: false; envelope: ReturnType<typeof errorEnvelope> }
> => {
  const inventory = await readInventory(
    "ListResources",
    compactRecord({
      integrationId: args.integrationId,
      resourceKind: args.resourceKind,
      hasOwner: args.hasOwner ?? false,
      hasDescription: args.hasDescription,
      isInScope: args.isInScope ?? true,
    }),
    client,
    args,
  );
  if (!inventory.success) return { success: false, envelope: inventory };
  const payload = readRecord(inventory.data);
  return {
    success: true,
    resources: readPaginatedData(inventory.data),
    pageInfo: readRecord(payload?.results)?.pageInfo,
    collection: readRecord(payload?.collection) ?? undefined,
  };
};

const registerControlEvidenceWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_control_evidence";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  registerWorkflow(
    server,
    toolName,
    "Plan or execute control evidence actions (document linkage and document uploads).",
    {
      ...collectionShape,
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      controlId: z.string().optional(),
      documentId: z.string().optional(),
      filePath: z.string().optional(),
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
        const controls = await readInventory("ListControls", {}, client, args);
        const currentControl =
          args.controlId !== undefined
            ? await executeOperation(
                "GetControl",
                { controlId: args.controlId },
                client,
              )
            : null;

        return toToolResult(
          planEnvelope({
            summary: "Control evidence workflow plan.",
            recommendedActions: [
              "Review selected controls and mapped evidence.",
              "Attach an existing document via documentId, or upload to an existing document using filePath.",
            ],
            context: {
              selectedControlId: args.controlId ?? null,
              selectedDocumentId: args.documentId ?? null,
            },
            reads: {
              controls,
              control: currentControl ? getResultPayload(currentControl) : null,
            },
          }),
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

      if (!args.documentId)
        return toToolResult(
          errorEnvelope(
            "validation_error",
            "documentId is required in execute mode.",
          ),
        );
      const actions: PlannedAction[] = [
        {
          action: { type: "attach_document_to_control" },
          operationId: "AddDocumentToControl",
          args: {
            controlId: args.controlId,
            body: { documentId: args.documentId },
            confirm: true,
          },
        },
      ];
      if (args.filePath !== undefined)
        actions.push({
          action: { type: "upload_file_for_document" },
          operationId: "UploadFileForDocument",
          dependsOnPrevious: true,
          args: compactRecord({
            documentId: args.documentId,
            filePath: args.filePath,
            mimeType: args.mimeType,
            effectiveAtDate: args.effectiveAtDate,
            description: args.description,
            confirm: true,
          }),
        });
      return executeActionBatch(
        actions,
        client,
        "Control evidence workflow executed.",
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

  const actionSchema = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("deactivate_test_entity"),
      testId: z.string().min(1),
      entityId: z.string().min(1),
      deactivateReason: z.string().min(1),
      deactivateUntilDate: z.string().datetime({ offset: true }).optional(),
    }),
    z.object({
      type: z.literal("reactivate_test_entity"),
      testId: z.string().min(1),
      entityId: z.string().min(1),
    }),
    z.object({
      type: z.literal("update_control_metadata"),
      controlId: z.string().min(1),
      metadata: z.record(z.string(), z.unknown()),
    }),
  ]);

  registerWorkflow(
    server,
    toolName,
    "Plan or execute triage actions for failing controls/tests/entities.",
    {
      ...collectionShape,
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
        const tests = await readInventory(
          "ListTests",
          { statusFilter: "NEEDS_ATTENTION" },
          client,
          args,
        );
        return toToolResult(
          planEnvelope({
            summary: "Failing controls triage plan.",
            recommendations: [
              "Inspect failing tests and affected entities.",
              "Choose actions to deactivate/reactivate entities or update control metadata.",
            ],
            failingTests: tests,
          }),
        );
      }

      const actions = (args.actions ?? []).map((action): PlannedAction => {
        if (action.type === "update_control_metadata")
          return {
            action,
            operationId: "UpdateControlMetadata",
            args: {
              controlId: action.controlId,
              body: action.metadata,
              confirm: true,
            },
          };
        return {
          action,
          operationId:
            action.type === "deactivate_test_entity"
              ? "DeactivateTestEntity"
              : "ReactivateTestEntity",
          args: {
            testId: action.testId,
            entityId: action.entityId,
            confirm: true,
            ...(action.type === "deactivate_test_entity"
              ? {
                  body: compactRecord({
                    deactivateReason: action.deactivateReason,
                    deactivateUntilDate: action.deactivateUntilDate,
                  }),
                }
              : {}),
          },
        };
      });
      return executeActionBatch(
        actions,
        client,
        "Failing controls triage executed.",
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

  const vendorFields = {
    vendorId: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
  };
  const actionSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("update_vendor"), ...vendorFields }),
    z.object({ type: z.literal("set_vendor_status"), ...vendorFields }),
    z.object({ type: z.literal("create_finding"), ...vendorFields }),
    z.object({
      type: z.literal("update_finding"),
      ...vendorFields,
      findingId: z.string().min(1),
    }),
    z.object({
      type: z.literal("upload_security_review_document"),
      vendorId: z.string().min(1),
      securityReviewId: z.string().min(1),
      filePath: z.string().min(1),
      mimeType: z.string().optional(),
      payload: z.record(z.string(), z.unknown()).optional(),
    }),
  ]);

  registerWorkflow(
    server,
    toolName,
    "Plan or execute vendor lifecycle triage actions.",
    {
      ...collectionShape,
      mode: workflowModeSchema,
      confirm: z.boolean().optional(),
      vendorId: z.string().optional(),
      assessmentPageCursor: z.string().min(1).optional(),
      actions: z.array(actionSchema).optional(),
    },
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      if (args.mode === "plan") {
        const vendors = await readInventory("ListVendors", {}, client, args);
        const assessments = args.vendorId
          ? await readInventory(
              "GetAssessmentsByVendorId",
              { vendorId: args.vendorId },
              client,
              {
                pageSize: args.pageSize,
                maxPages: args.maxPages,
                pageCursor: args.assessmentPageCursor,
              },
            )
          : undefined;
        return toToolResult(
          planEnvelope({
            summary: "Vendor triage plan.",
            recommendations: [
              "Review vendor statuses and open findings.",
              "Execute targeted vendor/finding/document updates.",
            ],
            vendors,
            selectedVendorId: args.vendorId ?? null,
            ...(assessments ? { assessments } : {}),
          }),
        );
      }

      const operationIds = {
        update_vendor: "UpdateVendor",
        set_vendor_status: "SetStatusForVendor",
        create_finding: "CreateVendorFinding",
        update_finding: "UpdateVendorFinding",
        upload_security_review_document: "UploadDocumentForSecurityReview",
      };
      const actions = (args.actions ?? []).map((action): PlannedAction => {
        const operationId = operationIds[action.type];
        const ids = compactRecord({
          vendorId: action.vendorId,
          findingId: "findingId" in action ? action.findingId : undefined,
          securityReviewId:
            "securityReviewId" in action ? action.securityReviewId : undefined,
          filePath: "filePath" in action ? action.filePath : undefined,
          mimeType: "mimeType" in action ? action.mimeType : undefined,
        });
        return {
          action,
          operationId,
          args: actionArguments(operationId, ids, action.payload),
        };
      });
      return executeActionBatch(actions, client, "Vendor triage executed.");
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

  registerWorkflow(
    server,
    toolName,
    "Plan or execute people/assets/vulnerability triage actions.",
    {
      ...collectionShape,
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
        const vulnerabilities = await readInventory(
          "ListVulnerabilities",
          { severity: "HIGH" },
          client,
          args,
        );
        const assets = await readInventory(
          "ListVulnerableAssets",
          {},
          client,
          args,
        );
        const people = await readInventory("ListPeople", {}, client, args);
        return toToolResult(
          planEnvelope({
            summary: "People/assets/vulnerabilities triage plan.",
            vulnerabilities,
            vulnerableAssets: assets,
            people,
          }),
        );
      }

      const operationIds = {
        deactivate_vulnerabilities: "DeactivateVulnerabilities",
        reactivate_vulnerabilities: "ReactivateVulnerabilities",
        acknowledge_sla_miss: "AcknowledgeSlaMissVulnerabilityRemediations",
      };
      const actions = (args.actions ?? []).map(
        (action): PlannedAction => ({
          action,
          operationId: operationIds[action.type],
          args: { body: action.payload, confirm: true },
          bulkUpdates: true,
        }),
      );
      return executeActionBatch(
        actions,
        client,
        "People/assets/vulnerability triage executed.",
      );
    },
  );

  return true;
};

const registerResourceOwnerAssignmentWorkflow = (
  server: McpServer,
  client: VantaApiClient,
): boolean => {
  const toolName = "workflow_resource_owner_assignment";
  if (!isToolEnabled(toolName)) {
    return false;
  }

  const resourceOwnerWorkflowSchema = {
    ...collectionShape,
    mode: workflowModeSchema,
    confirm: z.boolean().optional(),
    integrationId: z.string(),
    resourceKind: z.string(),
    ownerId: z.string().optional(),
    ownerEmail: z.string().email().optional(),
    resourceIds: z.array(z.string()).optional(),
    hasOwner: z.boolean().optional(),
    hasDescription: z.boolean().optional(),
    isInScope: z.boolean().optional(),
    description: z.string().optional(),
    setInScope: z.boolean().optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    pageCursor: z.string().optional(),
    batchSize: z.number().int().min(1).max(50).optional(),
  };

  const buildUpdate = (
    id: string,
    ownerId: string,
    args: {
      description?: string;
      setInScope?: boolean;
    },
  ): Record<string, unknown> =>
    compactRecord({
      id,
      ownerId,
      description: args.description,
      inScope: args.setInScope,
    });

  const resolveResourceIds = async (args: {
    integrationId: string;
    resourceKind: string;
    resourceIds?: string[];
    hasOwner?: boolean;
    hasDescription?: boolean;
    isInScope?: boolean;
    pageSize?: number;
    pageCursor?: string;
    maxPages?: number;
  }): Promise<
    | {
        success: true;
        resources: Record<string, unknown>[];
        resourceIds: string[];
        pageInfo?: unknown;
        collection?: Record<string, unknown>;
        warnings: string[];
      }
    | { success: false; envelope: ReturnType<typeof errorEnvelope> }
  > => {
    if (args.resourceIds && args.resourceIds.length > 0) {
      return {
        success: true,
        resources: [],
        resourceIds: args.resourceIds,
        warnings: [],
      };
    }

    const listed = await listIntegrationResourcesForOwnerWorkflow(client, args);
    if (!listed.success) {
      return listed;
    }

    const missingIdResources: Record<string, unknown>[] = [];
    const resourceIds = listed.resources.flatMap(resource => {
      const id = resourceIdFromRecord(resource);
      if (!id) {
        missingIdResources.push(resource);
        return [];
      }
      return [id];
    });
    const warnings =
      missingIdResources.length > 0
        ? [
            `${missingIdResources.length.toString()} listed resource(s) did not include resourceId/id and were skipped.`,
          ]
        : [];

    return {
      success: true,
      resources: listed.resources,
      resourceIds,
      pageInfo: listed.pageInfo,
      collection: listed.collection,
      warnings,
    };
  };

  registerWorkflow(
    server,
    toolName,
    "Plan or execute integration resource owner and description updates with CURRENT employee validation.",
    resourceOwnerWorkflowSchema,
    async args => {
      const gate = workflowExecuteGate(args.mode, args.confirm);
      if (gate) {
        return toToolResult(gate);
      }

      const ownerResult = await resolveOwner(client, args);
      if (!ownerResult.success) {
        return toToolResult(ownerResult.envelope);
      }

      const resourceResult = await resolveResourceIds(args);
      if (!resourceResult.success) {
        return toToolResult(resourceResult.envelope);
      }

      if (
        args.mode === "execute" &&
        resourceResult.collection?.complete === false
      ) {
        return toToolResult(
          errorEnvelope(
            "workflow_read_incomplete",
            "Resource inventory is incomplete; no writes were executed.",
            "Increase maxPages or provide explicit resourceIds from the reviewed plan.",
            {
              collection: resourceResult.collection,
              resources: resourceResult.resources,
            },
          ),
        );
      }

      const batchSize = args.batchSize ?? 50;
      const actions = resourceResult.resourceIds.map(id =>
        buildUpdate(id, ownerResult.owner.id, args),
      );
      const baseData = {
        summary:
          "Assign integration resource owners using Vanta resource metadata.",
        objectModel:
          "Integration resources have one ownerId. This is distinct from document owner, control owner, and unsupported policy-control linkage.",
        owner: ownerResult.owner,
        filters: compactRecord({
          integrationId: args.integrationId,
          resourceKind: args.resourceKind,
          hasOwner: args.hasOwner ?? false,
          hasDescription: args.hasDescription,
          isInScope: args.isInScope ?? true,
          pageSize: args.pageSize ?? 100,
          pageCursor: args.pageCursor,
        }),
        resources: resourceResult.resources,
        actions,
        limits: {
          maxResourcesPerBatch: 50,
          batchSize,
        },
        pageInfo: resourceResult.pageInfo,
        collection: resourceResult.collection,
      };

      if (args.mode === "plan") {
        return toToolResult(
          successEnvelope(
            baseData,
            "Plan generated. No mutations were executed.",
            undefined,
            {
              warnings: [
                ...resourceResult.warnings,
                ...(resourceResult.collection?.complete === false
                  ? [
                      "Resource inventory is incomplete; resume with collection.nextPageCursor or increase maxPages.",
                    ]
                  : []),
              ],
              metadata: {
                complete: resourceResult.collection?.complete !== false,
              },
            },
          ),
        );
      }

      if (actions.length === 0) {
        return toToolResult(
          successEnvelope(
            {
              ...baseData,
              batches: [],
              succeeded: [],
              failed: [],
              skipped: [],
              counts: { succeeded: 0, failed: 0, skipped: 0 },
            },
            "Resource owner assignment executed.",
            undefined,
            {
              warnings: [
                ...resourceResult.warnings,
                ...(resourceResult.collection?.complete === false
                  ? [
                      "Resource inventory is incomplete; resume with collection.nextPageCursor or increase maxPages.",
                    ]
                  : []),
              ],
              metadata: {
                complete: resourceResult.collection?.complete !== false,
              },
            },
          ),
        );
      }

      const batches: Record<string, unknown>[] = [];
      const succeeded: Record<string, unknown>[] = [];
      const failed: Record<string, unknown>[] = [];
      const skipped: Record<string, unknown>[] = [];
      const updateBatches = chunk(actions, batchSize);
      for (const [index, updateBatch] of updateBatches.entries()) {
        const call = await executeOperation(
          "UpdateResources",
          {
            integrationId: args.integrationId,
            resourceKind: args.resourceKind,
            body: { updates: updateBatch },
            confirm: true,
          },
          client,
        );
        const envelope = readRecord(getResultPayload(call));
        const results = readBulkResults(envelope?.data);
        batches.push({
          index,
          attempted: updateBatch.length,
          results,
          error: envelope?.error,
        });
        if (envelope?.success !== true) {
          failed.push(
            ...updateBatch.map(action => ({
              ...action,
              error: envelope?.error,
            })),
          );
          skipped.push(...updateBatches.slice(index + 1).flat());
          break;
        }
        for (const action of updateBatch) {
          const matches = results.filter(result => result.id === action.id);
          const result =
            matches.length === 1
              ? matches[0]
              : {
                  id: action.id,
                  status: "ERROR",
                  message:
                    "Missing or duplicate per-resource result; verify before retrying.",
                };
          if (readString(result.status)?.toLowerCase() === "success")
            succeeded.push(result);
          else failed.push(result);
        }
      }
      const report = {
        ...baseData,
        batches,
        succeeded,
        failed,
        skipped,
        counts: {
          succeeded: succeeded.length,
          failed: failed.length,
          skipped: skipped.length,
        },
      };
      return toToolResult(
        failed.length || skipped.length
          ? errorEnvelope(
              "workflow_failed",
              "Some resource owner updates did not complete successfully.",
              "Inspect per-resource outcomes before retrying.",
              report,
            )
          : successEnvelope(
              report,
              "Resource owner assignment executed.",
              undefined,
              { warnings: resourceResult.warnings },
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

  registerWorkflow(
    server,
    toolName,
    "Plan or execute audit information request triage actions.",
    {
      ...collectionShape,
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
        const list = await readInventory(
          "ListInformationRequests",
          { auditId: args.auditId },
          client,
          args,
          "audit",
        );
        return toToolResult(
          planEnvelope({
            summary: "Information request triage plan.",
            openRequests: list,
          }),
        );
      }

      const operationIds = {
        update_request: "UpdateInformationRequest",
        create_comment: "CreateCommentForInformationRequest",
        flag_evidence: "FlagInformationRequestEvidence",
        accept_evidence: "AcceptInformationRequestEvidence",
      };
      const actions = (args.actions ?? []).map(
        (action): PlannedAction => ({
          action,
          operationId: operationIds[action.type],
          source: "audit",
          args: actionArguments(
            operationIds[action.type],
            { auditId: args.auditId, requestId: action.requestId },
            action.payload,
            "audit",
          ),
        }),
      );
      return executeActionBatch(
        actions,
        client,
        "Information request triage executed.",
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
  const issueTool = "workflow_issue_event_triage";
  if (isToolEnabled(issueTool)) {
    registerWorkflow(
      server,
      issueTool,
      "Plan issue and event-log review without mutations.",
      {
        mode: z.literal("plan"),
        pageSize: collectionShape.pageSize,
        maxPages: collectionShape.maxPages,
        issuePageCursor: z.string().min(1).optional(),
        eventPageCursor: z.string().min(1).optional(),
        search: z.string().optional(),
        eventStartDate: z.string().datetime({ offset: true }).optional(),
      },
      async args => {
        const issues = await readInventory(
          "List",
          compactRecord({ search: args.search }),
          client,
          {
            pageSize: args.pageSize,
            maxPages: args.maxPages,
            pageCursor: args.issuePageCursor,
          },
        );
        const events = await readInventory(
          "ListEventLogs",
          compactRecord({ startDate: args.eventStartDate }),
          client,
          {
            pageSize: args.pageSize,
            maxPages: args.maxPages,
            pageCursor: args.eventPageCursor,
          },
        );
        return toToolResult(
          planEnvelope({
            summary:
              "Review issues and event logs as separate evidence inventories; no causal relationship is inferred.",
            recommendations: [
              "Inspect issue details and relevant events before deciding on follow-up actions.",
            ],
            issues,
            events,
          }),
        );
      },
    );
    registered += 1;
  }
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
  if (registerResourceOwnerAssignmentWorkflow(server, client)) {
    registered += 1;
  }
  if (registerInformationRequestWorkflow(server, client)) {
    registered += 1;
  }
  return registered;
}
