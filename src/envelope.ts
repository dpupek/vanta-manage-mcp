import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tenantIdentity, TenantIdentity } from "./config.js";

export interface ErrorPayload {
  code: string;
  message: string;
  hint?: string;
  agentHint?: string;
  details?: Record<string, unknown>;
}

export interface PaginationMetadata {
  hasMore?: boolean;
  pageCursor?: string;
  pageSize?: number;
  totalCount?: number;
}

export interface EnvelopeOptions {
  warnings?: string[];
  correlationId?: string;
  pagination?: PaginationMetadata;
  metadata?: Record<string, unknown>;
  tenant?: TenantIdentity;
}

export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  message?: string;
  notes?: string[];
  warnings: string[];
  correlationId: string;
  tenant: TenantIdentity;
  pagination?: PaginationMetadata;
  metadata?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorPayload;
  notes?: string[];
  warnings: string[];
  correlationId: string;
  tenant: TenantIdentity;
  pagination?: PaginationMetadata;
  metadata?: Record<string, unknown>;
}

export type ToolEnvelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

export const successEnvelope = <T>(
  data: T,
  message?: string,
  notes?: string[],
  options: EnvelopeOptions = {},
): SuccessEnvelope<T> => ({
  success: true,
  data,
  message,
  notes,
  warnings: options.warnings ?? [],
  correlationId: options.correlationId ?? nextCorrelationId(),
  tenant: options.tenant ?? tenantIdentity,
  pagination: options.pagination ?? extractPagination(data),
  metadata: options.metadata,
});

export const errorEnvelope = (
  code: string,
  message: string,
  hint?: string,
  details?: unknown,
  notes?: string[],
  agentHint?: string,
  options: EnvelopeOptions = {},
): ErrorEnvelope => ({
  success: false,
  error: {
    code,
    message,
    hint,
    agentHint: agentHint ?? deriveAgentHint(code, message, details),
    details: normalizeDetails(details),
  },
  notes,
  warnings: options.warnings ?? [],
  correlationId: options.correlationId ?? nextCorrelationId(),
  tenant: options.tenant ?? tenantIdentity,
  pagination: options.pagination,
  metadata: options.metadata,
});

let correlationCounter = 0;

const nextCorrelationId = (): string => {
  correlationCounter += 1;
  return `vanta-mcp-${Date.now().toString(36)}-${correlationCounter.toString(36)}`;
};

const normalizeDetails = (
  details: unknown,
): Record<string, unknown> | undefined => {
  if (details === undefined || details === null) {
    return undefined;
  }
  if (typeof details === "object" && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return { value: details };
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const readCursor = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const extractPagination = (data: unknown): PaginationMetadata | undefined => {
  const root = readRecord(data);
  const results = readRecord(root?.results);
  const pageInfo = readRecord(root?.pageInfo) ?? readRecord(results?.pageInfo);
  if (!pageInfo && !root) {
    return undefined;
  }

  const pageCursor =
    readCursor(pageInfo?.endCursor) ??
    readCursor(pageInfo?.nextCursor) ??
    readCursor(root?.pageCursor) ??
    readCursor(root?.nextPageCursor);
  const hasMore =
    readBoolean(pageInfo?.hasNextPage) ??
    readBoolean(pageInfo?.hasMore) ??
    readBoolean(root?.hasMore);
  const pageSize = readNumber(root?.pageSize);
  const totalCount =
    readNumber(root?.totalCount) ??
    readNumber(root?.total) ??
    readNumber(results?.totalCount);

  if (
    pageCursor === undefined &&
    hasMore === undefined &&
    pageSize === undefined &&
    totalCount === undefined
  ) {
    return undefined;
  }

  const pagination: PaginationMetadata = {};
  if (hasMore !== undefined) {
    pagination.hasMore = hasMore;
  }
  if (pageCursor !== undefined) {
    pagination.pageCursor = pageCursor;
  }
  if (pageSize !== undefined) {
    pagination.pageSize = pageSize;
  }
  if (totalCount !== undefined) {
    pagination.totalCount = totalCount;
  }
  return pagination;
};

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const extractApiErrorCode = (details: unknown): string | null => {
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details) as { error?: unknown };
      return readString(parsed.error)?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  }
  if (typeof details === "object" && details !== null && "error" in details) {
    return (
      readString((details as { error?: unknown }).error)?.toLowerCase() ?? null
    );
  }
  return null;
};

const deriveAgentHint = (
  code: string,
  message: string,
  details?: unknown,
): string | undefined => {
  const normalizedCode = code.toLowerCase();
  if (normalizedCode === "confirmation_required") {
    return "Run read->plan first, then execute with confirm=true. See resource://vanta-manage/safety.";
  }
  if (normalizedCode === "write_disabled") {
    return "Writes are disabled. Enable VANTA_MCP_ENABLE_WRITE=true or switch to planning-only workflow mode.";
  }
  if (normalizedCode === "request_failed") {
    return "Check credentials/network, then retry. See resource://vanta-manage/troubleshooting.";
  }
  if (normalizedCode === "api_error") {
    const apiCode = extractApiErrorCode(details);
    if (
      apiCode === "rate_limit_exceeded" ||
      message.toLowerCase().includes("429")
    ) {
      return "Rate limited. Retry with backoff and prioritize read/plan calls. See resource://vanta-manage/troubleshooting.";
    }
    return "Inspect error.details and choose a matching playbook_ prompt before retrying.";
  }
  if (normalizedCode === "validation_error") {
    return "Fix required arguments using tool schema, then retry. Use resource://vanta-manage/cheatsheet for call shapes.";
  }
  if (normalizedCode === "file_path_required") {
    return "Provide filePath to a local readable file. See resource://vanta-manage/troubleshooting.";
  }
  if (normalizedCode === "file_not_found") {
    return "Correct filePath to an existing local file, then retry. See resource://vanta-manage/troubleshooting.";
  }
  if (normalizedCode === "file_not_readable") {
    return "Grant read access to the filePath and retry. See resource://vanta-manage/troubleshooting.";
  }
  if (normalizedCode === "file_not_regular") {
    return "Use a regular file path (not a directory). See resource://vanta-manage/troubleshooting.";
  }
  if (normalizedCode === "unsupported_file_type") {
    return "Use a supported file extension/mimeType for this upload tool. See resource://vanta-manage/recipes.";
  }
  if (
    normalizedCode === "markdown_converter_unavailable" ||
    normalizedCode === "markdown_conversion_failed"
  ) {
    return "Install/configure the Markdown conversion renderer or convert the Markdown to PDF/DOCX before uploading.";
  }
  if (normalizedCode === "unsupported_operation") {
    return "Use the returned fallbackActionBatch in the Vanta UI, then run the verification query.";
  }
  if (
    normalizedCode === "unknown_tool" ||
    normalizedCode === "missing_generated_operation"
  ) {
    return "Discover valid tools via resource://vanta-manage/tool-catalog or run the help tool.";
  }
  return undefined;
};

export const toToolResult = (envelope: ToolEnvelope): CallToolResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(envelope, null, 2),
    },
  ],
  isError: !envelope.success,
});
