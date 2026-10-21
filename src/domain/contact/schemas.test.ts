import { describe, expect, it } from "vitest";
import { newContactSchema, recipientAccountSchema } from "./schemas";
import { RECIPIENT_ACCOUNT_TYPE } from "./types";

describe("recipientAccountSchema", () => {
  it("accepts and normalizes a phone account", () => {
    const result = recipientAccountSchema.safeParse({
      type: RECIPIENT_ACCOUNT_TYPE.PHONE,
      phone: "+52 (55) 1234-5678",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: "phone", phone: "5512345678" });
  });

  it("accepts a clabe account", () => {
    const result = recipientAccountSchema.safeParse({
      type: RECIPIENT_ACCOUNT_TYPE.CLABE,
      clabe: "002123456789012343",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: "clabe", clabe: "002123456789012343" });
  });

  it("accepts a card account", () => {
    const result = recipientAccountSchema.safeParse({
      type: RECIPIENT_ACCOUNT_TYPE.CARD,
      cardNumber: "4111 1111 1111 1111",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: "card", cardNumber: "4111111111111111" });
  });

  it("reports the underlying validator code for an invalid clabe", () => {
    const result = recipientAccountSchema.safeParse({
      type: RECIPIENT_ACCOUNT_TYPE.CLABE,
      clabe: "123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("CLABE_INVALID_LENGTH");
  });
});

describe("newContactSchema", () => {
  it("outputs normalized values on success", () => {
    const result = newContactSchema.safeParse({
      name: "  Ana   Pérez  ",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" },
      saveAsFavorite: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Ana Pérez",
      account: { type: "phone", phone: "5512345678" },
      saveAsFavorite: true,
    });
  });
});
