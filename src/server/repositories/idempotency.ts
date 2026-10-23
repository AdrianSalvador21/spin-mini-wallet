import "server-only";
import type { UserId } from "@/domain/user/types";
import type { DatabaseSnapshot, IdempotencyRecord } from "../db/schema";

export interface IdempotencyRepository {
  find(userId: UserId, key: string): IdempotencyRecord | undefined;
  insert(record: IdempotencyRecord): void;
}

export function createIdempotencyRepository(snapshot: DatabaseSnapshot): IdempotencyRepository {
  return {
    find(userId, key) {
      return snapshot.idempotencyKeys.find((record) => record.userId === userId && record.key === key);
    },
    insert(record) {
      snapshot.idempotencyKeys.push(record);
    },
  };
}
