import "server-only";
import type { Transfer, TransferId } from "@/domain/transfer/types";
import type { DatabaseSnapshot } from "../db/schema";

export interface TransfersRepository {
  findById(id: TransferId): Transfer | undefined;
  insert(transfer: Transfer): void;
}

export function createTransfersRepository(snapshot: DatabaseSnapshot): TransfersRepository {
  return {
    findById(id) {
      return snapshot.transfers.find((transfer) => transfer.id === id);
    },
    insert(transfer) {
      snapshot.transfers.push(transfer);
    },
  };
}
