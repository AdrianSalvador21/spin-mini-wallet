import type { ContactId } from "@/domain/contact/types";
import type { Cents } from "@/domain/money/money";
import type { UserId } from "@/domain/user/types";
import type { AccountView } from "@/shared/lib/api/views";

export const TRANSFER_STEP = {
  AMOUNT: "amount",
  RECIPIENT: "recipient",
  REVIEW: "review",
} as const;

export type TransferStep = (typeof TRANSFER_STEP)[keyof typeof TRANSFER_STEP];

export const TRANSFER_STEP_ORDER: readonly TransferStep[] = [
  TRANSFER_STEP.AMOUNT,
  TRANSFER_STEP.RECIPIENT,
  TRANSFER_STEP.REVIEW,
];

export interface DraftRecipient {
  contactId: ContactId;
  name: string;
  account: AccountView;
}

export interface TransferDraftState {
  ownerId: UserId | null;
  amountInCents: Cents | null;
  concept: string;
  recipient: DraftRecipient | null;
  idempotencyKey: string | null;
}

export interface TransferDraftActions {
  claim(ownerId: UserId): void;
  setAmount(amountInCents: Cents, concept: string): void;
  setRecipient(recipient: DraftRecipient): void;
  ensureIdempotencyKey(): string;
  reset(): void;
}

export type TransferDraftStore = TransferDraftState & TransferDraftActions;

export interface ValidTransferDraft {
  amountInCents: Cents;
  concept: string;
  recipient: DraftRecipient;
  idempotencyKey: string;
}
