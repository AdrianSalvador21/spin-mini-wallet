import { addMoney, compareMoney, type Money } from "../money/money";
import { err, ok, type Result } from "../shared/result";
import { TRANSFER_FEE } from "./fees";
import type { TransferRecipient } from "./types";

export const TRANSFER_RULE_VIOLATION = {
  AMOUNT_NOT_POSITIVE: "AMOUNT_NOT_POSITIVE",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  RECIPIENT_REQUIRED: "RECIPIENT_REQUIRED",
} as const;

export type TransferRuleViolation = (typeof TRANSFER_RULE_VIOLATION)[keyof typeof TRANSFER_RULE_VIOLATION];

export interface TransferDraft {
  amount: Money;
  recipient: TransferRecipient | null;
}

export interface ValidTransfer {
  amount: Money;
  recipient: TransferRecipient;
}

export function validateTransferAmount(
  amount: Money,
  availableBalance: Money,
  fee: Money = TRANSFER_FEE,
): Result<Money, TransferRuleViolation[]> {
  if (amount.amountInCents <= 0) {
    return err([TRANSFER_RULE_VIOLATION.AMOUNT_NOT_POSITIVE]);
  }

  if (compareMoney(addMoney(amount, fee), availableBalance) > 0) {
    return err([TRANSFER_RULE_VIOLATION.INSUFFICIENT_FUNDS]);
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
    violations.push(TRANSFER_RULE_VIOLATION.RECIPIENT_REQUIRED);
    return err(violations);
  }

  if (violations.length > 0) {
    return err(violations);
  }

  return ok({ amount: draft.amount, recipient: draft.recipient });
}
