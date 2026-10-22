import { describe, expect, it } from "vitest";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE } from "./types";

describe("MOVEMENT_TYPE", () => {
  it("matches the documented wire format", () => {
    expect(MOVEMENT_TYPE).toEqual({
      TRANSFER_OUT: "transfer_out",
      TRANSFER_IN: "transfer_in",
      CASH_DEPOSIT: "cash_deposit",
      QR_PAYMENT: "qr_payment",
    });
  });
});

describe("MOVEMENT_DIRECTION", () => {
  it("matches the documented wire format", () => {
    expect(MOVEMENT_DIRECTION).toEqual({ DEBIT: "debit", CREDIT: "credit" });
  });
});
