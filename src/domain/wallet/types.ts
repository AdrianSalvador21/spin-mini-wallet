import type { Brand } from "../shared/brand";
import type { Money } from "../money/money";
import type { UserId } from "../user/types";
import type { TransferId } from "../transfer/types";

export type MovementId = Brand<string, "MovementId">;

export interface Wallet {
  userId: UserId;
  balance: Money;
  updatedAt: string;
}

export type MovementType = "transfer_out" | "transfer_in" | "cash_deposit" | "qr_payment";

export interface Movement {
  id: MovementId;
  userId: UserId;
  type: MovementType;
  direction: "debit" | "credit";
  amount: Money;
  description: string;
  transferId?: TransferId;
  createdAt: string;
}
