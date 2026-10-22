import "server-only";
import type { User, UserId } from "@/domain/user/types";
import type { DatabaseSnapshot } from "../db/schema";

export interface UsersRepository {
  findById(id: UserId): User | undefined;
  findByPhone(phone: string): User | undefined;
  findByEmail(email: string): User | undefined;
  insert(user: User): void;
}

export function createUsersRepository(snapshot: DatabaseSnapshot): UsersRepository {
  return {
    findById(id) {
      return snapshot.users.find((user) => user.id === id);
    },
    findByPhone(phone) {
      return snapshot.users.find((user) => user.phone === phone);
    },
    findByEmail(email) {
      return snapshot.users.find((user) => user.email === email);
    },
    insert(user) {
      snapshot.users.push(user);
    },
  };
}
