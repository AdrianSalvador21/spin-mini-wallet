import { err, ok, type Result } from "../shared/result";
import type { ValidationCode } from "../shared/validation-codes";

const CONCEPT_MAX_LENGTH = 40;
const CONCEPT_CHARACTERS_PATTERN = /^[\p{L}\p{N}\s.,-]+$/u;

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
