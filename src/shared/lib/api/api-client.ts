import type { Money } from "@/domain/money/money";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import { err, ok, type Result } from "@/domain/shared/result";
import {
  CONTENT_TYPE_HEADER,
  HTTP_METHOD,
  JSON_CONTENT_TYPE,
  REQUEST_ID_HEADER,
  type ApiErrorBody,
  type ApiErrorCode,
} from "./contract";

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

export function getRequestId(error: unknown): string | undefined {
  if (!(error instanceof ApiFailureError)) {
    return undefined;
  }

  return error.failure.kind === API_FAILURE_KIND.NETWORK ? undefined : error.failure.requestId;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "object";
}

export interface ApiRequestInit {
  signal?: AbortSignal;
}

export function apiGet<T>(path: string, init?: ApiRequestInit): Promise<Result<T, ApiFailure>> {
  return request<T>(path, { method: HTTP_METHOD.GET, signal: init?.signal });
}

export async function apiGetOrThrow<T>(path: string, signal?: AbortSignal): Promise<T> {
  const result = await apiGet<T>(path, { signal });

  if (!result.ok) {
    throw new ApiFailureError(result.error);
  }

  return result.value;
}

export function apiPost<T>(path: string, body: unknown, init?: ApiRequestInit): Promise<Result<T, ApiFailure>> {
  return request<T>(path, {
    method: HTTP_METHOD.POST,
    headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE },
    body: JSON.stringify(body),
    signal: init?.signal,
  });
}

async function request<T>(path: string, init: RequestInit): Promise<Result<T, ApiFailure>> {
  let response: Response;

  try {
    response = await fetch(path, { ...init, credentials: "same-origin" });
  } catch {
    return err({ kind: API_FAILURE_KIND.NETWORK });
  }

  return toResult<T>(response);
}

async function toResult<T>(response: Response): Promise<Result<T, ApiFailure>> {
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
