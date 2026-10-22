import { describe, expect, it } from "vitest";
import type { Cents } from "@/domain/money/money";
import { amountInputFromCents, formatAmountInput, sanitizeAmountInput } from "./amount-input";

describe("sanitizeAmountInput", () => {
  it.each([
    ["", ""],
    ["12450", "12450"],
    ["12,450.8", "12450.8"],
    ["0.5", "0.5"],
    [".5", ".5"],
    ["100.", "100."],
    ["100.25", "100.25"],
  ])("accepts %j as %j", (raw, expected) => {
    expect(sanitizeAmountInput(raw)).toBe(expected);
  });

  it.each(["12a", "1.2.3", "100.255", "-5", "$5", "1 000", "1000000", "1,000,000.5"])("rejects %j", (raw) => {
    expect(sanitizeAmountInput(raw)).toBeNull();
  });

  it("accepts up to the maximum amount of six integer digits", () => {
    expect(sanitizeAmountInput("999,999.99")).toBe("999999.99");
  });

  it("does not count leading zeros towards the limit", () => {
    expect(sanitizeAmountInput("0999999")).toBe("999999");
  });
});

describe("formatAmountInput", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["1245", "1,245"],
    ["12450.8", "12,450.8"],
    ["1245080", "1,245,080"],
    ["100.", "100."],
    ["0.50", "0.50"],
    ["007", "7"],
    ["1,2345", "12,345"],
  ])("formats %j as %j", (raw, expected) => {
    expect(formatAmountInput(raw)).toBe(expected);
  });
});

describe("amountInputFromCents", () => {
  it.each([
    [1_245_080, "12,450.80"],
    [35_000, "350.00"],
    [5, "0.05"],
  ])("turns %i cents into %j", (cents, expected) => {
    expect(amountInputFromCents(cents as Cents)).toBe(expected);
  });
});
