import "server-only";
import type { z } from "zod";
import { toMoney, type Cents } from "@/domain/money/money";
import { ok, err, type Result } from "@/domain/shared/result";
import { LOGIN_METHOD, type loginSchema, type registerSchema } from "@/domain/user/schemas";
import type { User, UserId } from "@/domain/user/types";
import type { Wallet } from "@/domain/wallet/types";
import { hashPassword, verifyPassword } from "../session/password";
import { SERVICE_ERROR_CODE, type ServiceDependencies, type ServiceError } from "./types";
import { toUserView, type UserView } from "./views";

const STARTING_BALANCE_CENTS = 100_000 as Cents;
const DUMMY_PASSWORD_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export interface AuthService {
  register(input: z.infer<typeof registerSchema>): Promise<Result<UserView, ServiceError>>;
  verifyCredentials(input: z.infer<typeof loginSchema>): Promise<Result<UserView, ServiceError>>;
  exists(userId: UserId): Promise<boolean>;
}

export function createAuthService({ db, now, createId }: ServiceDependencies): AuthService {
  return {
    async register(input) {
      const duplicatePhone = await db.read((repositories) => repositories.users.findByPhone(input.phone));

      if (duplicatePhone) {
        return err({
          code: SERVICE_ERROR_CODE.VALIDATION_ERROR,
          details: { phone: ["PHONE_ALREADY_REGISTERED"] },
        });
      }

      const duplicateEmail = await db.read((repositories) => repositories.users.findByEmail(input.email));

      if (duplicateEmail) {
        return err({
          code: SERVICE_ERROR_CODE.VALIDATION_ERROR,
          details: { email: ["EMAIL_ALREADY_REGISTERED"] },
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user: User = {
        id: `usr_${createId()}` as UserId,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        passwordHash,
        createdAt: now().toISOString(),
      };
      const wallet: Wallet = {
        userId: user.id,
        balance: toMoney(STARTING_BALANCE_CENTS),
        updatedAt: now().toISOString(),
      };

      await db.transaction((repositories) => {
        repositories.users.insert(user);
        repositories.wallets.insert(wallet);
      });

      return ok(toUserView(user));
    },

    async verifyCredentials(input) {
      const user = await db.read((repositories) =>
        input.method === LOGIN_METHOD.PHONE
          ? repositories.users.findByPhone(input.phone)
          : repositories.users.findByEmail(input.email),
      );

      const passwordIsValid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

      if (!user || !passwordIsValid) {
        return err({ code: SERVICE_ERROR_CODE.INVALID_CREDENTIALS });
      }

      return ok(toUserView(user));
    },

    async exists(userId) {
      const user = await db.read((repositories) => repositories.users.findById(userId));

      return user !== undefined;
    },
  };
}
