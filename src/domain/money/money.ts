import type { Brand } from "../shared/brand";
import { err, ok, type Result } from "../shared/result";

export type Cents = Brand<number, "Cents">;

export interface Money {
  amountInCents: Cents;
  currency: "MXN";
}

export const MAX_AMOUNT_IN_CENTS = 99_999_999;

export type AmountParseCode =
  | "AMOUNT_REQUIRED"
  | "AMOUNT_INVALID_FORMAT"
  | "AMOUNT_TOO_MANY_DECIMALS"
  | "AMOUNT_EXCEEDS_MAXIMUM";

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export function parseAmount(input: string): Result<Cents, AmountParseCode> {
  const stripped = input.replace(/\s/g, "").replace(/^\$/, "").replace(/,/g, "");

  if (stripped === "") {
    return err("AMOUNT_REQUIRED");
  }

  if (!AMOUNT_PATTERN.test(stripped)) {
    return err("AMOUNT_INVALID_FORMAT");
  }

  const [integerPart, decimalPart = ""] = stripped.split(".");

  if (decimalPart.length > 2) {
    return err("AMOUNT_TOO_MANY_DECIMALS");
  }

  const paddedDecimal = decimalPart.padEnd(2, "0");
  const amountInCents = Number(integerPart) * 100 + Number(paddedDecimal);

  if (amountInCents > MAX_AMOUNT_IN_CENTS) {
    return err("AMOUNT_EXCEEDS_MAXIMUM");
  }

  return ok(amountInCents as Cents);
}

export function validateAmountInCents(value: number): Result<Cents, AmountParseCode> {
  if (!Number.isInteger(value)) {
    return err("AMOUNT_INVALID_FORMAT");
  }

  if (value > MAX_AMOUNT_IN_CENTS) {
    return err("AMOUNT_EXCEEDS_MAXIMUM");
  }

  return ok(value as Cents);
}

export function toMoney(amountInCents: Cents): Money {
  return { amountInCents, currency: "MXN" };
}

export function addMoney(a: Money, b: Money): Money {
  return toMoney((a.amountInCents + b.amountInCents) as Cents);
}

export function subtractMoney(a: Money, b: Money): Money {
  return toMoney((a.amountInCents - b.amountInCents) as Cents);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  if (a.amountInCents < b.amountInCents) {
    return -1;
  }

  if (a.amountInCents > b.amountInCents) {
    return 1;
  }

  return 0;
}
