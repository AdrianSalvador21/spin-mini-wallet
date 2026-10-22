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

export function validateTransferAmount(
  amount: Money,
  availableBalance: Money,
): Result<Money, TransferRuleViolation[]> {
  if (amount.amountInCents <= 0) {
    return err(["AMOUNT_NOT_POSITIVE"]);
  }

  if (compareMoney(amount, availableBalance) > 0) {
    return err(["INSUFFICIENT_FUNDS"]);
  }

  return ok(amount);
}

export function validateTransfer(
  draft: TransferDraft,
  availableBalance: Money,
): Result<ValidTransfer, TransferRuleViolation[]> {
  const amountResult = validateTransferAmount(draft.amount, availableBalance);
  const violations: TransferRuleViolation[] = amountResult.ok ? [] : [...amountResult.error];

  if (draft.recipient === null) {
    violations.push("RECIPIENT_REQUIRED");
    return err(violations);
  }

  if (violations.length > 0) {
    return err(violations);
  }

  return ok({ amount: draft.amount, recipient: draft.recipient });
}
