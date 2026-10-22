import type { Money } from "@/domain/money/money";
import type { ValidationCode } from "@/domain/shared/validation-codes";

export const API_ERROR_CODE = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: `errors.api.${ApiErrorCode}`;
    requestId: string;
    details?: Record<string, ValidationCode[]>;
    balance?: Money;
  };
}

export const TRANSFER_SCENARIO = {
  SUCCESS: "success",
  NETWORK_ERROR: "network_error",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  TIMEOUT: "timeout",
  UNKNOWN_ERROR: "unknown_error",
} as const;

export type TransferScenario = (typeof TRANSFER_SCENARIO)[keyof typeof TRANSFER_SCENARIO];

export const READ_SCENARIO = {
  OK: "ok",
  ERROR: "error",
  SLOW: "slow",
  MOVEMENTS_ERROR: "movements_error",
} as const;

export type ReadScenario = (typeof READ_SCENARIO)[keyof typeof READ_SCENARIO];

export const READ_RESOURCE = {
  SUMMARY: "summary",
  MOVEMENTS: "movements",
  CONTACTS: "contacts",
} as const;

export type ReadResource = (typeof READ_RESOURCE)[keyof typeof READ_RESOURCE];

export const READ_OUTCOME = {
  OK: "ok",
  SLOW: "slow",
  ERROR: "error",
} as const;

export type ReadOutcome = (typeof READ_OUTCOME)[keyof typeof READ_OUTCOME];

export const SCENARIO_COOKIE = {
  TRANSFER: "mock_scenario",
  READ: "mock_read_scenario",
} as const;

export const REQUEST_ID_HEADER = "x-request-id";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
