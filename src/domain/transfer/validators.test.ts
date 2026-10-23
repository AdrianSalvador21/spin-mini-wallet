import { describe, expect, it } from "vitest";
import { validateConcept, validateIdempotencyKey } from "./validators";

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

describe("validateIdempotencyKey", () => {
  it("returns IDEMPOTENCY_KEY_REQUIRED for an empty string", () => {
    expect(validateIdempotencyKey("")).toEqual({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" });
  });

  it("returns IDEMPOTENCY_KEY_REQUIRED for a blank string", () => {
    expect(validateIdempotencyKey("   ")).toEqual({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" });
  });

  it("returns IDEMPOTENCY_KEY_INVALID for a non-UUID string", () => {
    expect(validateIdempotencyKey("not-a-uuid")).toEqual({
      ok: false,
      error: "IDEMPOTENCY_KEY_INVALID",
    });
  });

  it("returns IDEMPOTENCY_KEY_INVALID for a UUID v1", () => {
    expect(validateIdempotencyKey("a9f1c2e0-b123-11ee-8c99-0242ac120002")).toEqual({
      ok: false,
      error: "IDEMPOTENCY_KEY_INVALID",
    });
  });

  it("accepts a valid UUID v4", () => {
    expect(validateIdempotencyKey("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")).toEqual({
      ok: true,
      value: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });
  });
});
