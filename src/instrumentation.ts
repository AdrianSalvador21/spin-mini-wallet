import type { Instrumentation } from "next";
import { REQUEST_ID_HEADER } from "@/shared/lib/api/contract";
import { ERROR_SOURCE, getErrorReporter } from "@/shared/observability/error-reporter";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const headerValue = request.headers[REQUEST_ID_HEADER];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  getErrorReporter().captureException(error, {
    source: ERROR_SOURCE.REQUEST_ERROR,
    ...(requestId !== undefined ? { requestId } : {}),
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
