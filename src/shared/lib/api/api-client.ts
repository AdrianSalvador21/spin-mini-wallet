import type { Money } from "@/domain/money/money";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import { err, ok, type Result } from "@/domain/shared/result";
import { REQUEST_ID_HEADER, type ApiErrorBody, type ApiErrorCode } from "./contract";

export const API_FAILURE_KIND = {
  API: "api",
  NETWORK: "network",
  UNKNOWN: "unknown",
} as const;

export type ApiFailure =
  | {
      kind: typeof API_FAILURE_KIND.API;
      status: number;
      code: ApiErrorCode;
      requestId: string;
      details?: Record<string, ValidationCode[]>;
      balance?: Money;
    }
  | { kind: typeof API_FAILURE_KIND.NETWORK }
  | { kind: typeof API_FAILURE_KIND.UNKNOWN; status?: number; requestId?: string };

export class ApiFailureError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(`ApiFailureError: ${failure.kind}`);
    this.failure = failure;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "object";
}

export async function apiGet<T>(path: string, init?: { signal?: AbortSignal }): Promise<Result<T, ApiFailure>> {
  let response: Response;

  try {
    response = await fetch(path, { signal: init?.signal, credentials: "same-origin" });
  } catch {
    return err({ kind: API_FAILURE_KIND.NETWORK });
  }

  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

  if (response.ok) {
    return ok((await response.json()) as T);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return err({ kind: API_FAILURE_KIND.UNKNOWN, status: response.status, requestId });
  }

  if (!isApiErrorBody(body)) {
    return err({ kind: API_FAILURE_KIND.UNKNOWN, status: response.status, requestId });
  }

  return err({
    kind: API_FAILURE_KIND.API,
    status: response.status,
    code: body.error.code,
    requestId: body.error.requestId,
    details: body.error.details,
    balance: body.error.balance,
  });
}
