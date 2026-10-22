import "server-only";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import type { Money } from "@/domain/money/money";
import { API_ERROR_CODE, type ApiErrorBody, type ApiErrorCode } from "@/shared/lib/api/contract";
import { SERVICE_ERROR_CODE, type ServiceError } from "../services/types";

export interface ApiError {
  status: number;
  code: ApiErrorCode;
  details?: Record<string, ValidationCode[]>;
  balance?: Money;
}

export function toApiError(error: ServiceError): ApiError {
  switch (error.code) {
    case SERVICE_ERROR_CODE.VALIDATION_ERROR:
      return { status: 400, code: API_ERROR_CODE.VALIDATION_ERROR, details: error.details };
    case SERVICE_ERROR_CODE.INSUFFICIENT_FUNDS:
      return { status: 422, code: API_ERROR_CODE.INSUFFICIENT_FUNDS, balance: error.balance };
    case SERVICE_ERROR_CODE.NOT_FOUND:
      return { status: 404, code: API_ERROR_CODE.NOT_FOUND };
    case SERVICE_ERROR_CODE.IDEMPOTENCY_CONFLICT:
      return { status: 409, code: API_ERROR_CODE.IDEMPOTENCY_CONFLICT };
    case SERVICE_ERROR_CODE.INVALID_CREDENTIALS:
      return { status: 401, code: API_ERROR_CODE.UNAUTHORIZED };
    default:
      return assertUnreachable(error);
  }
}

export function errorResponse(apiError: ApiError, requestId: string): Response {
  const body: ApiErrorBody = {
    error: {
      code: apiError.code,
      message: `errors.api.${apiError.code}`,
      requestId,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      ...(apiError.balance !== undefined ? { balance: apiError.balance } : {}),
    },
  };

  return Response.json(body, { status: apiError.status });
}
