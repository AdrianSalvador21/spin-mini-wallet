import { assertUnreachable } from "../shared/assert-unreachable";
import { err, ok, type Result } from "../shared/result";
import type { ValidationCode } from "../shared/validation-codes";
import { validatePhone } from "../user/validators";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "./types";

const CLABE_PATTERN = /^\d{18}$/;
const CLABE_WEIGHTS = [3, 7, 1];
const CARD_PATTERN = /^\d{16}$/;

function computeClabeCheckDigit(first17Digits: string): number {
  let sum = 0;

  for (let i = 0; i < first17Digits.length; i++) {
    const digit = Number(first17Digits[i]);
    sum += (digit * CLABE_WEIGHTS[i % 3]) % 10;
  }

  return (10 - (sum % 10)) % 10;
}

export function validateClabe(input: string): Result<string, ValidationCode> {
  if (input.trim() === "") {
    return err("CLABE_REQUIRED");
  }

  const stripped = input.replace(/[\s-]/g, "");

  if (!CLABE_PATTERN.test(stripped)) {
    return err("CLABE_INVALID_LENGTH");
  }

  const expectedCheckDigit = computeClabeCheckDigit(stripped.slice(0, 17));
  const actualCheckDigit = Number(stripped[17]);

  if (expectedCheckDigit !== actualCheckDigit) {
    return err("CLABE_INVALID_CHECK_DIGIT");
  }

  return ok(stripped);
}

function isLuhnValid(digits: string): boolean {
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);

    if (i % 2 === 1) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum % 10 === 0;
}

export function validateCardNumber(input: string): Result<string, ValidationCode> {
  if (input.trim() === "") {
    return err("CARD_REQUIRED");
  }

  const stripped = input.replace(/[\s-]/g, "");

  if (!CARD_PATTERN.test(stripped)) {
    return err("CARD_INVALID_LENGTH");
  }

  if (!isLuhnValid(stripped)) {
    return err("CARD_INVALID_CHECKSUM");
  }

  return ok(stripped);
}

export function validateRecipientAccount(
  account: RecipientAccount,
): Result<RecipientAccount, ValidationCode> {
  switch (account.type) {
    case RECIPIENT_ACCOUNT_TYPE.PHONE: {
      const result = validatePhone(account.phone);
      return result.ok
        ? ok({ type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: result.value })
        : err(result.error);
    }
    case RECIPIENT_ACCOUNT_TYPE.CLABE: {
      const result = validateClabe(account.clabe);
      return result.ok
        ? ok({ type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: result.value })
        : err(result.error);
    }
    case RECIPIENT_ACCOUNT_TYPE.CARD: {
      const result = validateCardNumber(account.cardNumber);
      return result.ok
        ? ok({ type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: result.value })
        : err(result.error);
    }
    default:
      return assertUnreachable(account);
  }
}
