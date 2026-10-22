import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import type { NewRecipientValues } from "../components/new-recipient-form/types";
import { fieldForDetail, newRecipientResolver, toNewContactRequest } from "./new-recipient-schema";

const VALUES: NewRecipientValues = {
  type: RECIPIENT_ACCOUNT_TYPE.PHONE,
  name: "Beatriz Soto",
  phone: "55 9999 9999",
  clabe: "002123456789012343",
  cardNumber: "4111111111111111",
  saveAsFavorite: true,
};

describe("toNewContactRequest", () => {
  it.each([
    [RECIPIENT_ACCOUNT_TYPE.PHONE, { type: "phone", phone: "55 9999 9999" }],
    [RECIPIENT_ACCOUNT_TYPE.CLABE, { type: "clabe", clabe: "002123456789012343" }],
    [RECIPIENT_ACCOUNT_TYPE.CARD, { type: "card", cardNumber: "4111111111111111" }],
  ])("sends only the %s account", (type, account) => {
    expect(toNewContactRequest({ ...VALUES, type })).toEqual({ name: "Beatriz Soto", saveAsFavorite: true, account });
  });

  it("throws for an account type outside the union", () => {
    expect(() =>
      toNewContactRequest({ ...VALUES, type: "iban" as unknown as NewRecipientValues["type"] }),
    ).toThrow();
  });
});

describe("fieldForDetail", () => {
  it.each([
    ["name", RECIPIENT_ACCOUNT_TYPE.PHONE, "name"],
    ["account.clabe", RECIPIENT_ACCOUNT_TYPE.CLABE, "clabe"],
    ["account.cardNumber", RECIPIENT_ACCOUNT_TYPE.CARD, "cardNumber"],
    ["account", RECIPIENT_ACCOUNT_TYPE.PHONE, "phone"],
    ["account", RECIPIENT_ACCOUNT_TYPE.CARD, "cardNumber"],
    ["saveAsFavorite", RECIPIENT_ACCOUNT_TYPE.PHONE, null],
  ] as const)("maps %s on a %s account to %s", (detail, type, expected) => {
    expect(fieldForDetail(detail, type)).toBe(expected);
  });
});

describe("newRecipientResolver", () => {
  it("passes valid values through", async () => {
    const result = await newRecipientResolver(VALUES, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result).toEqual({ values: VALUES, errors: {} });
  });

  it("reports the name and the account field of the selected type", async () => {
    const result = await newRecipientResolver({ ...VALUES, name: "", type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: "123" }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors.name?.message).toBe("NAME_REQUIRED");
    expect(result.errors.clabe?.message).toBe("CLABE_INVALID_LENGTH");
    expect(result.errors.phone).toBeUndefined();
  });
});
