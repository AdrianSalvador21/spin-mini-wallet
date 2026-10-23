import "server-only";
import type { Money } from "@/domain/money/money";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import type { Database } from "../db/json-database";

export interface ServiceDependencies {
  db: Database;
  now: () => Date;
  random: () => number;
  createId: () => string;
}

export const SERVICE_ERROR_CODE = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  NOT_FOUND: "NOT_FOUND",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
} as const;

export type ServiceError =
  | { code: typeof SERVICE_ERROR_CODE.VALIDATION_ERROR; details: Record<string, ValidationCode[]> }
  | { code: typeof SERVICE_ERROR_CODE.INSUFFICIENT_FUNDS; balance: Money }
  | { code: typeof SERVICE_ERROR_CODE.INVALID_CREDENTIALS }
  | { code: typeof SERVICE_ERROR_CODE.NOT_FOUND }
  | { code: typeof SERVICE_ERROR_CODE.IDEMPOTENCY_CONFLICT };
