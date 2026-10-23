import { describe, expect, it } from "vitest";
import {
  addMoney,
  compareMoney,
  MAX_AMOUNT_IN_CENTS,
  parseAmount,
  subtractMoney,
  toMoney,
  validateAmountInCents,
  type Cents,
} from "./money";

describe("validateAmountInCents", () => {
  it.each([10.5, Number.NaN, Number.POSITIVE_INFINITY])("returns AMOUNT_INVALID_FORMAT for %s", (value) => {
    expect(validateAmountInCents(value)).toEqual({ ok: false, error: "AMOUNT_INVALID_FORMAT" });
  });

  it("returns AMOUNT_EXCEEDS_MAXIMUM one cent above the maximum", () => {
    expect(validateAmountInCents(MAX_AMOUNT_IN_CENTS + 1)).toEqual({ ok: false, error: "AMOUNT_EXCEEDS_MAXIMUM" });
  });

  it("accepts the maximum amount", () => {
    expect(validateAmountInCents(MAX_AMOUNT_IN_CENTS)).toEqual({ ok: true, value: MAX_AMOUNT_IN_CENTS });
  });

  it.each([0, -1])("leaves %s to the AMOUNT_NOT_POSITIVE business rule", (value) => {
    expect(validateAmountInCents(value)).toEqual({ ok: true, value });
  });
});

describe("parseAmount", () => {
  it("parses a plain integer amount", () => {
    expect(parseAmount("19")).toEqual({ ok: true, value: 1900 });
  });

  it("parses an amount with two decimals", () => {
    expect(parseAmount("19.99")).toEqual({ ok: true, value: 1999 });
  });

  it("parses an amount with one decimal", () => {
    expect(parseAmount("0.1")).toEqual({ ok: true, value: 10 });
  });

  it("strips a leading dollar sign", () => {
    expect(parseAmount("$19.99")).toEqual({ ok: true, value: 1999 });
  });

  it("strips comma thousand separators", () => {
    expect(parseAmount("1,234.5")).toEqual({ ok: true, value: 123450 });
  });

  it("strips surrounding and internal spaces", () => {
    expect(parseAmount(" $ 1,234.5 ")).toEqual({ ok: true, value: 123450 });
  });

  it("accepts zero", () => {
    expect(parseAmount("0")).toEqual({ ok: true, value: 0 });
  });

  it("returns AMOUNT_REQUIRED for an empty string", () => {
    expect(parseAmount("")).toEqual({ ok: false, error: "AMOUNT_REQUIRED" });
  });

  it("returns AMOUNT_REQUIRED for a blank string", () => {
    expect(parseAmount("   ")).toEqual({ ok: false, error: "AMOUNT_REQUIRED" });
  });

  it("returns AMOUNT_INVALID_FORMAT for a negative amount", () => {
    expect(parseAmount("-5")).toEqual({ ok: false, error: "AMOUNT_INVALID_FORMAT" });
  });

  it("returns AMOUNT_INVALID_FORMAT for non-numeric input", () => {
    expect(parseAmount("abc")).toEqual({ ok: false, error: "AMOUNT_INVALID_FORMAT" });
  });

  it("returns AMOUNT_TOO_MANY_DECIMALS for three or more decimals", () => {
    expect(parseAmount("10.001")).toEqual({ ok: false, error: "AMOUNT_TOO_MANY_DECIMALS" });
  });

  it("returns AMOUNT_EXCEEDS_MAXIMUM above the technical limit", () => {
    expect(parseAmount("1000000")).toEqual({ ok: false, error: "AMOUNT_EXCEEDS_MAXIMUM" });
  });

  it("accepts the maximum amount", () => {
    expect(parseAmount("999999.99")).toEqual({ ok: true, value: MAX_AMOUNT_IN_CENTS });
  });
});

describe("toMoney", () => {
  it("wraps cents into a Money value in MXN", () => {
    expect(toMoney(1999 as Cents)).toEqual({ amountInCents: 1999, currency: "MXN" });
  });
});

describe("addMoney", () => {
  it("adds the cents of two Money values", () => {
    const result = addMoney(toMoney(1000 as Cents), toMoney(250 as Cents));

    expect(result).toEqual({ amountInCents: 1250, currency: "MXN" });
  });
});

describe("subtractMoney", () => {
  it("subtracts the cents of two Money values", () => {
    const result = subtractMoney(toMoney(1000 as Cents), toMoney(250 as Cents));

    expect(result).toEqual({ amountInCents: 750, currency: "MXN" });
  });
});

describe("compareMoney", () => {
  it("returns -1 when the first amount is smaller", () => {
    expect(compareMoney(toMoney(100 as Cents), toMoney(200 as Cents))).toBe(-1);
  });

  it("returns 1 when the first amount is larger", () => {
    expect(compareMoney(toMoney(200 as Cents), toMoney(100 as Cents))).toBe(1);
  });

  it("returns 0 when both amounts are equal", () => {
    expect(compareMoney(toMoney(100 as Cents), toMoney(100 as Cents))).toBe(0);
  });
});
