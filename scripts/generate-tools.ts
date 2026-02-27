import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

type ApiSource = "manage" | "audit" | "connectors";

interface OpenApiSpec {
  paths?: Record<string, OpenApiPathItem>;
  components?: {
    parameters?: Record<string, OpenApiParameter>;
    schemas?: Record<string, OpenApiSchema>;
    requestBodies?: Record<string, OpenApiRequestBody>;
  };
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameterOrRef[];
  requestBody?: OpenApiRequestBodyOrRef;
}

interface OpenApiPathItem {
  parameters?: OpenApiParameterOrRef[];
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
  [key: string]: unknown;
}

interface OpenApiReference {
  $ref: string;
}

type OpenApiParameterOrRef = OpenApiParameter | OpenApiReference;
type OpenApiRequestBodyOrRef = OpenApiRequestBody | OpenApiReference;
type OpenApiSchemaOrRef = OpenApiSchema | OpenApiReference;

interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: OpenApiSchemaOrRef;
}

interface OpenApiRequestBody {
  required?: boolean;
  content?: Record<string, { schema?: OpenApiSchemaOrRef }>;
}

interface OpenApiSchema {
  type?: string;
  format?: string;
  description?: string;
  enum?: (string | number | boolean)[];
  properties?: Record<string, OpenApiSchemaOrRef>;
  required?: string[];
  items?: OpenApiSchemaOrRef;
  oneOf?: OpenApiSchemaOrRef[];
  anyOf?: OpenApiSchemaOrRef[];
  allOf?: OpenApiSchemaOrRef[];
}

type PrimitiveKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "unknown";

interface GeneratedParameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  kind: PrimitiveKind;
  itemKind?: PrimitiveKind;
  enumValues?: string[];
}

interface GeneratedRequestField {
  name: string;
  required: boolean;
  description?: string;
  kind: PrimitiveKind;
}

interface GeneratedRequestBody {
  required: boolean;
  contentType: string;
  kind: "json" | "multipart" | "raw";
  fields: GeneratedRequestField[];
  fileFieldName?: string;
}

interface GeneratedOperation {
  toolName: string;
  source: ApiSource;
  method: HttpMethod;
  path: string;
  operationId: string;
  description: string;
  summary?: string;
  isMutation: boolean;
  parameters: GeneratedParameter[];
  requestBody?: GeneratedRequestBody;
}

interface SpecDescriptor {
  source: ApiSource;
  filename: string;
}

interface GenerationOutput {
  operations: GeneratedOperation[];
  stats: Record<ApiSource, { operations: number; mutations: number }>;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const openApiDirectory = path.join(repositoryRoot, "openapi");
const generatedDirectory = path.join(repositoryRoot, "src", "generated");

const specDescriptors: SpecDescriptor[] = [
  { source: "manage", filename: "manage-v1.json" },
  { source: "audit", filename: "audit-v1.json" },
  { source: "connectors", filename: "connectors-v1.json" },
];

const pickContentType = (contentTypes: string[]): string => {
  const priorities = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
    "text/plain",
  ];
  for (const candidate of priorities) {
    if (contentTypes.includes(candidate)) {
      return candidate;
    }
  }
  return contentTypes[0] ?? "application/json";
};

const toSnakeCase = (value: string): string => {
  const withSpaces = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");
  return withSpaces
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
};

const fallbackOperationId = (method: HttpMethod, route: string): string =>
  `${method}_${route.replace(/[^a-zA-Z0-9]+/g, "_")}`.replace(/_+/g, "_");

const toPrimitiveKind = (schema: OpenApiSchema | undefined): PrimitiveKind => {
  if (!schema) {
    return "unknown";
  }
  if (schema.type === "string") {
    return "string";
  }
  if (schema.type === "number") {
    return "number";
  }
  if (schema.type === "integer") {
    return "integer";
  }
  if (schema.type === "boolean") {
    return "boolean";
  }
  if (schema.type === "array") {
    return "array";
  }
  if (schema.type === "object") {
    return "object";
  }
  if (schema.oneOf ?? schema.anyOf ?? schema.allOf) {
    return "object";
  }
  return "unknown";
};

const resolveRef = <T>(
  spec: OpenApiSpec,
  maybeRef: T | OpenApiReference | undefined,
): T | undefined => {
  if (!maybeRef) {
    return undefined;
  }

  if (!("$ref" in (maybeRef as OpenApiReference))) {
    return maybeRef as T;
  }

  const ref = (maybeRef as OpenApiReference).$ref;
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local refs are supported, found: ${ref}`);
  }

  const parts = ref.replace(/^#\//, "").split("/");
  let current: unknown = spec;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      throw new Error(`Unable to resolve ref: ${ref}`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current as T;
};

const resolveSchema = (
  spec: OpenApiSpec,
  schemaOrRef: OpenApiSchemaOrRef | undefined,
): OpenApiSchema | undefined => resolveRef<OpenApiSchema>(spec, schemaOrRef);

const resolveParameter = (
  spec: OpenApiSpec,
  parameterOrRef: OpenApiParameterOrRef,
): OpenApiParameter => {
  const resolved = resolveRef<OpenApiParameter>(spec, parameterOrRef);
  if (!resolved) {
    throw new Error("Failed to resolve parameter.");
  }
  return resolved;
};

const resolveRequestBody = (
  spec: OpenApiSpec,
  bodyOrRef: OpenApiRequestBodyOrRef | undefined,
): OpenApiRequestBody | undefined =>
  resolveRef<OpenApiRequestBody>(spec, bodyOrRef);

const mergeParameters = (
  pathParameters: OpenApiParameterOrRef[] | undefined,
  operationParameters: OpenApiParameterOrRef[] | undefined,
  spec: OpenApiSpec,
): OpenApiParameter[] => {
  const merged = new Map<string, OpenApiParameter>();
  for (const candidate of [
    ...(pathParameters ?? []),
    ...(operationParameters ?? []),
  ]) {
    const parameter = resolveParameter(spec, candidate);
    const key = `${parameter.in}:${parameter.name}`;
    merged.set(key, parameter);
  }
  return [...merged.values()];
};

const mapParameters = (
  spec: OpenApiSpec,
  parameters: OpenApiParameter[],
): GeneratedParameter[] =>
  parameters
    .filter(
      (param): param is OpenApiParameter & { in: "path" | "query" } =>
        param.in === "path" || param.in === "query",
    )
    .map(param => {
      const schema = resolveSchema(spec, param.schema);
      const kind = toPrimitiveKind(schema);
      const mapped: GeneratedParameter = {
        name: param.name,
        in: param.in,
        required: param.in === "path" ? true : param.required === true,
        description: param.description,
        kind,
      };

      if (kind === "array") {
        const itemSchema = resolveSchema(spec, schema?.items);
        mapped.itemKind = toPrimitiveKind(itemSchema);
      }

      if (schema?.enum) {
        mapped.enumValues = schema.enum.map(value => String(value));
      }

      return mapped;
    });

const mapRequestBody = (
  spec: OpenApiSpec,
  requestBody: OpenApiRequestBody | undefined,
): GeneratedRequestBody | undefined => {
  if (!requestBody?.content) {
    return undefined;
  }

  const contentType = pickContentType(Object.keys(requestBody.content));
  const selectedContent = requestBody.content[contentType];
  if (!selectedContent.schema) {
    return {
      required: requestBody.required === true,
      contentType,
      kind: contentType === "multipart/form-data" ? "multipart" : "raw",
      fields: [],
    };
  }

  const schema = resolveSchema(spec, selectedContent.schema);
  if (!schema) {
    return undefined;
  }

  if (contentType === "multipart/form-data") {
    const requiredFields = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties ?? {}).map(
      ([name, fieldRef]) => {
        const fieldSchema = resolveSchema(spec, fieldRef);
        return {
          name,
          required: requiredFields.has(name),
          description: fieldSchema?.description,
          kind: toPrimitiveKind(fieldSchema),
        } satisfies GeneratedRequestField;
      },
    );

    const fileField = Object.entries(schema.properties ?? {}).find(
      ([, fieldRef]) => {
        const fieldSchema = resolveSchema(spec, fieldRef);
        return (
          fieldSchema?.type === "string" && fieldSchema.format === "binary"
        );
      },
    );

    return {
      required: requestBody.required === true,
      contentType,
      kind: "multipart",
      fields,
      fileFieldName: fileField?.[0],
    };
  }

  if (schema.type === "object" || schema.properties) {
    const requiredFields = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties ?? {}).map(
      ([name, fieldRef]) => {
        const fieldSchema = resolveSchema(spec, fieldRef);
        return {
          name,
          required: requiredFields.has(name),
          description: fieldSchema?.description,
          kind: toPrimitiveKind(fieldSchema),
        } satisfies GeneratedRequestField;
      },
    );

    return {
      required: requestBody.required === true,
      contentType,
      kind: "json",
      fields,
    };
  }

  return {
    required: requestBody.required === true,
    contentType,
    kind: "raw",
    fields: [],
  };
};

const preferredNameOverride = (
  source: ApiSource,
  operationId: string,
): string | undefined => {
  if (source === "audit" && operationId === "CreateCustomControl") {
    return "audit_create_custom_control";
  }
  if (source === "audit" && operationId === "ListVulnerabilities") {
    return "audit_list_vulnerabilities";
  }
  return undefined;
};

const withSourcePrefix = (source: ApiSource, name: string): string => {
  if (source === "connectors") {
    return name.startsWith("connector_") ? name : `connector_${name}`;
  }
  if (source === "audit") {
    return name.startsWith("audit_") ? name : `audit_${name}`;
  }
  return name;
};

const computeToolName = (
  source: ApiSource,
  operationId: string,
  nameUsage: Map<string, number>,
): string => {
  const override = preferredNameOverride(source, operationId);
  let candidate = override ?? toSnakeCase(operationId);
  if (source === "connectors" && !candidate.startsWith("connector_")) {
    candidate = `connector_${candidate}`;
  }

  if (!nameUsage.has(candidate)) {
    nameUsage.set(candidate, 1);
    return candidate;
  }

  const prefixed = withSourcePrefix(source, candidate);
  if (!nameUsage.has(prefixed)) {
    nameUsage.set(prefixed, 1);
    return prefixed;
  }

  let suffix = nameUsage.get(prefixed) ?? 1;
  while (nameUsage.has(`${prefixed}_${suffix.toString()}`)) {
    suffix += 1;
  }
  const finalName = `${prefixed}_${suffix.toString()}`;
  nameUsage.set(prefixed, suffix + 1);
  nameUsage.set(finalName, 1);
  return finalName;
};

const isMutatingMethod = (method: HttpMethod): boolean => method !== "get";

const generateOperations = (): GenerationOutput => {
  const operations: GeneratedOperation[] = [];
  const nameUsage = new Map<string, number>();
  const stats: Record<ApiSource, { operations: number; mutations: number }> = {
    manage: { operations: 0, mutations: 0 },
    audit: { operations: 0, mutations: 0 },
    connectors: { operations: 0, mutations: 0 },
  };

  for (const descriptor of specDescriptors) {
    const fullPath = path.join(openApiDirectory, descriptor.filename);
    const spec = JSON.parse(fs.readFileSync(fullPath, "utf8")) as OpenApiSpec;

    for (const [route, routeItem] of Object.entries(spec.paths ?? {})) {
      const pathLevelParameters = routeItem.parameters;
      for (const method of Object.keys(routeItem)) {
        const lowerMethod = method.toLowerCase() as HttpMethod;
        if (
          ![
            "get",
            "post",
            "put",
            "patch",
            "delete",
            "options",
            "head",
          ].includes(lowerMethod)
        ) {
          continue;
        }

        const operation = routeItem[lowerMethod];
        if (!operation) {
          continue;
        }

        const operationId =
          operation.operationId ?? fallbackOperationId(lowerMethod, route);
        const toolName = computeToolName(
          descriptor.source,
          operationId,
          nameUsage,
        );
        const mergedParameters = mergeParameters(
          pathLevelParameters,
          operation.parameters,
          spec,
        );

        const mappedOperation: GeneratedOperation = {
          toolName,
          source: descriptor.source,
          method: lowerMethod,
          path: route,
          operationId,
          summary: operation.summary,
          description:
            operation.summary ??
            operation.description ??
            `${lowerMethod.toUpperCase()} ${route}`,
          isMutation: isMutatingMethod(lowerMethod),
          parameters: mapParameters(spec, mergedParameters),
          requestBody: mapRequestBody(
            spec,
            resolveRequestBody(spec, operation.requestBody),
          ),
        };

        operations.push(mappedOperation);
        stats[descriptor.source].operations += 1;
        if (mappedOperation.isMutation) {
          stats[descriptor.source].mutations += 1;
        }
      }
    }
  }

  return { operations, stats };
};

const writeGeneratedFiles = ({ operations, stats }: GenerationOutput): void => {
  fs.mkdirSync(generatedDirectory, { recursive: true });

  const operationPayload = JSON.stringify(operations, null, 2);
  const statsPayload = JSON.stringify(stats, null, 2);

  const generatedTs = `/* eslint-disable */
// AUTO-GENERATED FILE. DO NOT EDIT.
// Generated by scripts/generate-tools.ts

export type ApiSource = "manage" | "audit" | "connectors";
export type PrimitiveKind = "string" | "number" | "integer" | "boolean" | "array" | "object" | "unknown";

export interface GeneratedParameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  kind: PrimitiveKind;
  itemKind?: PrimitiveKind;
  enumValues?: string[];
}

export interface GeneratedRequestField {
  name: string;
  required: boolean;
  description?: string;
  kind: PrimitiveKind;
}

export interface GeneratedRequestBody {
  required: boolean;
  contentType: string;
  kind: "json" | "multipart" | "raw";
  fields: GeneratedRequestField[];
  fileFieldName?: string;
}

export interface GeneratedOperation {
  toolName: string;
  source: ApiSource;
  method: "get" | "post" | "put" | "patch" | "delete" | "options" | "head";
  path: string;
  operationId: string;
  description: string;
  summary?: string;
  isMutation: boolean;
  parameters: GeneratedParameter[];
  requestBody?: GeneratedRequestBody;
}

export const generatedOperations: GeneratedOperation[] = ${operationPayload};
export const generatedStats = ${statsPayload} as const;
export const generatedOperationCount = generatedOperations.length;
export const generatedMutationCount = generatedOperations.filter(operation => operation.isMutation).length;

export const generatedOperationByToolName: Partial<Record<string, GeneratedOperation>> = Object.fromEntries(
  generatedOperations.map(operation => [operation.toolName, operation]),
) as Partial<Record<string, GeneratedOperation>>;
`;

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalOperations: operations.length,
    totalMutations: operations.filter(operation => operation.isMutation).length,
    stats,
    tools: operations.map(operation => ({
      toolName: operation.toolName,
      source: operation.source,
      method: operation.method,
      path: operation.path,
      operationId: operation.operationId,
      isMutation: operation.isMutation,
    })),
  };

  fs.writeFileSync(
    path.join(generatedDirectory, "operations.generated.ts"),
    generatedTs,
    "utf8",
  );
  fs.writeFileSync(
    path.join(generatedDirectory, "manifest.generated.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
};

const main = (): void => {
  const output = generateOperations();
  writeGeneratedFiles(output);

  const summary = [
    `Generated ${output.operations.length.toString()} operations`,
    `Manage: ${output.stats.manage.operations.toString()} (${output.stats.manage.mutations.toString()} mutating)`,
    `Audit: ${output.stats.audit.operations.toString()} (${output.stats.audit.mutations.toString()} mutating)`,
    `Connectors: ${output.stats.connectors.operations.toString()} (${output.stats.connectors.mutations.toString()} mutating)`,
  ];
  process.stdout.write(`${summary.join("\n")}\n`);
};

main();
