export type LogLevelName = "quiet" | "minimal" | "verbose" | "all";

export type LogSeverity = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface LogEntry {
  ts: string;
  level: LogSeverity;
  event: string;
  msg: string;
  fields?: Record<string, unknown>;
}

export type LogFields = Record<string, unknown> | undefined;

export const LOG_LEVEL_NAMES: LogLevelName[] = [
  "quiet",
  "minimal",
  "verbose",
  "all",
];

export const MODE_TO_SEVERITIES: Record<LogLevelName, ReadonlySet<LogSeverity>> = {
  quiet: new Set(["fatal"]),
  minimal: new Set(["fatal", "error", "warn", "info"]),
  verbose: new Set(["fatal", "error", "warn", "info", "debug"]),
  all: new Set(["fatal", "error", "warn", "info", "debug", "trace"]),
};
