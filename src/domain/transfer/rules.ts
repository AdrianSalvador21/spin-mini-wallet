import { compareMoney, type Money } from "../money/money";
import { err, ok, type Result } from "../shared/result";
import type { TransferRecipientInput } from "./types";

export type TransferRuleViolation = "AMOUNT_NOT_POSITIVE" | "INSUFFICIENT_FUNDS" | "RECIPIENT_REQUIRED";

export interface TransferDraft {
  amount: Money;
  recipient: TransferRecipientInput | null;
}

export interface ValidTransfer {
  amount: Money;
  recipient: TransferRecipientInput;
}

export function validateTransfer(
  draft: TransferDraft,
  availableBalance: Money,
): Result<ValidTransfer, TransferRuleViolation[]> {
  const violations: TransferRuleViolation[] = [];

  if (draft.amount.amountInCents <= 0) {
    violations.push("AMOUNT_NOT_POSITIVE");
  } else if (compareMoney(draft.amount, availableBalance) > 0) {
    violations.push("INSUFFICIENT_FUNDS");
  }

  if (draft.recipient === null) {
    violations.push("RECIPIENT_REQUIRED");
    return err(violations);
  }

  if (violations.length > 0) {
    return err(violations);
  }

  return ok({ amount: draft.amount, recipient: draft.recipient });
}
