import type { Brand } from "../shared/brand";

export type UserId = Brand<string, "UserId">;

export interface User {
  id: UserId;
  fullName: string;
  phone: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
