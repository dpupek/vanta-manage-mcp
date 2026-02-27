import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  generatedOperationByToolName,
  generatedOperations,
} from "../generated/operations.generated.js";
import { buildOperationSchema } from "./operation-schema.js";
import { errorEnvelope, successEnvelope, toToolResult } from "../envelope.js";
import { VantaApiClient } from "../client/vanta-client.js";
import {
  isToolEnabled,
  safeModeEnabled,
  writeEnabled,
} from "../config.js";
import { validateUploadFileInput } from "../uploads/file-validation.js";
import { appendUploadFile } from "../uploads/multipart.js";

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
): Promise<ReturnType<typeof errorEnvelope> | undefined> => {
  const validation = validateUploadFileInput(toolName, args);
  if (!validation.success) {
    return errorEnvelope(
      validation.error.code,
      validation.error.message,
      validation.error.hint,
      validation.error.details,
    );
  }

  try {
    await appendUploadFile(formData, fileFieldName, validation.file);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorEnvelope(
      "file_not_readable",
      `Unable to read file for upload: ${validation.file.absolutePath}`,
      "Ensure the path is valid and accessible by the MCP process.",
      {
        toolName,
        filePath: validation.file.absolutePath,
        reason: message,
      },
    );
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

const stripRuntimeFields = (args: Record<string, unknown>): Record<string, unknown> => {
  const remaining = { ...args };
  delete remaining.confirm;
  return remaining;
};

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

  const path = encodePath(operation.path, rawArgs);
  const queryNames = operation.parameters
    .filter(parameter => parameter.in === "query")
    .map(parameter => parameter.name);
  const query = extractQuery(rawArgs, queryNames);

  const bodyDescriptor = operation.requestBody;
  let body: unknown;
  let formData: FormData | undefined;
  if (bodyDescriptor) {
    if (bodyDescriptor.kind === "multipart") {
      const multipartFormData = new FormData();
      if (bodyDescriptor.fileFieldName) {
        const uploadError = await appendMultipartUploadFile(
          toolName,
          rawArgs,
          bodyDescriptor.fileFieldName,
          multipartFormData,
        );
        if (uploadError) {
          return toToolResult(uploadError);
        }
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
      successEnvelope(response.data, `${operation.method.toUpperCase()} ${operation.path}`),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toToolResult(
      errorEnvelope("request_failed", message, "Verify credentials, scopes, and payload."),
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
