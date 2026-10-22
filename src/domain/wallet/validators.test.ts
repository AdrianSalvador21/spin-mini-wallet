import { describe, expect, it } from "vitest";
import { validateMovementDirection } from "./validators";

describe("validateMovementDirection", () => {
  it("accepts debit", () => {
    const result = validateMovementDirection("debit");
    expect(result).toEqual({ ok: true, value: "debit" });
  });

  it("accepts credit", () => {
    const result = validateMovementDirection("credit");
    expect(result).toEqual({ ok: true, value: "credit" });
  });

  it("rejects any other value", () => {
    const result = validateMovementDirection("x");
    expect(result).toEqual({ ok: false, error: "DIRECTION_INVALID" });
  });
});
