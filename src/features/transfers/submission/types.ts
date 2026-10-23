import type { Money } from "@/domain/money/money";
import type { TransferView } from "@/shared/lib/api/views";

export const TRANSFER_OUTCOME = {
  NETWORK_ERROR: "network_error",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  TIMEOUT: "timeout",
  NOT_FOUND_YET: "not_found_yet",
  UNKNOWN_ERROR: "unknown_error",
} as const;

export type TransferOutcome =
  | { kind: typeof TRANSFER_OUTCOME.NETWORK_ERROR; requestId?: string }
  | { kind: typeof TRANSFER_OUTCOME.INSUFFICIENT_FUNDS; amount: Money; balance?: Money }
  | { kind: typeof TRANSFER_OUTCOME.TIMEOUT; requestId?: string }
  | { kind: typeof TRANSFER_OUTCOME.NOT_FOUND_YET; requestId?: string }
  | { kind: typeof TRANSFER_OUTCOME.UNKNOWN_ERROR; requestId?: string };

export const SUBMISSION_STATUS = {
  IDLE: "idle",
  PROCESSING: "processing",
  CHECKING: "checking",
  FAILED: "failed",
  SUCCEEDED: "succeeded",
} as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];

export type SubmissionState =
  | { status: typeof SUBMISSION_STATUS.IDLE }
  | { status: typeof SUBMISSION_STATUS.PROCESSING }
  | { status: typeof SUBMISSION_STATUS.CHECKING }
  | { status: typeof SUBMISSION_STATUS.FAILED; outcome: TransferOutcome }
  | { status: typeof SUBMISSION_STATUS.SUCCEEDED; transfer: TransferView };
