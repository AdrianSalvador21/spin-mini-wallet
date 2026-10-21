import { describe, expect, it } from "vitest";
import { validateConcept } from "./validators";

describe("validateConcept", () => {
  it("returns undefined for an empty string", () => {
    expect(validateConcept("")).toEqual({ ok: true, value: undefined });
  });

  it("returns undefined for a blank string", () => {
    expect(validateConcept("   ")).toEqual({ ok: true, value: undefined });
  });

  it("accepts letters, digits, spaces and .,-", () => {
    expect(validateConcept("  Renta oct. 2026, piso-3  ")).toEqual({
      ok: true,
      value: "Renta oct. 2026, piso-3",
    });
  });

  it("returns CONCEPT_TOO_LONG above 40 characters", () => {
    expect(validateConcept("a".repeat(41))).toEqual({ ok: false, error: "CONCEPT_TOO_LONG" });
  });

  it("accepts exactly 40 characters", () => {
    const concept = "a".repeat(40);
    expect(validateConcept(concept)).toEqual({ ok: true, value: concept });
  });

  it("returns CONCEPT_INVALID_CHARACTERS for disallowed symbols", () => {
    expect(validateConcept("Pago @renta")).toEqual({ ok: false, error: "CONCEPT_INVALID_CHARACTERS" });
  });
});
