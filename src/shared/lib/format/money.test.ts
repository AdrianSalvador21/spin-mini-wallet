import { describe, expect, it } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import { formatMoney, formatSignedMoney, formatWholeMoney, splitMoney } from "./money";

describe("formatMoney", () => {
  it("formats a positive amount with thousands separator and two decimals", () => {
    expect(formatMoney(toMoney(1_245_080 as Cents))).toBe("$12,450.80");
  });

  it("formats zero", () => {
    expect(formatMoney(toMoney(0 as Cents))).toBe("$0.00");
  });

  it("formats a large amount", () => {
    expect(formatMoney(toMoney(99_999_999 as Cents))).toBe("$999,999.99");
  });
});

describe("formatWholeMoney", () => {
  it("formats an amount without decimals", () => {
    expect(formatWholeMoney(toMoney(50_000 as Cents))).toBe("$500");
  });
});

describe("formatSignedMoney", () => {
  it("prefixes a credit with +", () => {
    expect(formatSignedMoney(toMoney(100_000 as Cents), "credit")).toBe("+$1,000.00");
  });

  it("prefixes a debit with the minus sign U+2212", () => {
    expect(formatSignedMoney(toMoney(35_000 as Cents), "debit")).toBe("−$350.00");
  });
});

describe("splitMoney", () => {
  it("splits the whole part and the cents", () => {
    expect(splitMoney(toMoney(1_245_080 as Cents))).toEqual({ whole: "$12,450", cents: ".80" });
  });
});
