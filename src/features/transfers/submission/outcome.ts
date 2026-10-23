import type { Money } from "@/domain/money/money";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { API_FAILURE_KIND, ApiFailureError, type ApiFailure } from "@/shared/lib/api/api-client";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { ERROR_SOURCE, getErrorReporter, type ErrorReporter } from "@/shared/observability/error-reporter";
import { TRANSFER_OUTCOME, type TransferOutcome } from "./types";

type ApiErrorFailure = Extract<ApiFailure, { kind: typeof API_FAILURE_KIND.API }>;

function toApiTransferOutcome(failure: ApiErrorFailure, amount: Money): TransferOutcome {
  switch (failure.code) {
    case API_ERROR_CODE.UPSTREAM_UNAVAILABLE:
      return { kind: TRANSFER_OUTCOME.NETWORK_ERROR, requestId: failure.requestId };
    case API_ERROR_CODE.INSUFFICIENT_FUNDS:
      return { kind: TRANSFER_OUTCOME.INSUFFICIENT_FUNDS, amount, balance: failure.balance };
    case API_ERROR_CODE.INTERNAL_ERROR:
    case API_ERROR_CODE.VALIDATION_ERROR:
    case API_ERROR_CODE.NOT_FOUND:
    case API_ERROR_CODE.IDEMPOTENCY_CONFLICT:
    case API_ERROR_CODE.FORBIDDEN:
    case API_ERROR_CODE.UNAUTHORIZED:
      return { kind: TRANSFER_OUTCOME.UNKNOWN_ERROR, requestId: failure.requestId };
    default:
      return assertUnreachable(failure.code);
  }
}

export function toTransferOutcome(failure: ApiFailure, amount: Money): TransferOutcome {
  switch (failure.kind) {
    case API_FAILURE_KIND.NETWORK:
      return { kind: TRANSFER_OUTCOME.NETWORK_ERROR, requestId: failure.requestId };
    case API_FAILURE_KIND.TIMEOUT:
      return { kind: TRANSFER_OUTCOME.TIMEOUT, requestId: failure.requestId };
    case API_FAILURE_KIND.API:
      return toApiTransferOutcome(failure, amount);
    case API_FAILURE_KIND.UNKNOWN:
      return { kind: TRANSFER_OUTCOME.UNKNOWN_ERROR, requestId: failure.requestId };
    default:
      return assertUnreachable(failure);
  }
}

export function toLookupOutcome(failure: ApiFailure): TransferOutcome {
  switch (failure.kind) {
    case API_FAILURE_KIND.API:
    case API_FAILURE_KIND.NETWORK:
    case API_FAILURE_KIND.TIMEOUT:
    case API_FAILURE_KIND.UNKNOWN:
      return { kind: TRANSFER_OUTCOME.NOT_FOUND_YET, requestId: failure.requestId };
    default:
      return assertUnreachable(failure);
  }
}

export function reportTransferOutcome(
  outcome: TransferOutcome,
  failure: ApiFailure,
  reporter: ErrorReporter = getErrorReporter(),
): void {
  if (outcome.kind !== TRANSFER_OUTCOME.UNKNOWN_ERROR) {
    return;
  }

  reporter.captureException(new ApiFailureError(failure), {
    source: ERROR_SOURCE.BROWSER,
    requestId: outcome.requestId,
    code: failure.kind === API_FAILURE_KIND.API ? failure.code : failure.kind,
  });
}
