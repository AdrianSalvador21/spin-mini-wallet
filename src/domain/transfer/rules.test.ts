import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "../contact/types";
import { toMoney, type Cents } from "../money/money";
import { validateTransfer, type TransferDraft } from "./rules";
import { TRANSFER_RECIPIENT_KIND, type TransferRecipientInput } from "./types";

const BALANCE = toMoney(10_000 as Cents);
const RECIPIENT: TransferRecipientInput = {
  kind: TRANSFER_RECIPIENT_KIND.CONTACT,
  contactId: "contact-1",
};

describe("validateTransfer", () => {
  it("is valid when the amount is positive and within the balance", () => {
    const draft: TransferDraft = { amount: toMoney(5_000 as Cents), recipient: RECIPIENT };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: true,
      value: { amount: toMoney(5_000 as Cents), recipient: RECIPIENT },
    });
  });

  it("is valid when the amount equals the available balance", () => {
    const draft: TransferDraft = { amount: toMoney(10_000 as Cents), recipient: RECIPIENT };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: true,
      value: { amount: toMoney(10_000 as Cents), recipient: RECIPIENT },
    });
  });

  it("returns INSUFFICIENT_FUNDS when the amount is one cent above the balance", () => {
    const draft: TransferDraft = { amount: toMoney(10_001 as Cents), recipient: RECIPIENT };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: false,
      error: ["INSUFFICIENT_FUNDS"],
    });
  });

  it("returns AMOUNT_NOT_POSITIVE for a zero amount", () => {
    const draft: TransferDraft = { amount: toMoney(0 as Cents), recipient: RECIPIENT };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: false,
      error: ["AMOUNT_NOT_POSITIVE"],
    });
  });

  it("returns RECIPIENT_REQUIRED when there is no recipient", () => {
    const draft: TransferDraft = { amount: toMoney(5_000 as Cents), recipient: null };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: false,
      error: ["RECIPIENT_REQUIRED"],
    });
  });

  it("collects every violation when the amount is zero and there is no recipient", () => {
    const draft: TransferDraft = { amount: toMoney(0 as Cents), recipient: null };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: false,
      error: ["AMOUNT_NOT_POSITIVE", "RECIPIENT_REQUIRED"],
    });
  });

  it("accepts a new, non-contact recipient", () => {
    const newRecipient: TransferRecipientInput = {
      kind: TRANSFER_RECIPIENT_KIND.NEW,
      name: "Ana Pérez",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5512345678" },
      saveAsFavorite: false,
    };
    const draft: TransferDraft = { amount: toMoney(5_000 as Cents), recipient: newRecipient };

    expect(validateTransfer(draft, BALANCE)).toEqual({
      ok: true,
      value: { amount: toMoney(5_000 as Cents), recipient: newRecipient },
    });
  });
});
