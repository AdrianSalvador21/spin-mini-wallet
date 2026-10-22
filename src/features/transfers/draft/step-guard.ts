import type { Route } from "next";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { ROUTES } from "@/shared/lib/routes";
import { TRANSFER_STEP, TRANSFER_STEP_ORDER, type TransferDraftState, type TransferStep } from "./types";

export const TRANSFER_STEP_ROUTE = {
  [TRANSFER_STEP.AMOUNT]: ROUTES.TRANSFER_AMOUNT,
  [TRANSFER_STEP.RECIPIENT]: ROUTES.TRANSFER_RECIPIENT,
  [TRANSFER_STEP.REVIEW]: ROUTES.TRANSFER_REVIEW,
} as const satisfies Record<TransferStep, Route>;

export function stepFromPathname(pathname: string): TransferStep {
  const match = TRANSFER_STEP_ORDER.find((step) => pathname.startsWith(TRANSFER_STEP_ROUTE[step]));

  return match ?? TRANSFER_STEP.AMOUNT;
}

export function previousStepRoute(step: TransferStep): Route {
  switch (step) {
    case TRANSFER_STEP.AMOUNT:
      return ROUTES.HOME;
    case TRANSFER_STEP.RECIPIENT:
      return TRANSFER_STEP_ROUTE[TRANSFER_STEP.AMOUNT];
    case TRANSFER_STEP.REVIEW:
      return TRANSFER_STEP_ROUTE[TRANSFER_STEP.RECIPIENT];
    default:
      return assertUnreachable(step);
  }
}

export function resolveStepAccess(step: TransferStep, draft: TransferDraftState): TransferStep {
  switch (step) {
    case TRANSFER_STEP.AMOUNT:
      return TRANSFER_STEP.AMOUNT;
    case TRANSFER_STEP.RECIPIENT:
      return draft.amountInCents === null ? TRANSFER_STEP.AMOUNT : TRANSFER_STEP.RECIPIENT;
    case TRANSFER_STEP.REVIEW:
      if (draft.amountInCents === null) {
        return TRANSFER_STEP.AMOUNT;
      }

      return draft.recipient === null ? TRANSFER_STEP.RECIPIENT : TRANSFER_STEP.REVIEW;
    default:
      return assertUnreachable(step);
  }
}
