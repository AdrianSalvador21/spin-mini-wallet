import { describe, expect, it } from "vitest";
import { redact } from "./redact";

describe("redact", () => {
  it("replaces sensitive keys at the top level", () => {
    expect(redact({ password: "secret", amount: 100 })).toEqual({
      password: "[REDACTED]",
      amount: 100,
    });
  });

  it("replaces sensitive keys nested inside objects and arrays", () => {
    const result = redact({
      user: { Email: "a@b.mx", items: [{ cardNumber: "4111111111111111" }] },
    });

    expect(JSON.stringify(result)).not.toContain("a@b.mx");
    expect(JSON.stringify(result)).not.toContain("4111111111111111");
  });

  it("matches keys case-insensitively", () => {
    expect(redact({ PASSWORDHASH: "hash", Phone: "5512345678", CLABE: "x" })).toEqual({
      PASSWORDHASH: "[REDACTED]",
      Phone: "[REDACTED]",
      CLABE: "[REDACTED]",
    });
  });

  it("leaves non-sensitive values untouched", () => {
    expect(redact({ requestId: "abc", count: 3, flag: true, nothing: null })).toEqual({
      requestId: "abc",
      count: 3,
      flag: true,
      nothing: null,
    });
  });

  it("handles cyclic objects without looping forever", () => {
    const value: Record<string, unknown> = { name: "a" };
    value.self = value;

    expect(redact(value)).toEqual({ name: "a", self: "[CIRCULAR]" });
  });

  it("does not flag the same non-cyclic reference shared by siblings as circular", () => {
    const shared = { email: "a@b.mx" };

    expect(redact({ first: shared, second: shared })).toEqual({
      first: { email: "[REDACTED]" },
      second: { email: "[REDACTED]" },
    });
  });

  it("returns primitives unchanged", () => {
    expect(redact("hello")).toBe("hello");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });
});
