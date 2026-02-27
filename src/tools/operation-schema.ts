import { z } from "zod";
import { GeneratedOperation, PrimitiveKind } from "../generated/operations.generated.js";

const schemaForKind = (
  kind: PrimitiveKind,
  itemKind?: PrimitiveKind,
): z.ZodTypeAny => {
  switch (kind) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "integer":
      return z.number().int();
    case "boolean":
      return z.boolean();
    case "array": {
      if (!itemKind || itemKind === "unknown") {
        return z.array(z.unknown());
      }
      return z.array(schemaForKind(itemKind));
    }
    case "object":
      return z.record(z.string(), z.unknown());
    case "unknown":
    default:
      return z.unknown();
  }
};

const withOptional = (
  schema: z.ZodTypeAny,
  required: boolean,
  description?: string,
): z.ZodTypeAny => {
  let current = schema;
  if (description) {
    current = current.describe(description);
  }

  return required ? current : current.optional();
};

export const buildOperationSchema = (
  operation: GeneratedOperation,
): z.ZodObject<z.ZodRawShape> => {
  const shape: z.ZodRawShape = {};

  for (const parameter of operation.parameters) {
    shape[parameter.name] = withOptional(
      schemaForKind(parameter.kind, parameter.itemKind),
      parameter.required,
      parameter.description,
    );
  }

  const requestBody = operation.requestBody;
  if (requestBody) {
    if (requestBody.kind === "multipart") {
      const hasFileField = Boolean(requestBody.fileFieldName);
      if (hasFileField) {
        shape.filePath = withOptional(
          z.string(),
          requestBody.required || Boolean(requestBody.fileFieldName),
          "Local file path for multipart upload.",
        );
        shape.mimeType = z
          .string()
          .optional()
          .describe("Optional MIME type for multipart upload.");
      }

      for (const field of requestBody.fields) {
        if (field.name === requestBody.fileFieldName) {
          continue;
        }
        shape[field.name] = withOptional(
          schemaForKind(field.kind),
          field.required,
          field.description,
        );
      }
    } else {
      shape.body = withOptional(
        z.record(z.string(), z.unknown()),
        requestBody.required,
        `Request body for ${requestBody.contentType}.`,
      );
    }
  }

  if (operation.isMutation) {
    shape.confirm = z
      .boolean()
      .optional()
      .describe("Must be true to execute mutation when safe mode is enabled.");
  }

  return z.object(shape);
};
