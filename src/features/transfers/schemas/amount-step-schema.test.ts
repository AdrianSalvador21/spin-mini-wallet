import { describe, expect, it } from "vitest";
import { toMoney, type Cents } from "@/domain/money/money";
import { createAmountStepSchema } from "./amount-step-schema";

const BALANCE = toMoney(1_245_080 as Cents);

function firstIssue(schema: ReturnType<typeof createAmountStepSchema>, input: { amount: string; concept: string }) {
  const result = schema.safeParse(input);

  return result.success ? undefined : result.error.issues[0];
}

describe("createAmountStepSchema", () => {
  it("parses a formatted amount into cents and trims the concept", () => {
    expect(createAmountStepSchema(BALANCE).parse({ amount: "12,450.8", concept: " Cena " })).toEqual({
      amount: 1_245_080,
      concept: "Cena",
    });
  });

  it("returns an undefined concept when it is empty", () => {
    expect(createAmountStepSchema(BALANCE).parse({ amount: "100", concept: "" }).concept).toBeUndefined();
  });

  it.each([
    ["", "AMOUNT_REQUIRED"],
    ["0", "AMOUNT_NOT_POSITIVE"],
    ["12,450.81", "INSUFFICIENT_FUNDS"],
    ["1.234", "AMOUNT_TOO_MANY_DECIMALS"],
  ])("reports %j as %s on the amount", (amount, code) => {
    expect(firstIssue(createAmountStepSchema(BALANCE), { amount, concept: "" })).toMatchObject({
      path: ["amount"],
      message: code,
    });
  });

  it("skips the balance rules while the balance is unknown", () => {
    expect(createAmountStepSchema(null).parse({ amount: "99,999", concept: "" }).amount).toBe(9_999_900);
  });

  it("reports a concept over 40 characters", () => {
    expect(firstIssue(createAmountStepSchema(BALANCE), { amount: "100", concept: "a".repeat(41) })).toMatchObject({
      path: ["concept"],
      message: "CONCEPT_TOO_LONG",
    });
  });
});
