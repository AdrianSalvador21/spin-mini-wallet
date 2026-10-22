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

export const MOVEMENT_TYPE = {
  TRANSFER_OUT: "transfer_out",
  TRANSFER_IN: "transfer_in",
  CASH_DEPOSIT: "cash_deposit",
  QR_PAYMENT: "qr_payment",
} as const;

export type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];

export const MOVEMENT_DIRECTION = {
  DEBIT: "debit",
  CREDIT: "credit",
} as const;

export type MovementDirection = (typeof MOVEMENT_DIRECTION)[keyof typeof MOVEMENT_DIRECTION];

export interface Movement {
  id: MovementId;
  userId: UserId;
  type: MovementType;
  direction: MovementDirection;
  amount: Money;
  counterpartyName?: string;
  merchantName?: string;
  transferId?: TransferId;
  createdAt: string;
}
