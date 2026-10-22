import "server-only";
import { RECIPIENT_ACCOUNT_TYPE, type Contact, type ContactId, type RecipientAccount } from "@/domain/contact/types";
import { toMoney, type Cents } from "@/domain/money/money";
import type { User, UserId } from "@/domain/user/types";
import {
  MOVEMENT_DIRECTION,
  MOVEMENT_TYPE,
  type Movement,
  type MovementId,
  type MovementType,
  type Wallet,
} from "@/domain/wallet/types";
import { hashPassword } from "../session/password";
import { SCHEMA_VERSION, type DatabaseSnapshot } from "./schema";

const SEED_PASSWORD = "Spin2026";
const MARIANA_MOVEMENT_COUNT = 25;

const SEED_MOVEMENT_DIRECTION: Record<MovementType, (typeof MOVEMENT_DIRECTION)[keyof typeof MOVEMENT_DIRECTION]> = {
  [MOVEMENT_TYPE.TRANSFER_OUT]: MOVEMENT_DIRECTION.DEBIT,
  [MOVEMENT_TYPE.TRANSFER_IN]: MOVEMENT_DIRECTION.CREDIT,
  [MOVEMENT_TYPE.CASH_DEPOSIT]: MOVEMENT_DIRECTION.CREDIT,
  [MOVEMENT_TYPE.QR_PAYMENT]: MOVEMENT_DIRECTION.DEBIT,
};

const CARLOS_PHONE = "5523456789";
const DIEGO_PHONE = "5587654321";

const SEED_MOVEMENT_DETAIL: Record<
  MovementType,
  { counterpartyName?: string; merchantName?: string; counterpartyAccount?: RecipientAccount }
> = {
  [MOVEMENT_TYPE.TRANSFER_OUT]: {
    counterpartyName: "Carlos Ruiz",
    counterpartyAccount: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: CARLOS_PHONE },
  },
  [MOVEMENT_TYPE.TRANSFER_IN]: {
    counterpartyName: "Diego Ramírez",
    counterpartyAccount: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: DIEGO_PHONE },
  },
  [MOVEMENT_TYPE.CASH_DEPOSIT]: { merchantName: "OXXO Insurgentes" },
  [MOVEMENT_TYPE.QR_PAYMENT]: { merchantName: "OXXO Reforma" },
};

const MOVEMENT_TYPE_CYCLE = Object.values(MOVEMENT_TYPE);

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildMarianaMovements(userId: UserId, now: Date): Movement[] {
  return Array.from({ length: MARIANA_MOVEMENT_COUNT }, (_, index) => {
    const type = MOVEMENT_TYPE_CYCLE[index % MOVEMENT_TYPE_CYCLE.length];

    return {
      id: `mov_mariana_${index}` as MovementId,
      userId,
      type,
      direction: SEED_MOVEMENT_DIRECTION[type],
      amount: toMoney(((index + 1) * 5000) as Cents),
      createdAt: daysAgo(now, (index * 30) / MARIANA_MOVEMENT_COUNT),
      ...SEED_MOVEMENT_DETAIL[type],
    };
  });
}

function buildFavorites(ownerId: UserId, now: Date): Contact[] {
  return [
    {
      id: "ctc_carlos" as ContactId,
      ownerId,
      name: "Carlos Ruiz",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: CARLOS_PHONE },
      isFavorite: true,
      createdAt: daysAgo(now, 45),
    },
    {
      id: "ctc_ana" as ContactId,
      ownerId,
      name: "Ana Torres",
      account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: "002180111198765433" },
      isFavorite: true,
      createdAt: daysAgo(now, 40),
    },
    {
      id: "ctc_luis" as ContactId,
      ownerId,
      name: "Luis García",
      account: { type: RECIPIENT_ACCOUNT_TYPE.CARD, cardNumber: "4111111111111111" },
      isFavorite: true,
      createdAt: daysAgo(now, 35),
    },
    {
      id: "ctc_diego" as ContactId,
      ownerId,
      name: "Diego Ramírez",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: DIEGO_PHONE },
      isFavorite: true,
      createdAt: daysAgo(now, 30),
    },
  ];
}

export async function createSeed(now: Date): Promise<DatabaseSnapshot> {
  const marianaId = "usr_mariana" as UserId;
  const diegoId = "usr_diego" as UserId;
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const mariana: User = {
    id: marianaId,
    fullName: "Mariana López",
    phone: "5512345678",
    email: "mariana@spin.test",
    passwordHash,
    createdAt: daysAgo(now, 90),
  };

  const diego: User = {
    id: diegoId,
    fullName: "Diego Ramírez",
    phone: "5587654321",
    email: "diego@spin.test",
    passwordHash,
    createdAt: daysAgo(now, 60),
  };

  const marianaWallet: Wallet = {
    userId: marianaId,
    balance: toMoney(1_245_080 as Cents),
    updatedAt: now.toISOString(),
  };

  const diegoWallet: Wallet = {
    userId: diegoId,
    balance: toMoney(50_000 as Cents),
    updatedAt: now.toISOString(),
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    users: [mariana, diego],
    wallets: [marianaWallet, diegoWallet],
    movements: buildMarianaMovements(marianaId, now),
    contacts: buildFavorites(marianaId, now),
    transfers: [],
    idempotencyKeys: [],
  };
}
