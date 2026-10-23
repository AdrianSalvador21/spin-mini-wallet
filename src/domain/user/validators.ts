import { err, ok, type Result } from "../shared/result";
import type { ValidationCode } from "../shared/validation-codes";

const PHONE_CHARACTERS_PATTERN = /^\+?\d+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_CHARACTERS_PATTERN = /^[\p{L}\s'.-]+$/u;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 60;

export function validatePhone(input: string): Result<string, ValidationCode> {
  if (input.trim() === "") {
    return err("PHONE_REQUIRED");
  }

  const stripped = input.replace(/[\s\-.()]/g, "");

  if (!PHONE_CHARACTERS_PATTERN.test(stripped)) {
    return err("PHONE_INVALID_CHARACTERS");
  }

  let digits = stripped.startsWith("+") ? stripped.slice(1) : stripped;

  if (digits.length === 12 && digits.startsWith("52")) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10) {
    return err("PHONE_INVALID_LENGTH");
  }

  return ok(digits);
}

export function validateEmail(input: string): Result<string, ValidationCode> {
  const trimmed = input.trim();

  if (trimmed === "") {
    return err("EMAIL_REQUIRED");
  }

  const normalized = trimmed.toLowerCase();

  if (normalized.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
    return err("EMAIL_INVALID_FORMAT");
  }

  return ok(normalized);
}

export function validatePassword(input: string): Result<string, ValidationCode> {
  if (input.length === 0) {
    return err("PASSWORD_REQUIRED");
  }

  if (input.length < PASSWORD_MIN_LENGTH) {
    return err("PASSWORD_TOO_SHORT");
  }

  if (input.length > PASSWORD_MAX_LENGTH) {
    return err("PASSWORD_TOO_LONG");
  }

  if (!/[A-Z]/.test(input)) {
    return err("PASSWORD_MISSING_UPPERCASE");
  }

  if (!/[0-9]/.test(input)) {
    return err("PASSWORD_MISSING_NUMBER");
  }

  return ok(input);
}

export function validateFullName(input: string): Result<string, ValidationCode> {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (normalized === "") {
    return err("NAME_REQUIRED");
  }

  if (!NAME_CHARACTERS_PATTERN.test(normalized)) {
    return err("NAME_INVALID_CHARACTERS");
  }

  if (normalized.length < NAME_MIN_LENGTH) {
    return err("NAME_TOO_SHORT");
  }

  if (normalized.length > NAME_MAX_LENGTH) {
    return err("NAME_TOO_LONG");
  }

  return ok(normalized);
}
