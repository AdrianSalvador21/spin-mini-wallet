import type { Brand } from "../shared/brand";
import type { UserId } from "../user/types";

export type ContactId = Brand<string, "ContactId">;

export type RecipientAccount =
  | { type: "phone"; phone: string }
  | { type: "clabe"; clabe: string }
  | { type: "card"; cardNumber: string };

export interface Contact {
  id: ContactId;
  ownerId: UserId;
  name: string;
  account: RecipientAccount;
  isFavorite: boolean;
  createdAt: string;
}
