const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";
const MAX_DEPTH = 6;

const REDACTED_KEY_FRAGMENTS = [
  "token",
  "authorization",
  "client_secret",
  "secret",
  "contentbase64",
  "password",
  "apikey",
  "cookie",
];

export const shouldRedactKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return REDACTED_KEY_FRAGMENTS.some(fragment => normalized.includes(fragment));
};

const redactInternal = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return "[MaxDepth]";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  if (typeof value === "function") {
    return "[Function]";
  }
  if (Array.isArray(value)) {
    return value.map(item => redactInternal(item, depth + 1, seen));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Map) {
    return Array.from(value.entries()).map(([key, item]) => ({
      key: redactInternal(key, depth + 1, seen),
      value: redactInternal(item, depth + 1, seen),
    }));
  }
  if (value instanceof Set) {
    return Array.from(value.values()).map(item =>
      redactInternal(item, depth + 1, seen),
    );
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);

    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) {
      if (shouldRedactKey(key)) {
        output[key] = REDACTED;
        continue;
      }
      output[key] = redactInternal(item, depth + 1, seen);
    }
    return output;
  }

  return String(value);
};

export const redactFields = (
  fields: Record<string, unknown>,
): Record<string, unknown> =>
  redactInternal(fields, 0, new WeakSet()) as Record<string, unknown>;
