import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_IN_CENTS } from "../money/money";
import { createTransferSchema, transferAmountSchema } from "./schemas";

describe("transferAmountSchema", () => {
  it("outputs amountInCents on success", () => {
    const result = transferAmountSchema.safeParse({ amount: "1,234.5" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ amountInCents: 123450 });
  });

  it("reports the parser's error code on the amount field", () => {
    const result = transferAmountSchema.safeParse({ amount: "10.001" });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.join(".") === "amount");
    expect(issue?.message).toBe("AMOUNT_TOO_MANY_DECIMALS");
  });
});

describe("createTransferSchema", () => {
  it("accepts a transfer to a contact and trims the concept", () => {
    const result = createTransferSchema.safeParse({
      amountInCents: 1999,
      recipient: { contactId: "contact-1" },
      concept: "  Renta oct.  ",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      amountInCents: 1999,
      recipient: { contactId: "contact-1" },
      concept: "Renta oct.",
    });
  });

  it("rejects a body that sends a new recipient instead of a contact", () => {
    const result = createTransferSchema.safeParse({
      amountInCents: 1999,
      recipient: {
        name: "Ana Pérez",
        account: { type: "phone", phone: "5512345678" },
        saveAsFavorite: true,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join(".") === "recipient.contactId")).toBe(true);
  });

  it("rejects an empty contactId", () => {
    const result = createTransferSchema.safeParse({ amountInCents: 1999, recipient: { contactId: "" } });

    expect(result.success).toBe(false);
  });

  it.each([
    [10.5, "AMOUNT_INVALID_FORMAT"],
    [MAX_AMOUNT_IN_CENTS + 1, "AMOUNT_EXCEEDS_MAXIMUM"],
  ])("rejects amountInCents %s with %s", (amountInCents, code) => {
    const result = createTransferSchema.safeParse({ amountInCents, recipient: { contactId: "contact-1" } });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.join(".") === "amountInCents");
    expect(issue?.message).toBe(code);
  });

  it("reports the underlying validator code for an invalid concept", () => {
    const result = createTransferSchema.safeParse({
      amountInCents: 1999,
      recipient: { contactId: "contact-1" },
      concept: "a".repeat(41),
    });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.join(".") === "concept");
    expect(issue?.message).toBe("CONCEPT_TOO_LONG");
  });
});
