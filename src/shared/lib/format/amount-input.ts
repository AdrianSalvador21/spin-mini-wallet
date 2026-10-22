import { MAX_AMOUNT_IN_CENTS, type Cents } from "@/domain/money/money";

const MAX_INTEGER_DIGITS = String(Math.floor(MAX_AMOUNT_IN_CENTS / 100)).length;
const AMOUNT_INPUT_PATTERN = new RegExp(`^\\d{0,${MAX_INTEGER_DIGITS}}(\\.\\d{0,2})?$`);
const THOUSANDS_PATTERN = /\B(?=(\d{3})+(?!\d))/g;
const DECIMAL_SEPARATOR = ".";

export function sanitizeAmountInput(raw: string): string | null {
  const stripped = raw.replace(/,/g, "").replace(/^0+(?=\d)/, "");

  return AMOUNT_INPUT_PATTERN.test(stripped) ? stripped : null;
}

export function formatAmountInput(raw: string): string {
  const stripped = raw.replace(/,/g, "");
  const separatorIndex = stripped.indexOf(DECIMAL_SEPARATOR);
  const integerPart = separatorIndex === -1 ? stripped : stripped.slice(0, separatorIndex);
  const decimalPart = separatorIndex === -1 ? "" : stripped.slice(separatorIndex);
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");

  return `${normalizedInteger.replace(THOUSANDS_PATTERN, ",")}${decimalPart}`;
}

export function amountInputFromCents(amountInCents: Cents): string {
  const whole = Math.floor(amountInCents / 100);
  const cents = String(amountInCents % 100).padStart(2, "0");

  return formatAmountInput(`${whole}${DECIMAL_SEPARATOR}${cents}`);
}
