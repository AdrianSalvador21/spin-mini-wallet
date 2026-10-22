import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { EMPTY_DRAFT } from "./draft-store";
import { resolveStepAccess } from "./step-guard";
import { TRANSFER_STEP, type TransferDraftState, type TransferStep } from "./types";

const WITH_AMOUNT: TransferDraftState = { ...EMPTY_DRAFT, amountInCents: 5_000 as Cents };
const COMPLETE: TransferDraftState = {
  ...WITH_AMOUNT,
  recipient: {
    contactId: "ctc_carlos" as ContactId,
    name: "Carlos Ruiz",
    account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
  },
};
const RECIPIENT_ONLY: TransferDraftState = { ...COMPLETE, amountInCents: null };

describe("resolveStepAccess", () => {
  it.each([
    [TRANSFER_STEP.AMOUNT, EMPTY_DRAFT, TRANSFER_STEP.AMOUNT],
    [TRANSFER_STEP.AMOUNT, COMPLETE, TRANSFER_STEP.AMOUNT],
    [TRANSFER_STEP.RECIPIENT, EMPTY_DRAFT, TRANSFER_STEP.AMOUNT],
    [TRANSFER_STEP.RECIPIENT, WITH_AMOUNT, TRANSFER_STEP.RECIPIENT],
    [TRANSFER_STEP.REVIEW, EMPTY_DRAFT, TRANSFER_STEP.AMOUNT],
    [TRANSFER_STEP.REVIEW, RECIPIENT_ONLY, TRANSFER_STEP.AMOUNT],
    [TRANSFER_STEP.REVIEW, WITH_AMOUNT, TRANSFER_STEP.RECIPIENT],
    [TRANSFER_STEP.REVIEW, COMPLETE, TRANSFER_STEP.REVIEW],
  ] as const)("on %s resolves to %s", (step, draft, expected) => {
    expect(resolveStepAccess(step, draft)).toBe(expected);
  });

  it("throws for an unknown step", () => {
    expect(() => resolveStepAccess("confirm" as unknown as TransferStep, COMPLETE)).toThrow();
  });
});
