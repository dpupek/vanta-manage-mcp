import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  generatedOperationByToolName,
  generatedOperations,
} from "../generated/operations.generated.js";
import { buildOperationSchema } from "./operation-schema.js";
import { errorEnvelope, successEnvelope, toToolResult } from "../envelope.js";
import { VantaApiClient } from "../client/vanta-client.js";
import { isToolEnabled, safeModeEnabled, writeEnabled } from "../config.js";
import { prepareUploadFileInput } from "../uploads/file-validation.js";
import { appendUploadFile } from "../uploads/multipart.js";
import { cleanupMarkdownConversionArtifacts } from "../uploads/markdown-conversion.js";

const encodePath = (template: string, args: Record<string, unknown>): string =>
  template.replace(/\{([^}]+)\}/g, (_match: string, key: string) => {
    if (!(key in args)) {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(String(args[key]));
  });

const extractQuery = (
  args: Record<string, unknown>,
  queryParamNames: string[],
): Record<string, unknown> => {
  const query: Record<string, unknown> = {};
  for (const name of queryParamNames) {
    const value = args[name];
    if (value !== undefined) {
      query[name] = value;
    }
  }
  return query;
};

const appendMultipartUploadFile = async (
  toolName: string,
  args: Record<string, unknown>,
  fileFieldName: string,
  formData: FormData,
): Promise<
  | {
      error?: ReturnType<typeof errorEnvelope>;
      warnings?: string[];
      metadata?: Record<string, unknown>;
    }
  | undefined
> => {
  const validation = await prepareUploadFileInput(toolName, args);
  if (!validation.success) {
    return {
      error: errorEnvelope(
        validation.error.code,
        validation.error.message,
        validation.error.hint,
        validation.error.details,
      ),
    };
  }

  try {
    await appendUploadFile(formData, fileFieldName, validation.file);
    return {
      warnings: validation.warnings,
      metadata: validation.metadata,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: errorEnvelope(
        "file_not_readable",
        `Unable to read file for upload: ${validation.file.absolutePath}`,
        "Ensure the path is valid and accessible by the MCP process.",
        {
          toolName,
          filePath: validation.file.absolutePath,
          reason: message,
        },
      ),
    };
  } finally {
    await cleanupMarkdownConversionArtifacts(validation.cleanupPaths);
  }
};

const addMultipartField = (
  formData: FormData,
  key: string,
  value: unknown,
): void => {
  if (value === undefined || value === null) {
    return;
  }
  if (Array.isArray(value) || typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }
  formData.append(key, String(value));
};

const isConfirmationRequired = (
  isMutation: boolean,
  args: Record<string, unknown>,
): boolean => {
  if (!isMutation) {
    return false;
  }
  if (!safeModeEnabled) {
    return false;
  }
  return args.confirm !== true;
};

const stripRuntimeFields = (
  args: Record<string, unknown>,
): Record<string, unknown> => {
  const remaining = { ...args };
  delete remaining.confirm;
  delete remaining.markdownConversionTarget;
  delete remaining.markdownFooterDocumentName;
  delete remaining.markdownConversionRenderer;
  delete remaining.markdownReferenceDocPath;
  return remaining;
};

const readObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const looksLikePolicyDocumentSlug = (value: string): boolean =>
  /^policy[-_]/iu.test(value);

const validateDocumentIdArgs = (
  toolName: string,
  args: Record<string, unknown>,
): ReturnType<typeof errorEnvelope> | null => {
  const documentId =
    readString(args.documentId) ??
    readString(readObject(args.body)?.documentId);
  if (!documentId || !looksLikePolicyDocumentSlug(documentId)) {
    return null;
  }

  return errorEnvelope(
    "validation_error",
    "This is a policy document slug, not a Vanta Document ID.",
    "Use policy-control UI fallback tools, or upload/link a real Vanta Document.",
    {
      toolName,
      suppliedDocumentId: documentId,
      objectModel:
        "Policy latestApprovedVersion.documents[*].slugId is not usable with /documents or control-document endpoints.",
    },
  );
};

const buildWriteDisabledFallback = (
  toolName: string,
  operation: { path: string; method: string },
  args: Record<string, unknown>,
): Record<string, unknown> => ({
  fallbackActionBatch: [
    {
      objectId:
        readString(args.controlId) ??
        readString(args.documentId) ??
        readString(args.testId) ??
        null,
      uiLocation: `Vanta UI matching ${operation.method.toUpperCase()} ${operation.path}`,
      proposedAction: stripRuntimeFields(args),
      reason: "MCP write-disabled mode is active.",
      verificationQuery: `Run the matching read endpoint after the UI action for ${toolName}.`,
    },
  ],
});

const isAlreadyMappedResponse = (status: number, data: unknown): boolean => {
  if (status !== 422) {
    return false;
  }
  const raw =
    typeof data === "string"
      ? data.toLowerCase()
      : JSON.stringify(data ?? "").toLowerCase();
  return (
    raw.includes("already") &&
    (raw.includes("mapped") || raw.includes("linked") || raw.includes("exist"))
  );
};

const idempotentMappingToolNames = new Set([
  "add_document_to_control",
  "add_test_to_control",
  "link_controls_to_risk_scenario",
]);

const canTreatAlreadyMappedAsSuccess = (toolName: string): boolean =>
  idempotentMappingToolNames.has(toolName);

export async function invokeGeneratedOperation(
  toolName: string,
  rawArgs: Record<string, unknown>,
  client: VantaApiClient,
): Promise<ReturnType<typeof toToolResult>> {
  const operation = generatedOperationByToolName[toolName];
  if (!operation) {
    return toToolResult(
      errorEnvelope(
        "unknown_tool",
        `Unknown generated operation tool: ${toolName}`,
      ),
    );
  }

  if (operation.isMutation && !writeEnabled) {
    return toToolResult(
      errorEnvelope(
        "write_disabled",
        "Mutating operations are disabled by VANTA_MCP_ENABLE_WRITE=false.",
        "Use the returned fallbackActionBatch to perform the action manually in Vanta UI.",
        buildWriteDisabledFallback(toolName, operation, rawArgs),
      ),
    );
  }

  if (isConfirmationRequired(operation.isMutation, rawArgs)) {
    return toToolResult(
      errorEnvelope(
        "confirmation_required",
        `Tool ${toolName} is mutating and requires confirm=true in safe mode.`,
        "Set confirm=true to execute this operation.",
        {
          toolName,
          method: operation.method.toUpperCase(),
          path: operation.path,
          intent: stripRuntimeFields(rawArgs),
        },
      ),
    );
  }

  const documentIdValidation = validateDocumentIdArgs(toolName, rawArgs);
  if (documentIdValidation) {
    return toToolResult(documentIdValidation);
  }

  const path = encodePath(operation.path, rawArgs);
  const queryNames = operation.parameters
    .filter(parameter => parameter.in === "query")
    .map(parameter => parameter.name);
  const query = extractQuery(rawArgs, queryNames);

  const bodyDescriptor = operation.requestBody;
  let body: unknown;
  let formData: FormData | undefined;
  let uploadWarnings: string[] = [];
  let uploadMetadata: Record<string, unknown> | undefined;
  if (bodyDescriptor) {
    if (bodyDescriptor.kind === "multipart") {
      const multipartFormData = new FormData();
      if (bodyDescriptor.fileFieldName) {
        const uploadResult = await appendMultipartUploadFile(
          toolName,
          rawArgs,
          bodyDescriptor.fileFieldName,
          multipartFormData,
        );
        if (uploadResult?.error) {
          return toToolResult(uploadResult.error);
        }
        uploadWarnings = uploadResult?.warnings ?? [];
        uploadMetadata = uploadResult?.metadata;
      }
      for (const field of bodyDescriptor.fields) {
        if (field.name === bodyDescriptor.fileFieldName) {
          continue;
        }
        addMultipartField(multipartFormData, field.name, rawArgs[field.name]);
      }
      formData = multipartFormData;
    } else {
      body = rawArgs.body;
    }
  }

  try {
    const response = await client.request({
      method: operation.method,
      path,
      query,
      body,
      formData,
    });

    if (!response.ok) {
      if (
        canTreatAlreadyMappedAsSuccess(toolName) &&
        isAlreadyMappedResponse(response.status, response.data)
      ) {
        return toToolResult(
          successEnvelope(
            {
              alreadyExisted: true,
              apiResponse: response.data,
              operation: {
                toolName,
                method: operation.method.toUpperCase(),
                path: operation.path,
              },
            },
            "Mapping already existed; treated as idempotent success.",
          ),
        );
      }
      return toToolResult(
        errorEnvelope(
          "api_error",
          `Vanta API request failed with status ${response.status.toString()}.`,
          undefined,
          response.data,
        ),
      );
    }

    return toToolResult(
      successEnvelope(
        response.data,
        `${operation.method.toUpperCase()} ${operation.path}`,
        undefined,
        {
          warnings: uploadWarnings,
          metadata: uploadMetadata,
        },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toToolResult(
      errorEnvelope(
        "request_failed",
        message,
        "Verify credentials, scopes, and payload.",
      ),
    );
  }
}

export function getGeneratedToolNameByOperationId(
  operationId: string,
  source?: "manage" | "audit" | "connectors",
): string | undefined {
  const match = generatedOperations.find(operation => {
    if (operation.operationId !== operationId) {
      return false;
    }
    if (!source) {
      return true;
    }
    return operation.source === source;
  });
  return match?.toolName;
}

export function registerGeneratedEndpointTools(
  server: McpServer,
  client: VantaApiClient,
): number {
  let registered = 0;
  for (const operation of generatedOperations) {
    if (!isToolEnabled(operation.toolName)) {
      continue;
    }

    const schema = buildOperationSchema(operation);
    server.tool(
      operation.toolName,
      operation.description,
      schema.shape,
      async args => invokeGeneratedOperation(operation.toolName, args, client),
    );
    registered += 1;
  }

  return registered;
}
