import { z } from "zod";

interface InputSchema {
  $ref?: string;
  type?: string;
  description?: string;
  format?: string;
  nullable?: boolean;
  enum?: (string | number | boolean | null)[];
  properties?: Record<string, InputSchema>;
  required?: string[];
  additionalProperties?: boolean | InputSchema;
  items?: InputSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  oneOf?: InputSchema[];
  anyOf?: InputSchema[];
  allOf?: InputSchema[];
}

/** Convert pinned OpenAPI input schemas without discarding nested constraints. */
export const buildInputSchema = (
  raw: Record<string, unknown>,
  definitions: Record<string, Record<string, unknown>>,
): z.ZodTypeAny => {
  const references = new Map<string, z.ZodTypeAny>();
  const union = (schemas: z.ZodTypeAny[]): z.ZodTypeAny =>
    schemas.length === 0
      ? z.never()
      : schemas.length === 1
        ? schemas[0]
        : z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  const convert = (schema: InputSchema): z.ZodTypeAny => {
    let result: z.ZodTypeAny;
    if (schema.$ref) {
      const name = schema.$ref.replace("#/components/schemas/", "");
      const target = definitions[name];
      if (!Object.hasOwn(definitions, name))
        throw new Error(`Missing input schema: ${schema.$ref}`);
      let reference = references.get(name);
      if (!reference) {
        reference = z.lazy(() => convert(target as InputSchema));
        references.set(name, reference);
      }
      result = reference;
    } else if (schema.type === "object" || schema.properties) {
      const required = new Set(schema.required ?? []);
      const shape: z.ZodRawShape = {};
      for (const [key, value] of Object.entries(schema.properties ?? {})) {
        const property = convert(value);
        shape[key] = required.has(key) ? property : property.optional();
      }
      const object = z.object(shape);
      result =
        schema.additionalProperties === false
          ? object.strict()
          : typeof schema.additionalProperties === "object"
            ? object.catchall(convert(schema.additionalProperties))
            : object.passthrough();
    } else if (schema.type === "array") {
      let array = z.array(convert(schema.items ?? {}));
      if (schema.minItems !== undefined) array = array.min(schema.minItems);
      if (schema.maxItems !== undefined) array = array.max(schema.maxItems);
      result = schema.uniqueItems
        ? array.refine(
            values =>
              new Set(values.map(value => JSON.stringify(value))).size ===
              values.length,
            "Array entries must be unique.",
          )
        : array;
    } else if (schema.type === "string") {
      let string = z.string();
      if (schema.minLength !== undefined) string = string.min(schema.minLength);
      if (schema.maxLength !== undefined) string = string.max(schema.maxLength);
      if (schema.pattern !== undefined)
        string = string.regex(new RegExp(schema.pattern, "u"));
      if (schema.format === "date-time")
        string = string.datetime({ offset: true });
      if (schema.format === "date") string = string.date();
      if (schema.format === "email") string = string.email();
      if (schema.format === "uri") string = string.url();
      result = string;
    } else if (schema.type === "number" || schema.type === "integer") {
      let number = z.number().finite();
      if (schema.type === "integer") number = number.int();
      if (schema.minimum !== undefined)
        number = schema.exclusiveMinimum
          ? number.gt(schema.minimum)
          : number.min(schema.minimum);
      if (schema.maximum !== undefined)
        number = schema.exclusiveMaximum
          ? number.lt(schema.maximum)
          : number.max(schema.maximum);
      if (schema.multipleOf !== undefined)
        number = number.multipleOf(schema.multipleOf);
      result = number;
    } else if (schema.type === "boolean") result = z.boolean();
    else if (schema.type === "null") result = z.null();
    else result = z.unknown();

    if (schema.enum)
      result = result.and(
        union(
          schema.enum.map(value =>
            value === null ? z.null() : z.literal(value),
          ),
        ),
      );
    if (schema.allOf)
      for (const member of schema.allOf) result = result.and(convert(member));
    if (schema.anyOf) result = result.and(union(schema.anyOf.map(convert)));
    if (schema.oneOf) {
      const branches = schema.oneOf.map(convert);
      result = result.and(
        union(branches).refine(
          value =>
            branches.filter(branch => branch.safeParse(value).success)
              .length === 1,
          "Expected exactly one schema alternative.",
        ),
      );
    }
    if (schema.nullable) result = result.nullable();
    if (schema.description) result = result.describe(schema.description);
    return result;
  };
  return convert(raw as InputSchema);
};
