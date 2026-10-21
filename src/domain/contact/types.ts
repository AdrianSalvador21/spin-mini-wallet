import type { Brand } from "../shared/brand";
import type { UserId } from "../user/types";

export type ContactId = Brand<string, "ContactId">;

export const RECIPIENT_ACCOUNT_TYPE = {
  PHONE: "phone",
  CLABE: "clabe",
  CARD: "card",
} as const;

export type RecipientAccount =
  | { type: typeof RECIPIENT_ACCOUNT_TYPE.PHONE; phone: string }
  | { type: typeof RECIPIENT_ACCOUNT_TYPE.CLABE; clabe: string }
  | { type: typeof RECIPIENT_ACCOUNT_TYPE.CARD; cardNumber: string };

export interface Contact {
  id: ContactId;
  ownerId: UserId;
  name: string;
  account: RecipientAccount;
  isFavorite: boolean;
  createdAt: string;
}
