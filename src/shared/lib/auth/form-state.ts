import type { ValidationCode } from "@/domain/shared/validation-codes";
import type { LOGIN_METHOD } from "@/domain/user/schemas";

export type LoginMethod = (typeof LOGIN_METHOD)[keyof typeof LOGIN_METHOD];

export const AUTH_FAILURE_KIND = {
  VALIDATION: "validation",
  INVALID_CREDENTIALS: "invalid_credentials",
  RATE_LIMITED: "rate_limited",
  UNEXPECTED: "unexpected",
} as const;

export type AuthFailure =
  | { kind: typeof AUTH_FAILURE_KIND.VALIDATION; fieldErrors: Record<string, ValidationCode[]> }
  | { kind: typeof AUTH_FAILURE_KIND.INVALID_CREDENTIALS; method: LoginMethod }
  | { kind: typeof AUTH_FAILURE_KIND.RATE_LIMITED; retryAfterMinutes: number }
  | { kind: typeof AUTH_FAILURE_KIND.UNEXPECTED; requestId: string };

export const AUTH_FORM_STATUS = {
  IDLE: "idle",
  ERROR: "error",
} as const;

export type AuthFormState =
  | { status: typeof AUTH_FORM_STATUS.IDLE }
  | { status: typeof AUTH_FORM_STATUS.ERROR; failure: AuthFailure };
