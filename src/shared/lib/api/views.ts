import type { ContactId, RecipientAccount } from "@/domain/contact/types";
import type { Money } from "@/domain/money/money";
import type { Transfer, TransferId } from "@/domain/transfer/types";
import type { UserId } from "@/domain/user/types";
import type { MovementDirection, MovementId, MovementType } from "@/domain/wallet/types";

export interface AccountView {
  type: RecipientAccount["type"];
  masked: string;
  bankName?: string;
}

export interface MovementView {
  id: MovementId;
  type: MovementType;
  direction: MovementDirection;
  amount: Money;
  counterpartyName?: string;
  merchantName?: string;
  counterpartyAccount?: AccountView;
  transferId?: TransferId;
  createdAt: string;
}

export interface WalletSummary {
  user: { id: UserId; fullName: string; maskedPhone: string; email: string };
  balance: Money;
}

export interface MovementsPage {
  items: MovementView[];
  nextCursor: string | null;
}

export interface ContactView {
  id: ContactId;
  name: string;
  account: AccountView;
  isFavorite: boolean;
}

export interface ContactsList {
  items: ContactView[];
}

export interface TransferView {
  id: TransferId;
  folio: string;
  trackingKey: string;
  recipient: { name: string; account: AccountView };
  amount: Money;
  concept?: string;
  status: Transfer["status"];
  createdAt: string;
}
