import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { MovementsPage, MovementView, WalletSummary } from "@/shared/lib/api/views";

export function buildWalletSummary(overrides: Partial<WalletSummary> = {}): WalletSummary {
  return {
    user: {
      id: "usr_mariana" as WalletSummary["user"]["id"],
      fullName: "Mariana López",
      maskedPhone: "55 •••• 5678",
      email: "mariana@spin.test",
    },
    balance: toMoney(1_245_080 as Cents),
    ...overrides,
  };
}

export function buildMovement(overrides: Partial<MovementView> = {}): MovementView {
  return {
    id: "mov_1" as MovementView["id"],
    type: "cash_deposit",
    direction: "credit",
    amount: toMoney(5_000 as Cents),
    merchantName: "OXXO Insurgentes",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildMovementsPage(overrides: Partial<MovementsPage> = {}): MovementsPage {
  return { items: [buildMovement()], nextCursor: null, ...overrides };
}
