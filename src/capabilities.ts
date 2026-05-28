import { compatibilityToolMetadata } from "./tools/compat-tools.js";
import { uploadPolicyByToolName } from "./uploads/policy.js";
import { generatedOperations } from "./generated/operations.generated.js";
import {
  baseApiUrl,
  getEnabledToolNames,
  hasEnabledToolFilter,
  oauthBaseUrl,
  safeModeEnabled,
  tenantIdentity,
  writeEnabled,
} from "./config.js";
import { MCP_NAME, MCP_VERSION } from "./version.js";
import { workflowToolMetadata } from "./workflows/index.js";
import { unsupportedToolMetadata } from "./tools/unsupported-tools.js";

const countGeneratedToolsBySource = (): Record<string, number> =>
  generatedOperations.reduce<Record<string, number>>(
    (accumulator, operation) => {
      accumulator[operation.source] = (accumulator[operation.source] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

const countMutationsBySource = (): Record<string, number> =>
  generatedOperations.reduce<Record<string, number>>(
    (accumulator, operation) => {
      if (operation.isMutation) {
        accumulator[operation.source] =
          (accumulator[operation.source] ?? 0) + 1;
      }
      return accumulator;
    },
    {},
  );

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort();

export interface CapabilitiesPayload {
  mcp: {
    name: string;
    version: string;
  };
  tenant: typeof tenantIdentity;
  runtime: Record<string, unknown>;
  tools: {
    generated: {
      count: number;
      mutationCount: number;
      bySource: Record<string, number>;
      mutationsBySource: Record<string, number>;
      names: string[];
    };
    compatibility: typeof compatibilityToolMetadata;
    workflows: typeof workflowToolMetadata;
    unsupported: typeof unsupportedToolMetadata;
  };
  pageLimits: Record<string, unknown>;
  uploads: {
    supportedExtensions: string[];
    supportedMimeTypes: string[];
    markdownConversion: {
      supportedInputExtensions: string[];
      defaultTarget: "pdf";
      targets: string[];
      renderers: string[];
      footer: Record<string, string>;
    };
  };
  unsupportedSurfaces: {
    id: string;
    reason: string;
    fallback: string;
  }[];
  specSnapshot: {
    generatedAt: string;
    totalOperations: number;
    totalMutations: number;
    bySource: Record<string, number>;
    mutationsBySource: Record<string, number>;
    note: string;
  };
  dataModel: Record<string, string>;
}

export const buildCapabilitiesPayload = (): CapabilitiesPayload => {
  const generatedToolNames = generatedOperations.map(
    operation => operation.toolName,
  );
  const uploadPolicies = Object.values(uploadPolicyByToolName);
  const supportedExtensions = uniqueSorted(
    uploadPolicies.flatMap(policy => policy.allowedExtensions),
  );
  const supportedMimeTypes = uniqueSorted(
    uploadPolicies.flatMap(policy => policy.allowedMimeTypes),
  );

  return {
    mcp: {
      name: MCP_NAME,
      version: MCP_VERSION,
    },
    tenant: tenantIdentity,
    runtime: {
      writeEnabled,
      safeModeEnabled,
      enabledToolFilterActive: hasEnabledToolFilter,
      enabledTools: getEnabledToolNames(),
      baseApiUrl,
      oauthBaseUrl,
    },
    tools: {
      generated: {
        count: generatedToolNames.length,
        mutationCount: generatedOperations.filter(
          operation => operation.isMutation,
        ).length,
        bySource: countGeneratedToolsBySource(),
        mutationsBySource: countMutationsBySource(),
        names: generatedToolNames,
      },
      compatibility: compatibilityToolMetadata,
      workflows: workflowToolMetadata,
      unsupported: unsupportedToolMetadata,
    },
    pageLimits: {
      defaultPageSize: 25,
      recommendedMaxPageSize: 100,
      cursorFields: ["pageCursor", "pageInfo.endCursor", "nextPageCursor"],
    },
    uploads: {
      supportedExtensions,
      supportedMimeTypes,
      markdownConversion: {
        supportedInputExtensions: [".md", ".markdown"],
        defaultTarget: "pdf",
        targets: ["pdf", "docx"],
        renderers: ["auto", "playwright", "typst", "docx"],
        footer: {
          left: "document filename or markdownFooterDocumentName",
          right: "Page <pageNumber> of <totalPages>",
        },
      },
    },
    unsupportedSurfaces: [
      {
        id: "policy-control-linking",
        reason:
          "Current public Vanta API exposes policy reads plus control-document/control-test mappings, not policy-control read/write linkage.",
        fallback:
          "Use the Vanta UI and verify with policy/control inventory reads.",
      },
      {
        id: "test-comments",
        reason:
          "Current public Manage API does not expose direct test progress comments.",
        fallback:
          "Write a control note that references the Vanta test ID, then verify the related control/test reads.",
      },
      {
        id: "typst-pdf-renderer",
        reason:
          "Typst PDF rendering is a future optional renderer and is not required for v1 Markdown uploads.",
        fallback: "Use the default Playwright PDF renderer or DOCX conversion.",
      },
    ],
    specSnapshot: {
      generatedAt: "2026-02-27T21:06:04.419Z",
      totalOperations: generatedOperations.length,
      totalMutations: generatedOperations.filter(
        operation => operation.isMutation,
      ).length,
      bySource: countGeneratedToolsBySource(),
      mutationsBySource: countMutationsBySource(),
      note: "Generated from pinned openapi specs in this repository.",
    },
    dataModel: {
      policy:
        "Policy inventory/approval object returned by policy endpoints; policy latestApprovedVersion document slug IDs are not Vanta Document IDs.",
      policyApprovalTest:
        "Test representing policy approval state; control-test mappings do not relink policies.",
      document:
        "Manage API Document object addressable by /documents/{documentId} and document upload endpoints.",
      controlTestMapping:
        "Association between a control and a test exposed by add/list/delete control test endpoints.",
      controlDocumentMapping:
        "Association between a control and a document exposed by add/list/delete control document endpoints.",
      policyControlMapping:
        "Unsupported public API surface; use Vanta UI fallback.",
    },
  };
};
