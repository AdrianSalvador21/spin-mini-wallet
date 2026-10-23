import type { Money } from "@/domain/money/money";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import { err, ok, type Result } from "@/domain/shared/result";
import {
  CONTENT_TYPE_HEADER,
  HTTP_METHOD,
  IDEMPOTENCY_KEY_HEADER,
  JSON_CONTENT_TYPE,
  REQUEST_ID_HEADER,
  type ApiErrorBody,
  type ApiErrorCode,
} from "./contract";

export const API_FAILURE_KIND = {
  API: "api",
  NETWORK: "network",
  TIMEOUT: "timeout",
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
  | { kind: typeof API_FAILURE_KIND.NETWORK; requestId?: string }
  | { kind: typeof API_FAILURE_KIND.TIMEOUT; requestId?: string }
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

  return error.failure.requestId;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "object";
}

export interface ApiRequestInit {
  signal?: AbortSignal;
  timeoutMs?: number;
  requestId?: string;
  idempotencyKey?: string;
}

export function apiGet<T>(path: string, init?: ApiRequestInit): Promise<Result<T, ApiFailure>> {
  return request<T>(path, { method: HTTP_METHOD.GET }, init);
}

export async function apiGetOrThrow<T>(path: string, signal?: AbortSignal): Promise<T> {
  const result = await apiGet<T>(path, { signal });

  if (!result.ok) {
    throw new ApiFailureError(result.error);
  }

  return result.value;
}

export function apiPost<T>(path: string, body: unknown, init?: ApiRequestInit): Promise<Result<T, ApiFailure>> {
  return request<T>(
    path,
    { method: HTTP_METHOD.POST, headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE }, body: JSON.stringify(body) },
    init,
  );
}

interface RequestAbort {
  signal?: AbortSignal;
  timedOut: () => boolean;
  clear: () => void;
}

function createRequestAbort(signal: AbortSignal | undefined, timeoutMs: number | undefined): RequestAbort {
  if (timeoutMs === undefined) {
    return { signal, timedOut: () => false, clear: () => undefined };
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

interface BaseRequest {
  method: (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];
  headers?: Record<string, string>;
  body?: string;
}

function requestHeaders(base: Record<string, string> | undefined, init: ApiRequestInit): Record<string, string> {
  return {
    ...base,
    ...(init.requestId === undefined ? {} : { [REQUEST_ID_HEADER]: init.requestId }),
    ...(init.idempotencyKey === undefined ? {} : { [IDEMPOTENCY_KEY_HEADER]: init.idempotencyKey }),
  };
}

async function request<T>(path: string, base: BaseRequest, init: ApiRequestInit = {}): Promise<Result<T, ApiFailure>> {
  const abort = createRequestAbort(init.signal, init.timeoutMs);
  let response: Response;

  try {
    response = await fetch(path, {
      ...base,
      headers: requestHeaders(base.headers, init),
      signal: abort.signal,
      credentials: "same-origin",
    });
  } catch {
    const kind = abort.timedOut() ? API_FAILURE_KIND.TIMEOUT : API_FAILURE_KIND.NETWORK;

    return err(init.requestId === undefined ? { kind } : { kind, requestId: init.requestId });
  } finally {
    abort.clear();
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
