import "server-only";
import type { UserId } from "@/domain/user/types";
import type { Movement } from "@/domain/wallet/types";
import type { DatabaseSnapshot } from "../db/schema";

export interface MovementsRepository {
  listByUserId(userId: UserId): Movement[];
  insert(movement: Movement): void;
}

export function createMovementsRepository(snapshot: DatabaseSnapshot): MovementsRepository {
  return {
    listByUserId(userId) {
      return snapshot.movements.filter((movement) => movement.userId === userId);
    },
    insert(movement) {
      snapshot.movements.push(movement);
    },
  };
}
