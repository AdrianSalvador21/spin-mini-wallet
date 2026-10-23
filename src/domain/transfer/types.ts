import type { Brand } from "../shared/brand";
import type { RecipientAccount } from "../contact/types";
import type { Money } from "../money/money";
import type { UserId } from "../user/types";

export type TransferId = Brand<string, "TransferId">;

export const TRANSFER_RECIPIENT_KIND = {
  CONTACT: "contact",
  NEW: "new",
} as const;

export type TransferRecipientInput =
  | { kind: typeof TRANSFER_RECIPIENT_KIND.CONTACT; contactId: string }
  | {
      kind: typeof TRANSFER_RECIPIENT_KIND.NEW;
      name: string;
      account: RecipientAccount;
      saveAsFavorite: boolean;
    };

export const TRANSFER_STATUS = {
  COMPLETED: "completed",
} as const;

export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export interface Transfer {
  id: TransferId;
  folio: string;
  trackingKey: string;
  senderId: UserId;
  recipient: { name: string; account: RecipientAccount };
  amount: Money;
  concept?: string;
  status: TransferStatus;
  idempotencyKey: string;
  createdAt: string;
}
