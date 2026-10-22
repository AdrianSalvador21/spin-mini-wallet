import type { Route } from "next";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { ROUTES } from "@/shared/lib/routes";
import { TRANSFER_STEP, type TransferDraftState, type TransferStep } from "./types";

export const TRANSFER_STEP_ROUTE: Record<TransferStep, Route> = {
  [TRANSFER_STEP.AMOUNT]: ROUTES.TRANSFER_AMOUNT as Route,
  [TRANSFER_STEP.RECIPIENT]: ROUTES.TRANSFER_RECIPIENT as Route,
  [TRANSFER_STEP.REVIEW]: ROUTES.TRANSFER_REVIEW as Route,
};

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
