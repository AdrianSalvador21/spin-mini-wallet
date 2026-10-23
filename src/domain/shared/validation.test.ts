import { z } from "zod";
import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "./result";
import { fromValidator, toFieldErrors } from "./validation";
import type { ValidationCode } from "./validation-codes";

function validateUppercase(input: string): Result<string, ValidationCode> {
  return input === input.toUpperCase() ? ok(input) : err("NAME_INVALID_CHARACTERS");
}

describe("fromValidator", () => {
  it("outputs the validator's normalized value on success", () => {
    const schema = fromValidator(validateUppercase);
    expect(schema.parse("ABC")).toBe("ABC");
  });

  it("reports the validator's error code as the issue message", () => {
    const schema = fromValidator(validateUppercase);
    const result = schema.safeParse("abc");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("NAME_INVALID_CHARACTERS");
  });
});

describe("toFieldErrors", () => {
  it("groups validation codes by field path", () => {
    const schema = z.object({
      name: fromValidator(validateUppercase),
    });

    const result = schema.safeParse({ name: "abc" });
    expect(result.success).toBe(false);

    const fieldErrors = toFieldErrors(result.error!);
    expect(fieldErrors).toEqual({ name: ["NAME_INVALID_CHARACTERS"] });
  });

  it("maps Zod's own messages, which are not validation codes, to INPUT_INVALID", () => {
    const schema = z.object({ amountInCents: z.number(), recipient: z.object({ contactId: z.string() }) });

    const result = schema.safeParse({ amountInCents: "10", recipient: {} });

    expect(result.success).toBe(false);
    expect(toFieldErrors(result.error!)).toEqual({
      amountInCents: ["INPUT_INVALID"],
      "recipient.contactId": ["INPUT_INVALID"],
    });
  });

  it("groups multiple issues for the same field", () => {
    const error = new z.ZodError([
      { code: "custom", message: "AMOUNT_REQUIRED", path: ["amount"], input: "" },
      { code: "custom", message: "AMOUNT_INVALID_FORMAT", path: ["amount"], input: "" },
    ]);

    expect(toFieldErrors(error)).toEqual({
      amount: ["AMOUNT_REQUIRED", "AMOUNT_INVALID_FORMAT"],
    });
  });
});
