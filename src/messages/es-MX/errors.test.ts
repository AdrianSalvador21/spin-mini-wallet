import { describe, expect, it } from "vitest";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { VALIDATION_CODES } from "@/domain/shared/validation-codes";
import messages from "./errors.json";

describe("errors.json", () => {
  it("has a message for every validation code", () => {
    const missingCodes = VALIDATION_CODES.filter((code) => !(code in messages.errors.validation));

    expect(missingCodes).toEqual([]);
  });

  it("has a message for every API error code", () => {
    const missingCodes = Object.values(API_ERROR_CODE).filter(
      (code) => !(code in messages.errors.api),
    );

    expect(missingCodes).toEqual([]);
  });
});
