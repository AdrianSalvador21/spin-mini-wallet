import { describe, expect, it } from "vitest";
import { maskAccount } from "./mask";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "./types";

describe("maskAccount", () => {
  it("masks a phone account", () => {
    expect(maskAccount({ type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" })).toBe("•••• 5678");
  });

  it("masks a clabe account", () => {
    expect(maskAccount({ type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: "002123456789012343" })).toBe(
      "•••• 2343",
    );
  });

  it("masks a card account", () => {
    expect(maskAccount({ type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: "4111111111111111" })).toBe(
      "•••• 1111",
    );
  });

  it("throws for an account type outside the union", () => {
    const invalid = { type: "unknown" } as unknown as RecipientAccount;
    expect(() => maskAccount(invalid)).toThrow();
  });
});
