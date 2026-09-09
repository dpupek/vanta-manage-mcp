import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorEnvelope, ErrorEnvelope, toToolResult } from "../envelope.js";
import { isToolEnabled } from "../config.js";

export interface UnsupportedToolMetadata {
  name: string;
  description: string;
  surfaceId:
    | "policy-control-linking"
    | "test-comments"
    | "document-deactivation";
  isMutation: boolean;
  uiLocation: string;
  fallbackAction: string;
  verificationQuery: string;
}

export const unsupportedToolMetadata: UnsupportedToolMetadata[] = [
  {
    name: "list_controls_for_policy",
    description:
      "Unsupported: list controls linked to a policy. Vanta public API does not expose policy-control linkage reads.",
    surfaceId: "policy-control-linking",
    isMutation: false,
    uiLocation: "Vanta UI > Policies > selected policy > linked controls",
    fallbackAction: "Inspect linked controls in the Vanta UI.",
    verificationQuery:
      "Read the policy inventory and target controls after the UI action.",
  },
  {
    name: "list_policies_for_control",
    description:
      "Unsupported: list policies linked to a control. Vanta public API does not expose policy-control linkage reads.",
    surfaceId: "policy-control-linking",
    isMutation: false,
    uiLocation: "Vanta UI > Controls > selected control > linked policies",
    fallbackAction: "Inspect linked policies in the Vanta UI.",
    verificationQuery:
      "Read the control and policy inventory after the UI action.",
  },
  {
    name: "add_policy_to_control",
    description:
      "Unsupported: link a policy to a control. Vanta public API does not expose policy-control linkage writes.",
    surfaceId: "policy-control-linking",
    isMutation: true,
    uiLocation: "Vanta UI > Controls > selected control > linked policies",
    fallbackAction: "Link the policy to the control in the Vanta UI.",
    verificationQuery:
      "Re-open the control in Vanta UI and verify the policy linkage.",
  },
  {
    name: "remove_policy_from_control",
    description:
      "Unsupported: unlink a policy from a control. Vanta public API does not expose policy-control linkage writes.",
    surfaceId: "policy-control-linking",
    isMutation: true,
    uiLocation: "Vanta UI > Controls > selected control > linked policies",
    fallbackAction: "Remove the policy-control link in the Vanta UI.",
    verificationQuery:
      "Re-open the control in Vanta UI and verify the policy is not linked.",
  },
  {
    name: "add_test_comment",
    description:
      "Unsupported: add a direct progress comment to a Manage test. Use a control-note fallback that references the test ID.",
    surfaceId: "test-comments",
    isMutation: true,
    uiLocation: "Vanta UI > Controls > selected control > notes",
    fallbackAction:
      "Add a control note that references the Vanta test ID and progress detail.",
    verificationQuery:
      "Read the related control and tests, then confirm the note references the intended test ID.",
  },
  {
    name: "deactivate_document",
    description:
      "Unsupported: deactivate a document. Vanta public API exposes document deactivation status but not document deactivation writes.",
    surfaceId: "document-deactivation",
    isMutation: true,
    uiLocation: "Vanta UI > Documents > selected document > deactivate",
    fallbackAction:
      "Deactivate the document in the Vanta UI with the supplied reason and expiration when applicable.",
    verificationQuery:
      "Read the document with get_document and verify deactivatedStatus.isDeactivated is true.",
  },
  {
    name: "reactivate_document",
    description:
      "Unsupported: reactivate a document. Vanta public API exposes document deactivation status but not document reactivation writes.",
    surfaceId: "document-deactivation",
    isMutation: true,
    uiLocation: "Vanta UI > Documents > selected document > reactivate",
    fallbackAction: "Reactivate the document in the Vanta UI.",
    verificationQuery:
      "Read the document with get_document and verify deactivatedStatus.isDeactivated is false.",
  },
];

const unsupportedHintFor = (tool: UnsupportedToolMetadata): string => {
  switch (tool.surfaceId) {
    case "test-comments":
      return "Use the control note fallback and include the test ID in the note.";
    case "document-deactivation":
      return "Use the document deactivation UI fallback; the current public Vanta API only exposes deactivatedStatus as read state.";
    case "policy-control-linking":
      return "Use the Vanta UI fallback for policy-control linkage.";
  }
};

const unsupportedReasonFor = (tool: UnsupportedToolMetadata): string => {
  switch (tool.surfaceId) {
    case "policy-control-linking":
      return "The Vanta public API currently lacks official policy-control linkage endpoints.";
    case "test-comments":
      return "The Vanta public Manage API currently lacks direct test comment endpoints.";
    case "document-deactivation":
      return "The Vanta public Manage API currently lacks document deactivation and reactivation write endpoints.";
  }
};

export const buildUnsupportedOperationEnvelope = (
  tool: UnsupportedToolMetadata,
  args: Record<string, unknown>,
): ErrorEnvelope =>
  errorEnvelope(
    "unsupported_operation",
    `${tool.name} is not supported by the current public Vanta API.`,
    unsupportedHintFor(tool),
    {
      toolName: tool.name,
      surfaceId: tool.surfaceId,
      requestedArgs: args,
      fallbackActionBatch: [
        {
          objectId:
            readString(args.controlId) ??
            readString(args.policyId) ??
            readString(args.testId) ??
            readString(args.documentId) ??
            null,
          uiLocation: tool.uiLocation,
          proposedAction: tool.fallbackAction,
          reason: unsupportedReasonFor(tool),
          verificationQuery: tool.verificationQuery,
        },
      ],
    },
    undefined,
    `Use ${tool.uiLocation} in the Vanta UI, then run the verification query.`,
  );

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const sharedUnsupportedShape = {
  controlId: z.string().optional(),
  policyId: z.string().optional(),
  testId: z.string().optional(),
  documentId: z.string().optional(),
  comment: z.string().optional(),
  reason: z.string().optional(),
  expiration: z.string().optional(),
};

export const registerUnsupportedTools = (server: McpServer): number => {
  let registered = 0;
  for (const tool of unsupportedToolMetadata) {
    if (!isToolEnabled(tool.name)) {
      continue;
    }
    server.tool(tool.name, tool.description, sharedUnsupportedShape, args =>
      toToolResult(buildUnsupportedOperationEnvelope(tool, args)),
    );
    registered += 1;
  }
  return registered;
};
