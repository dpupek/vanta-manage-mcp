import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VantaApiClient } from "../client/vanta-client.js";
import { errorEnvelope, toToolResult } from "../envelope.js";
import {
  getGeneratedToolNameByOperationId,
  invokeGeneratedOperation,
} from "./endpoint-tools.js";
import { isToolEnabled } from "../config.js";

interface ConsolidatedReadConfig {
  name: string;
  description: string;
  idParam: string;
  getOperationId: string;
  listOperationId: string;
  mapArgs?: (args: Record<string, unknown>) => Record<string, unknown>;
}

export interface CompatibilityToolMetadata {
  name: string;
  description: string;
  mappingIntent: string;
}

export const compatibilityToolMetadata: CompatibilityToolMetadata[] = [
  {
    name: "controls",
    description:
      "Access controls. Provide controlId for a specific control, or omit it to list controls.",
    mappingIntent: "GetControl/ListControls",
  },
  {
    name: "documents",
    description:
      "Access documents. Provide documentId for a specific document, or omit it to list documents.",
    mappingIntent: "GetDocument/ListDocuments",
  },
  {
    name: "tests",
    description:
      "Access tests. Provide testId for a specific test, or omit it to list tests.",
    mappingIntent: "GetTest/ListTests",
  },
  {
    name: "integrations",
    description:
      "Access connected integrations. Provide integrationId for a specific integration, or omit it to list integrations.",
    mappingIntent: "GetConnectedIntegration/ListConnectedIntegrations",
  },
  {
    name: "frameworks",
    description:
      "Access frameworks. Provide frameworkId for a specific framework, or omit it to list frameworks.",
    mappingIntent: "GetFramework/ListFrameworks",
  },
  {
    name: "vulnerabilities",
    description:
      "Access vulnerabilities. Provide vulnerabilityId for a specific vulnerability, or omit it to list vulnerabilities.",
    mappingIntent: "GetVulnerability/ListVulnerabilities",
  },
  {
    name: "people",
    description:
      "Access people. Provide personId for a specific person, or omit it to list people.",
    mappingIntent: "GetPerson/ListPeople",
  },
  {
    name: "vendors",
    description:
      "Access vendors. Provide vendorId for a specific vendor, or omit it to list vendors.",
    mappingIntent: "GetVendor/ListVendors",
  },
  {
    name: "risks",
    description:
      "Access risk scenarios. Provide riskId for a specific scenario, or omit it to list risk scenarios.",
    mappingIntent: "GetRiskScenario/ListRiskScenario",
  },
  {
    name: "list_control_tests",
    description: "List tests linked to a specific control.",
    mappingIntent: "ListTestsForControl",
  },
  {
    name: "list_control_documents",
    description: "List documents linked to a specific control.",
    mappingIntent: "ListDocumentsForControl",
  },
  {
    name: "list_framework_controls",
    description: "List controls linked to a specific framework.",
    mappingIntent: "ListControlsForFramework",
  },
  {
    name: "list_test_entities",
    description: "List entities for a specific test.",
    mappingIntent: "GetTestEntities",
  },
  {
    name: "document_resources",
    description: "List controls, links, or uploads associated with a document.",
    mappingIntent:
      "ListControlsForDocument/ListLinksForDocument/ListFilesForDocument",
  },
  {
    name: "integration_resources",
    description: "Read integration resource kinds and resources.",
    mappingIntent:
      "ListResourceKindSummaries/GetResourceKindDetails/ListResources/GetResource",
  },
];

const paginationShape = {
  pageSize: z.number().int().min(1).max(100).optional(),
  pageCursor: z.string().optional(),
};

const executeByOperationId = async (
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
        `Could not find generated tool for operationId=${operationId} source=${source}.`,
      ),
    );
  }
  return invokeGeneratedOperation(toolName, args, client);
};

const registerConsolidatedReadTool = (
  server: McpServer,
  client: VantaApiClient,
  config: ConsolidatedReadConfig,
): boolean => {
  if (!isToolEnabled(config.name)) {
    return false;
  }

  const shape: z.ZodRawShape = {
    [config.idParam]: z
      .string()
      .optional()
      .describe(
        `Optional ${config.idParam}. If provided the tool returns a single resource, otherwise a paginated list.`,
      ),
    ...paginationShape,
  };

  server.tool(config.name, config.description, shape, async rawArgs => {
    const args = rawArgs as Record<string, unknown>;
    const mapped = config.mapArgs ? config.mapArgs(args) : args;
    const idValue = mapped[config.idParam];
    if (typeof idValue === "string" && idValue.length > 0) {
      return executeByOperationId(config.getOperationId, mapped, client);
    }

    const listArgs = Object.fromEntries(
      Object.entries(mapped).filter(([key]) => key !== config.idParam),
    ) as Record<string, unknown>;
    return executeByOperationId(config.listOperationId, listArgs, client);
  });

  return true;
};

export function registerCompatibilityReadTools(
  server: McpServer,
  client: VantaApiClient,
): number {
  const readConfigs: ConsolidatedReadConfig[] = [
    {
      name: "controls",
      description:
        "Access controls. Provide controlId for a specific control, or omit it to list controls.",
      idParam: "controlId",
      getOperationId: "GetControl",
      listOperationId: "ListControls",
    },
    {
      name: "documents",
      description:
        "Access documents. Provide documentId for a specific document, or omit it to list documents.",
      idParam: "documentId",
      getOperationId: "GetDocument",
      listOperationId: "ListDocuments",
    },
    {
      name: "tests",
      description:
        "Access tests. Provide testId for a specific test, or omit it to list tests.",
      idParam: "testId",
      getOperationId: "GetTest",
      listOperationId: "ListTests",
    },
    {
      name: "integrations",
      description:
        "Access connected integrations. Provide integrationId for a specific integration, or omit it to list integrations.",
      idParam: "integrationId",
      getOperationId: "GetConnectedIntegration",
      listOperationId: "ListConnectedIntegrations",
    },
    {
      name: "frameworks",
      description:
        "Access frameworks. Provide frameworkId for a specific framework, or omit it to list frameworks.",
      idParam: "frameworkId",
      getOperationId: "GetFramework",
      listOperationId: "ListFrameworks",
    },
    {
      name: "vulnerabilities",
      description:
        "Access vulnerabilities. Provide vulnerabilityId for a specific vulnerability, or omit it to list vulnerabilities.",
      idParam: "vulnerabilityId",
      getOperationId: "GetVulnerability",
      listOperationId: "ListVulnerabilities",
    },
    {
      name: "people",
      description:
        "Access people. Provide personId for a specific person, or omit it to list people.",
      idParam: "personId",
      getOperationId: "GetPerson",
      listOperationId: "ListPeople",
    },
    {
      name: "vendors",
      description:
        "Access vendors. Provide vendorId for a specific vendor, or omit it to list vendors.",
      idParam: "vendorId",
      getOperationId: "GetVendor",
      listOperationId: "ListVendors",
    },
    {
      name: "risks",
      description:
        "Access risk scenarios. Provide riskId for a specific scenario, or omit it to list risk scenarios.",
      idParam: "riskId",
      getOperationId: "GetRiskScenario",
      listOperationId: "ListRiskScenario",
      mapArgs: args => {
        const { riskId, ...rest } = args;
        return {
          ...rest,
          riskScenarioId: riskId,
        };
      },
    },
  ];

  let registered = 0;
  for (const config of readConfigs) {
    if (registerConsolidatedReadTool(server, client, config)) {
      registered += 1;
    }
  }

  if (isToolEnabled("list_control_tests")) {
    server.tool(
      "list_control_tests",
      "List tests linked to a specific control.",
      {
        controlId: z.string(),
        ...paginationShape,
      },
      args => executeByOperationId("ListTestsForControl", args, client),
    );
    registered += 1;
  }

  if (isToolEnabled("list_control_documents")) {
    server.tool(
      "list_control_documents",
      "List documents linked to a specific control.",
      {
        controlId: z.string(),
        ...paginationShape,
      },
      args => executeByOperationId("ListDocumentsForControl", args, client),
    );
    registered += 1;
  }

  if (isToolEnabled("list_framework_controls")) {
    server.tool(
      "list_framework_controls",
      "List controls linked to a specific framework.",
      {
        frameworkId: z.string(),
        ...paginationShape,
      },
      args => executeByOperationId("ListControlsForFramework", args, client),
    );
    registered += 1;
  }

  if (isToolEnabled("list_test_entities")) {
    server.tool(
      "list_test_entities",
      "List entities for a specific test.",
      {
        testId: z.string(),
        ...paginationShape,
      },
      args => executeByOperationId("GetTestEntities", args, client),
    );
    registered += 1;
  }

  if (isToolEnabled("document_resources")) {
    server.tool(
      "document_resources",
      "List controls, links, or uploads associated with a document.",
      {
        documentId: z.string(),
        resourceType: z.enum(["controls", "links", "uploads"]),
        ...paginationShape,
      },
      async args => {
        const mapping: Record<string, string> = {
          controls: "ListControlsForDocument",
          links: "ListLinksForDocument",
          uploads: "ListFilesForDocument",
        };
        return executeByOperationId(
          mapping[String(args.resourceType)],
          args,
          client,
        );
      },
    );
    registered += 1;
  }

  if (isToolEnabled("integration_resources")) {
    server.tool(
      "integration_resources",
      "Read integration resource kinds and resources.",
      {
        integrationId: z.string(),
        operation: z.enum([
          "list_kinds",
          "get_kind_details",
          "list_resources",
          "get_resource",
        ]),
        resourceKind: z.string().optional(),
        resourceId: z.string().optional(),
        ...paginationShape,
      },
      async args => {
        const operation = String(args.operation);
        if (operation === "list_kinds") {
          return executeByOperationId(
            "ListResourceKindSummaries",
            args,
            client,
          );
        }
        if (operation === "get_kind_details") {
          if (!args.resourceKind) {
            return toToolResult(
              errorEnvelope(
                "validation_error",
                "resourceKind is required for get_kind_details.",
              ),
            );
          }
          return executeByOperationId("GetResourceKindDetails", args, client);
        }
        if (operation === "list_resources") {
          if (!args.resourceKind) {
            return toToolResult(
              errorEnvelope(
                "validation_error",
                "resourceKind is required for list_resources.",
              ),
            );
          }
          return executeByOperationId("ListResources", args, client);
        }
        if (!args.resourceKind || !args.resourceId) {
          return toToolResult(
            errorEnvelope(
              "validation_error",
              "resourceKind and resourceId are required for get_resource.",
            ),
          );
        }
        return executeByOperationId("GetResource", args, client);
      },
    );
    registered += 1;
  }

  return registered;
}
