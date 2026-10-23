import { describe, expect, it } from "vitest";
import { toMoney, type Cents } from "../money/money";
import { TRANSFER_FEE } from "./fees";

describe("TRANSFER_FEE", () => {
  it("is zero pesos", () => {
    expect(TRANSFER_FEE).toEqual(toMoney(0 as Cents));
  });
});
