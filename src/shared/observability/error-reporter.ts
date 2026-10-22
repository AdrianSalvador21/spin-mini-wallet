import { logger } from "./logger";

export const ERROR_SOURCE = {
  ROUTE_HANDLER: "route-handler",
  SERVER_ACTION: "server-action",
  REQUEST_ERROR: "request-error",
  BROWSER: "browser",
} as const;

export type ErrorSource = (typeof ERROR_SOURCE)[keyof typeof ERROR_SOURCE];

export interface ErrorContext {
  requestId?: string;
  source: ErrorSource;
  [key: string]: unknown;
}

export interface ErrorReporter {
  captureException(error: unknown, context: ErrorContext): void;
}

function toErrorDetails(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { name: "UnknownError", message: String(error) };
}

export const consoleErrorReporter: ErrorReporter = {
  captureException(error, context) {
    const { name, message, stack } = toErrorDetails(error);

    logger.error(message, { ...context, name, stack });
  },
};

export function getErrorReporter(): ErrorReporter {
  return consoleErrorReporter;
}
