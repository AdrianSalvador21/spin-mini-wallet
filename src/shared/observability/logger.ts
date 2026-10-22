import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { redact } from "./redact";

export const LOG_LEVEL = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

export interface LogFields {
  requestId?: string;
  [key: string]: unknown;
}

function writeLine(level: LogLevel, line: string): void {
  switch (level) {
    case LOG_LEVEL.INFO:
    case LOG_LEVEL.WARN:
      console.log(line);
      return;
    case LOG_LEVEL.ERROR:
      console.error(line);
      return;
    default:
      assertUnreachable(level);
  }
}

export function log(level: LogLevel, message: string, fields?: LogFields): void {
  const { requestId, ...context } = fields ?? {};
  const hasContext = Object.keys(context).length > 0;

  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId !== undefined ? { requestId } : {}),
    ...(hasContext ? { context: redact(context) } : {}),
  });

  writeLine(level, line);
}

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export const logger: Logger = {
  info: (message, fields) => log(LOG_LEVEL.INFO, message, fields),
  warn: (message, fields) => log(LOG_LEVEL.WARN, message, fields),
  error: (message, fields) => log(LOG_LEVEL.ERROR, message, fields),
};
