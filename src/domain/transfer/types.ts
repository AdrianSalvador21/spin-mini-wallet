import type { Brand } from "../shared/brand";
import type { RecipientAccount } from "../contact/types";
import type { Money } from "../money/money";
import type { UserId } from "../user/types";

export type TransferId = Brand<string, "TransferId">;

export type TransferRecipientInput =
  | { kind: "contact"; contactId: string }
  | { kind: "new"; name: string; account: RecipientAccount; saveAsFavorite: boolean };

export interface Transfer {
  id: TransferId;
  folio: string;
  trackingKey: string;
  senderId: UserId;
  recipient: { name: string; account: RecipientAccount };
  amount: Money;
  concept?: string;
  status: "completed";
  idempotencyKey: string;
  createdAt: string;
}
