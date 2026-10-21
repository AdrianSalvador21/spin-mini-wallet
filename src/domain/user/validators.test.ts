import { describe, expect, it } from "vitest";
import { validateEmail, validateFullName, validatePassword, validatePhone } from "./validators";

describe("validatePhone", () => {
  it("normalizes a phone number with the +52 prefix and formatting characters", () => {
    expect(validatePhone("+52 (55) 1234-5678")).toEqual({ ok: true, value: "5512345678" });
  });

  it("normalizes a phone number with a bare 52 prefix", () => {
    expect(validatePhone("525512345678")).toEqual({ ok: true, value: "5512345678" });
  });

  it("accepts a 10-digit phone number with no prefix", () => {
    expect(validatePhone("5512345678")).toEqual({ ok: true, value: "5512345678" });
  });

  it("returns PHONE_REQUIRED for an empty string", () => {
    expect(validatePhone("")).toEqual({ ok: false, error: "PHONE_REQUIRED" });
  });

  it("returns PHONE_REQUIRED for a blank string", () => {
    expect(validatePhone("   ")).toEqual({ ok: false, error: "PHONE_REQUIRED" });
  });

  it("returns PHONE_INVALID_CHARACTERS for letters", () => {
    expect(validatePhone("55-ABCD-5678")).toEqual({ ok: false, error: "PHONE_INVALID_CHARACTERS" });
  });

  it("returns PHONE_INVALID_LENGTH for a short number", () => {
    expect(validatePhone("55 1234 567")).toEqual({ ok: false, error: "PHONE_INVALID_LENGTH" });
  });

  it("returns PHONE_INVALID_LENGTH for a 12-digit number that does not start with 52", () => {
    expect(validatePhone("551234567890")).toEqual({ ok: false, error: "PHONE_INVALID_LENGTH" });
  });
});

describe("validateEmail", () => {
  it("trims and lowercases the address", () => {
    expect(validateEmail("  Mariana@Spin.TEST ")).toEqual({ ok: true, value: "mariana@spin.test" });
  });

  it("returns EMAIL_REQUIRED for an empty string", () => {
    expect(validateEmail("")).toEqual({ ok: false, error: "EMAIL_REQUIRED" });
  });

  it("returns EMAIL_REQUIRED for a blank string", () => {
    expect(validateEmail("   ")).toEqual({ ok: false, error: "EMAIL_REQUIRED" });
  });

  it("returns EMAIL_INVALID_FORMAT when the @ is missing", () => {
    expect(validateEmail("mariana.spin.test")).toEqual({ ok: false, error: "EMAIL_INVALID_FORMAT" });
  });

  it("returns EMAIL_INVALID_FORMAT when the domain has no dot", () => {
    expect(validateEmail("mariana@spintest")).toEqual({ ok: false, error: "EMAIL_INVALID_FORMAT" });
  });

  it("returns EMAIL_INVALID_FORMAT above the maximum length", () => {
    const localPart = "a".repeat(250);
    expect(validateEmail(`${localPart}@a.co`)).toEqual({ ok: false, error: "EMAIL_INVALID_FORMAT" });
  });
});

describe("validatePassword", () => {
  it("accepts a password meeting the policy", () => {
    expect(validatePassword("Spin2026")).toEqual({ ok: true, value: "Spin2026" });
  });

  it("returns PASSWORD_REQUIRED for an empty string", () => {
    expect(validatePassword("")).toEqual({ ok: false, error: "PASSWORD_REQUIRED" });
  });

  it("returns PASSWORD_TOO_SHORT below 8 characters", () => {
    expect(validatePassword("Spin20")).toEqual({ ok: false, error: "PASSWORD_TOO_SHORT" });
  });

  it("returns PASSWORD_TOO_LONG above 128 characters", () => {
    expect(validatePassword(`Spin2026${"a".repeat(121)}`)).toEqual({ ok: false, error: "PASSWORD_TOO_LONG" });
  });

  it("returns PASSWORD_MISSING_UPPERCASE without an uppercase letter", () => {
    expect(validatePassword("spin2026")).toEqual({ ok: false, error: "PASSWORD_MISSING_UPPERCASE" });
  });

  it("returns PASSWORD_MISSING_NUMBER without a digit", () => {
    expect(validatePassword("SpinMiniWallet")).toEqual({ ok: false, error: "PASSWORD_MISSING_NUMBER" });
  });
});

describe("validateFullName", () => {
  it("trims and collapses inner spaces", () => {
    expect(validateFullName("  Mariana   Pérez  ")).toEqual({ ok: true, value: "Mariana Pérez" });
  });

  it("accepts apostrophes, hyphens and periods", () => {
    expect(validateFullName("Ana O'Donnell-Ruiz Jr.")).toEqual({
      ok: true,
      value: "Ana O'Donnell-Ruiz Jr.",
    });
  });

  it("returns NAME_REQUIRED for an empty string", () => {
    expect(validateFullName("")).toEqual({ ok: false, error: "NAME_REQUIRED" });
  });

  it("returns NAME_REQUIRED for a blank string", () => {
    expect(validateFullName("   ")).toEqual({ ok: false, error: "NAME_REQUIRED" });
  });

  it("returns NAME_INVALID_CHARACTERS for digits", () => {
    expect(validateFullName("Mariana123")).toEqual({ ok: false, error: "NAME_INVALID_CHARACTERS" });
  });

  it("returns NAME_TOO_SHORT below 3 characters", () => {
    expect(validateFullName("Al")).toEqual({ ok: false, error: "NAME_TOO_SHORT" });
  });

  it("returns NAME_TOO_LONG above 60 characters", () => {
    expect(validateFullName("a".repeat(61))).toEqual({ ok: false, error: "NAME_TOO_LONG" });
  });
});
