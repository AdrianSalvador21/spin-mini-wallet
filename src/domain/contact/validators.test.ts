import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "./types";
import { validateCardNumber, validateClabe, validateRecipientAccount } from "./validators";

const VALID_CLABE_KNOWN_BANK = "002123456789012343";
const VALID_CLABE_UNKNOWN_BANK = "999123456789012346";

describe("validateClabe", () => {
  it("accepts a CLABE with a correct check digit", () => {
    expect(validateClabe(VALID_CLABE_KNOWN_BANK)).toEqual({ ok: true, value: VALID_CLABE_KNOWN_BANK });
  });

  it("accepts a valid CLABE whose bank code is outside the catalog", () => {
    expect(validateClabe(VALID_CLABE_UNKNOWN_BANK)).toEqual({ ok: true, value: VALID_CLABE_UNKNOWN_BANK });
  });

  it("strips spaces and hyphens before validating", () => {
    expect(validateClabe("0021-2345 6789-0123 43")).toEqual({ ok: true, value: VALID_CLABE_KNOWN_BANK });
  });

  it("returns CLABE_REQUIRED for an empty string", () => {
    expect(validateClabe("")).toEqual({ ok: false, error: "CLABE_REQUIRED" });
  });

  it("returns CLABE_INVALID_LENGTH for fewer than 18 digits", () => {
    expect(validateClabe("00212345")).toEqual({ ok: false, error: "CLABE_INVALID_LENGTH" });
  });

  it("returns CLABE_INVALID_LENGTH for non-digit characters", () => {
    expect(validateClabe("00212345678901234A")).toEqual({ ok: false, error: "CLABE_INVALID_LENGTH" });
  });

  it("returns CLABE_INVALID_CHECK_DIGIT for an altered check digit", () => {
    const tampered = `${VALID_CLABE_KNOWN_BANK.slice(0, 17)}9`;
    expect(validateClabe(tampered)).toEqual({ ok: false, error: "CLABE_INVALID_CHECK_DIGIT" });
  });
});

describe("validateCardNumber", () => {
  it("accepts a valid Luhn card number", () => {
    expect(validateCardNumber("4111 1111 1111 1111")).toEqual({ ok: true, value: "4111111111111111" });
  });

  it("accepts a valid Luhn card number whose doubled digits carry over", () => {
    expect(validateCardNumber("5500 0055 5555 5559")).toEqual({ ok: true, value: "5500005555555559" });
  });

  it("returns CARD_REQUIRED for an empty string", () => {
    expect(validateCardNumber("")).toEqual({ ok: false, error: "CARD_REQUIRED" });
  });

  it("returns CARD_INVALID_LENGTH for fewer than 16 digits", () => {
    expect(validateCardNumber("4111 1111 1111")).toEqual({ ok: false, error: "CARD_INVALID_LENGTH" });
  });

  it("returns CARD_INVALID_CHECKSUM for a failing Luhn checksum", () => {
    expect(validateCardNumber("4111 1111 1111 1112")).toEqual({ ok: false, error: "CARD_INVALID_CHECKSUM" });
  });
});

describe("validateRecipientAccount", () => {
  it("delegates to validatePhone for a phone account", () => {
    expect(validateRecipientAccount({ type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" })).toEqual({
      ok: true,
      value: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" },
    });
  });

  it("propagates the phone validator's error code", () => {
    expect(validateRecipientAccount({ type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "" })).toEqual({
      ok: false,
      error: "PHONE_REQUIRED",
    });
  });

  it("delegates to validateClabe for a clabe account", () => {
    expect(
      validateRecipientAccount({ type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: VALID_CLABE_KNOWN_BANK }),
    ).toEqual({
      ok: true,
      value: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: VALID_CLABE_KNOWN_BANK },
    });
  });

  it("propagates the clabe validator's error code", () => {
    expect(validateRecipientAccount({ type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: "" })).toEqual({
      ok: false,
      error: "CLABE_REQUIRED",
    });
  });

  it("delegates to validateCardNumber for a card account", () => {
    expect(
      validateRecipientAccount({ type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: "4111111111111111" }),
    ).toEqual({
      ok: true,
      value: { type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: "4111111111111111" },
    });
  });

  it("propagates the card validator's error code", () => {
    expect(validateRecipientAccount({ type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: "" })).toEqual({
      ok: false,
      error: "CARD_REQUIRED",
    });
  });

  it("throws for an account type outside the union", () => {
    const invalid = { type: "unknown" } as unknown as RecipientAccount;
    expect(() => validateRecipientAccount(invalid)).toThrow();
  });
});
