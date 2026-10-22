import type { Money } from "@/domain/money/money";
import { MOVEMENT_DIRECTION, type MovementDirection } from "@/domain/wallet/types";
import { locale } from "@/shared/i18n/config";

const MINUS_SIGN = "−";

export function formatMoney(money: Money): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: money.currency }).format(
    money.amountInCents / 100,
  );
}

export function formatSignedMoney(money: Money, direction: MovementDirection): string {
  const formatted = formatMoney(money);
  return direction === MOVEMENT_DIRECTION.CREDIT ? `+${formatted}` : `${MINUS_SIGN}${formatted}`;
}

export function splitMoney(money: Money): { whole: string; cents: string } {
  const formatted = formatMoney(money);
  const dotIndex = formatted.lastIndexOf(".");

  return { whole: formatted.slice(0, dotIndex), cents: formatted.slice(dotIndex) };
}
