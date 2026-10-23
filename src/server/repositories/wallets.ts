import "server-only";
import type { UserId } from "@/domain/user/types";
import type { Wallet } from "@/domain/wallet/types";
import type { DatabaseSnapshot } from "../db/schema";

export interface WalletsRepository {
  findByUserId(userId: UserId): Wallet | undefined;
  insert(wallet: Wallet): void;
}

export function createWalletsRepository(snapshot: DatabaseSnapshot): WalletsRepository {
  return {
    findByUserId(userId) {
      return snapshot.wallets.find((wallet) => wallet.userId === userId);
    },
    insert(wallet) {
      snapshot.wallets.push(wallet);
    },
  };
}
