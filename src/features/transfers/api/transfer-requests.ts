import type { Cents } from "@/domain/money/money";
import type { TransferRecipient } from "@/domain/transfer/types";
import type { ValidTransferDraft } from "../draft/types";

export const TRANSFERS_PATH = "/api/v1/transfers";
export const TRANSFER_TIMEOUT_MS = 8000;

export interface TransferRequestBody {
  amountInCents: Cents;
  recipient: TransferRecipient;
  concept?: string;
}

export function buildTransferPayload(draft: ValidTransferDraft): TransferRequestBody {
  const payload: TransferRequestBody = {
    amountInCents: draft.amountInCents,
    recipient: { contactId: draft.recipient.contactId },
  };

  return draft.concept === "" ? payload : { ...payload, concept: draft.concept };
}

export function transferLookupPath(idempotencyKey: string): string {
  return `${TRANSFERS_PATH}?${new URLSearchParams({ idempotencyKey })}`;
}
