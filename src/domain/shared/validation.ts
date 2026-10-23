import { z } from "zod";
import type { Result } from "./result";
import { isValidationCode, type ValidationCode } from "./validation-codes";

export function fromValidator<T>(validate: (input: string) => Result<T, ValidationCode>) {
  return z.string().transform((value, ctx) => {
    const result = validate(value);

    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }

    return result.value;
  });
}

export function toFieldErrors(error: z.ZodError): Record<string, ValidationCode[]> {
  const fieldErrors: Record<string, ValidationCode[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".");
    const codes = fieldErrors[field] ?? [];
    codes.push(isValidationCode(issue.message) ? issue.message : "INPUT_INVALID");
    fieldErrors[field] = codes;
  }

  return fieldErrors;
}
