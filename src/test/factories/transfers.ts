import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { ValidTransferDraft } from "@/features/transfers/draft/types";
import type { TransferView } from "@/shared/lib/api/views";

export const DRAFT_IDEMPOTENCY_KEY = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

export function buildValidDraft(overrides: Partial<ValidTransferDraft> = {}): ValidTransferDraft {
  return {
    amountInCents: 10_000 as Cents,
    concept: "Comida",
    recipient: {
      contactId: "ctc_carlos" as ContactId,
      name: "Carlos Ruiz",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
    },
    idempotencyKey: DRAFT_IDEMPOTENCY_KEY,
    ...overrides,
  };
}

export function buildTransfer(overrides: Partial<TransferView> = {}): TransferView {
  return {
    id: "trf_1" as TransferView["id"],
    folio: "SPN-48213907",
    trackingKey: "SPIN2026102116420001",
    recipient: {
      name: "Carlos Ruiz",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
    },
    amount: toMoney(10_000 as Cents),
    status: "completed",
    createdAt: "2026-10-21T16:42:00.000Z",
    ...overrides,
  };
}
