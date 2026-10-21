import { describe, expect, it } from "vitest";
import { err, ok } from "./result";

describe("ok", () => {
  it("returns a successful result with the given value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });
});

describe("err", () => {
  it("returns a failed result with the given error", () => {
    expect(err("SOME_ERROR")).toEqual({ ok: false, error: "SOME_ERROR" });
  });
});
