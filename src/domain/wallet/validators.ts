import { err, ok, type Result } from "../shared/result";
import type { ValidationCode } from "../shared/validation-codes";
import { MOVEMENT_DIRECTION, type MovementDirection } from "./types";

export function validateMovementDirection(input: string): Result<MovementDirection, ValidationCode> {
  if (input === MOVEMENT_DIRECTION.DEBIT || input === MOVEMENT_DIRECTION.CREDIT) {
    return ok(input);
  }

  return err("DIRECTION_INVALID");
}
