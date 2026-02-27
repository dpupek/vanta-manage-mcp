import { logLevelName } from "./config.js";
import { redactFields } from "./redaction.js";
import { LogEntry, LogFields, LogLevelName, LogSeverity, MODE_TO_SEVERITIES } from "./types.js";

type LogSink = (line: string) => void;

interface LoggerOptions {
  levelName: LogLevelName;
  sink?: LogSink;
  context?: Record<string, unknown>;
}

const defaultSink: LogSink = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const serializeError = (
  error: Error,
  includeStack: boolean,
): Record<string, unknown> => {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };
  if (includeStack) {
    serialized.stack = error.stack ?? "";
  }
  return serialized;
};

const normalizeValue = (
  value: unknown,
  includeStack: boolean,
  seen: WeakSet<object>,
): unknown => {
  if (value instanceof Error) {
    return serializeError(value, includeStack);
  }
  if (!isObject(value)) {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => normalizeValue(item, includeStack, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = normalizeValue(item, includeStack, seen);
  }
  return output;
};

const normalizeFields = (
  fields: LogFields,
  includeStack: boolean,
): Record<string, unknown> | undefined => {
  if (!fields) {
    return undefined;
  }
      const normalized = normalizeValue(fields, includeStack, new WeakSet());
  if (!isObject(normalized)) {
    return { value: normalized };
  }
  return normalized;
};

export class Logger {
  private readonly levelName: LogLevelName;
  private readonly sink: LogSink;
  private readonly context: Record<string, unknown>;

  public constructor(options: LoggerOptions) {
    this.levelName = options.levelName;
    this.sink = options.sink ?? defaultSink;
    this.context = options.context ?? {};
  }

  public getMode(): LogLevelName {
    return this.levelName;
  }

  public getEnabledSeverities(): LogSeverity[] {
    return [...MODE_TO_SEVERITIES[this.levelName]];
  }

  public child(contextFields: Record<string, unknown>): Logger {
    return new Logger({
      levelName: this.levelName,
      sink: this.sink,
      context: {
        ...this.context,
        ...contextFields,
      },
    });
  }

  public shouldLog(level: LogSeverity): boolean {
    return MODE_TO_SEVERITIES[this.levelName].has(level);
  }

  public fatal(event: string, message: string, fields?: LogFields): void {
    this.emit("fatal", event, message, fields);
  }

  public error(event: string, message: string, fields?: LogFields): void {
    this.emit("error", event, message, fields);
  }

  public warn(event: string, message: string, fields?: LogFields): void {
    this.emit("warn", event, message, fields);
  }

  public info(event: string, message: string, fields?: LogFields): void {
    this.emit("info", event, message, fields);
  }

  public debug(event: string, message: string, fields?: LogFields): void {
    this.emit("debug", event, message, fields);
  }

  public trace(event: string, message: string, fields?: LogFields): void {
    this.emit("trace", event, message, fields);
  }

  private emit(
    level: LogSeverity,
    event: string,
    message: string,
    fields?: LogFields,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    try {
      const includeStack = MODE_TO_SEVERITIES[this.levelName].has("debug");
      const normalizedFields = normalizeFields(
        {
          ...this.context,
          ...(fields ?? {}),
        },
        includeStack,
      );
      const entry: LogEntry = {
        ts: new Date().toISOString(),
        level,
        event,
        msg: message,
      };
      if (normalizedFields && Object.keys(normalizedFields).length > 0) {
        entry.fields = redactFields(normalizedFields);
      }

      this.sink(JSON.stringify(entry));
    } catch {
      // Logging must never break the MCP server.
    }
  }
}

export const createLogger = (options?: Partial<LoggerOptions>): Logger =>
  new Logger({
    levelName: options?.levelName ?? logLevelName,
    sink: options?.sink,
    context: options?.context,
  });

export const logger = createLogger();
