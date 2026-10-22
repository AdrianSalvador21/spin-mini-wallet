import { describe, expect, it } from "vitest";
import { VALIDATION_CODES } from "@/domain/shared/validation-codes";
import messages from "./errors.json";

describe("errors.json", () => {
  it("has a message for every validation code", () => {
    const missingCodes = VALIDATION_CODES.filter((code) => !(code in messages.errors.validation));

    expect(missingCodes).toEqual([]);
  });
});
