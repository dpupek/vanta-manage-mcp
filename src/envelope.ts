import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ErrorPayload {
  code: string;
  message: string;
  hint?: string;
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
): ErrorEnvelope => ({
  success: false,
  error: {
    code,
    message,
    hint,
    details,
  },
  notes,
});

export const toToolResult = (envelope: ToolEnvelope): CallToolResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(envelope, null, 2),
    },
  ],
  isError: !envelope.success,
});
