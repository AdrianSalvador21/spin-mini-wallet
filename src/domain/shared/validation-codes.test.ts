import { describe, expect, it } from "vitest";
import { isValidationCode } from "./validation-codes";

describe("isValidationCode", () => {
  it("accepts a known validation code", () => {
    expect(isValidationCode("AMOUNT_NOT_POSITIVE")).toBe(true);
  });

  it("rejects any other string, such as Zod's own message", () => {
    expect(isValidationCode("Invalid input: expected number, received string")).toBe(false);
  });
});
