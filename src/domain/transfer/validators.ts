import { err, ok, type Result } from "../shared/result";
import type { ValidationCode } from "../shared/validation-codes";

const CONCEPT_MAX_LENGTH = 40;
const CONCEPT_CHARACTERS_PATTERN = /^[\p{L}\p{N}\s.,-]+$/u;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateConcept(input: string): Result<string | undefined, ValidationCode> {
  const trimmed = input.trim();

  if (trimmed === "") {
    return ok(undefined);
  }

  if (trimmed.length > CONCEPT_MAX_LENGTH) {
    return err("CONCEPT_TOO_LONG");
  }

  if (!CONCEPT_CHARACTERS_PATTERN.test(trimmed)) {
    return err("CONCEPT_INVALID_CHARACTERS");
  }

  return ok(trimmed);
}

export function validateIdempotencyKey(input: string): Result<string, ValidationCode> {
  const trimmed = input.trim();

  if (trimmed === "") {
    return err("IDEMPOTENCY_KEY_REQUIRED");
  }

  if (!UUID_V4_PATTERN.test(trimmed)) {
    return err("IDEMPOTENCY_KEY_INVALID");
  }

  return ok(trimmed);
}
