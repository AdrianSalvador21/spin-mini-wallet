import "server-only";
import { err, ok, type Result } from "@/domain/shared/result";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import { maskPhone } from "@/domain/user/mask";
import type { UserId } from "@/domain/user/types";
import { decodeCursor, encodeCursor, type MovementCursor } from "@/domain/wallet/cursor";
import type { Movement, MovementDirection } from "@/domain/wallet/types";
import { SERVICE_ERROR_CODE, type ServiceDependencies, type ServiceError } from "./types";
import { toMovementView, type MovementsPage, type WalletSummary } from "./views";

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

export interface ListMovementsOptions {
  cursor?: string;
  limit?: number;
  direction?: MovementDirection;
}

export interface WalletService {
  getSummary(userId: UserId): Promise<Result<WalletSummary, ServiceError>>;
  listMovements(userId: UserId, options?: ListMovementsOptions): Promise<Result<MovementsPage, ServiceError>>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function compareMovementsDesc(a: Movement, b: Movement): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }

  return a.id < b.id ? 1 : -1;
}

function isAfterCursor(movement: Movement, cursor: MovementCursor): boolean {
  if (movement.createdAt !== cursor.createdAt) {
    return movement.createdAt < cursor.createdAt;
  }

  return movement.id < cursor.id;
}

export function createWalletService({ db }: ServiceDependencies): WalletService {
  return {
    async getSummary(userId) {
      const { user, wallet } = await db.read((repositories) => ({
        user: repositories.users.findById(userId),
        wallet: repositories.wallets.findByUserId(userId),
      }));

      if (!user || !wallet) {
        return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
      }

      return ok({
        user: { id: user.id, fullName: user.fullName, maskedPhone: maskPhone(user.phone), email: user.email },
        balance: wallet.balance,
      });
    },

    async listMovements(userId, options = {}) {
      const limit = clamp(options.limit ?? DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);
      let after: MovementCursor | null = null;

      if (options.cursor) {
        const decoded = decodeCursor(options.cursor);

        if (!decoded.ok) {
          return err({
            code: SERVICE_ERROR_CODE.VALIDATION_ERROR,
            details: { cursor: ["INVALID_CURSOR"] } as unknown as Record<string, ValidationCode[]>,
          });
        }

        after = decoded.value;
      }

      const movements = await db.read((repositories) => repositories.movements.listByUserId(userId));
      const filtered = options.direction
        ? movements.filter((movement) => movement.direction === options.direction)
        : movements;
      const sorted = [...filtered].sort(compareMovementsDesc);
      const afterCursor = after;
      const startIndex = afterCursor
        ? (() => {
            const index = sorted.findIndex((movement) => isAfterCursor(movement, afterCursor));
            return index === -1 ? sorted.length : index;
          })()
        : 0;
      const page = sorted.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < sorted.length;
      const lastItem = page.at(-1);
      const nextCursor = hasMore && lastItem ? encodeCursor({ createdAt: lastItem.createdAt, id: lastItem.id }) : null;

      return ok({ items: page.map(toMovementView), nextCursor });
    },
  };
}
