import "server-only";
import type { DatabaseSnapshot } from "../db/schema";
import { createContactsRepository, type ContactsRepository } from "./contacts";
import { createIdempotencyRepository, type IdempotencyRepository } from "./idempotency";
import { createMovementsRepository, type MovementsRepository } from "./movements";
import { createTransfersRepository, type TransfersRepository } from "./transfers";
import { createUsersRepository, type UsersRepository } from "./users";
import { createWalletsRepository, type WalletsRepository } from "./wallets";

export interface Repositories {
  users: UsersRepository;
  wallets: WalletsRepository;
  movements: MovementsRepository;
  contacts: ContactsRepository;
  transfers: TransfersRepository;
  idempotency: IdempotencyRepository;
}

export function createRepositories(snapshot: DatabaseSnapshot): Repositories {
  return {
    users: createUsersRepository(snapshot),
    wallets: createWalletsRepository(snapshot),
    movements: createMovementsRepository(snapshot),
    contacts: createContactsRepository(snapshot),
    transfers: createTransfersRepository(snapshot),
    idempotency: createIdempotencyRepository(snapshot),
  };
}
