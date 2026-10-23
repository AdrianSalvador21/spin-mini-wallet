import "server-only";
import type { NextRequest } from "next/server";
import { API_ERROR_CODE, REQUEST_ID_HEADER } from "@/shared/lib/api/contract";
import { ERROR_SOURCE, type ErrorReporter } from "@/shared/observability/error-reporter";
import type { Logger } from "@/shared/observability/logger";
import type { Services } from "../container";
import { UnauthorizedError } from "../errors";
import { requireSession } from "../session/session";
import type { SessionPayload } from "../session/token";
import { errorResponse } from "./api-error";
import { checkMutationRequest } from "./csrf";

export interface HttpDependencies {
  services: Services;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  createRequestId: () => string;
  logger: Logger;
  reporter: ErrorReporter;
  allowScenarioOverride: boolean;
}

export interface RouteContext<P> {
  request: NextRequest;
  requestId: string;
  session: SessionPayload;
  params: P;
  reportScenario: (scenario: string) => void;
}

export interface RouteHandlerOptions {
  mutating?: boolean;
}

type NextRouteHandler<P> = (
  request: NextRequest,
  context: { params: Promise<P> },
) => Promise<Response>;

export function createRouteHandler<P = Record<string, never>>(
  deps: HttpDependencies,
  options: RouteHandlerOptions,
  handle: (ctx: RouteContext<P>) => Promise<Response>,
): NextRouteHandler<P> {
  return async (request, context) => {
    const requestId = request.headers.get(REQUEST_ID_HEADER) ?? deps.createRequestId();
    const startedAt = Date.now();
    let scenario: string | undefined;

    const finish = (response: Response): Response => {
      response.headers.set(REQUEST_ID_HEADER, requestId);
      response.headers.set("Cache-Control", "no-store");

      deps.logger.info("api_request", {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        ...(scenario !== undefined ? { scenario } : {}),
      });

      return response;
    };

    if (options.mutating) {
      const violation = checkMutationRequest(request);

      if (violation) {
        return finish(errorResponse({ status: violation.status, code: violation.code }, requestId));
      }
    }

    let session: SessionPayload;

    try {
      session = await requireSession();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return finish(errorResponse({ status: 401, code: API_ERROR_CODE.UNAUTHORIZED }, requestId));
      }

      throw error;
    }

    if (!(await deps.services.auth.exists(session.userId))) {
      return finish(errorResponse({ status: 401, code: API_ERROR_CODE.UNAUTHORIZED }, requestId));
    }

    try {
      const params = await context.params;
      const response = await handle({
        request,
        requestId,
        session,
        params,
        reportScenario: (value) => {
          scenario = value;
        },
      });

      return finish(response);
    } catch (error) {
      deps.logger.error("route_handler_error", { requestId });
      deps.reporter.captureException(error, { requestId, source: ERROR_SOURCE.ROUTE_HANDLER });

      return finish(errorResponse({ status: 500, code: API_ERROR_CODE.INTERNAL_ERROR }, requestId));
    }
  };
}
