import type { Cents } from "@/domain/money/money";

export const QUICK_AMOUNTS_IN_CENTS: readonly Cents[] = [10_000 as Cents, 20_000 as Cents, 50_000 as Cents];

export const CONCEPT_MAX_LENGTH = 40;

export const AMOUNT_STEP_ERROR = {
  BALANCE_REQUIRED: "BALANCE_REQUIRED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
} as const;
