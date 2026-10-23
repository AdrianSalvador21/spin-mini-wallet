import "server-only";
import type { Contact } from "@/domain/contact/types";
import type { Transfer, TransferId } from "@/domain/transfer/types";
import type { User, UserId } from "@/domain/user/types";
import type { Movement, Wallet } from "@/domain/wallet/types";

export const SCHEMA_VERSION = 2;

export interface IdempotencyRecord {
  key: string;
  userId: UserId;
  payloadHash: string;
  transferId: TransferId;
  createdAt: string;
}

export interface DatabaseSnapshot {
  schemaVersion: typeof SCHEMA_VERSION;
  users: User[];
  wallets: Wallet[];
  movements: Movement[];
  contacts: Contact[];
  transfers: Transfer[];
  idempotencyKeys: IdempotencyRecord[];
}
