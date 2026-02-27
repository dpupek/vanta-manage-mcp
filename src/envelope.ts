import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ErrorPayload {
  code: string;
  message: string;
  hint?: string;
  agentHint?: string;
  details?: unknown;
}

export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  message?: string;
  notes?: string[];
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorPayload;
  notes?: string[];
}

export type ToolEnvelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

export const successEnvelope = <T>(
  data: T,
  message?: string,
  notes?: string[],
): SuccessEnvelope<T> => ({
  success: true,
  data,
  message,
  notes,
});

export const errorEnvelope = (
  code: string,
  message: string,
  hint?: string,
  details?: unknown,
  notes?: string[],
  agentHint?: string,
): ErrorEnvelope => ({
  success: false,
  error: {
    code,
    message,
    hint,
    agentHint: agentHint ?? deriveAgentHint(code, message, details),
    details,
  },
  notes,
});

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
  if (
    typeof details === "object" &&
    details !== null &&
    "error" in details
  ) {
    return readString((details as { error?: unknown }).error)?.toLowerCase() ?? null;
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
    if (apiCode === "rate_limit_exceeded" || message.toLowerCase().includes("429")) {
      return "Rate limited. Retry with backoff and prioritize read/plan calls. See resource://vanta-manage/troubleshooting.";
    }
    return "Inspect error.details and choose a matching playbook_ prompt before retrying.";
  }
  if (normalizedCode === "validation_error") {
    return "Fix required arguments using tool schema, then retry. Use resource://vanta-manage/cheatsheet for call shapes.";
  }
  if (normalizedCode === "unknown_tool" || normalizedCode === "missing_generated_operation") {
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
