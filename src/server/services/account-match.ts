import "server-only";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "@/domain/contact/types";

export function accountsMatch(a: RecipientAccount, b: RecipientAccount): boolean {
  if (a.type !== b.type) {
    return false;
  }

  switch (a.type) {
    case RECIPIENT_ACCOUNT_TYPE.PHONE:
      return b.type === RECIPIENT_ACCOUNT_TYPE.PHONE && a.phone === b.phone;
    case RECIPIENT_ACCOUNT_TYPE.CLABE:
      return b.type === RECIPIENT_ACCOUNT_TYPE.CLABE && a.clabe === b.clabe;
    case RECIPIENT_ACCOUNT_TYPE.CARD:
      return b.type === RECIPIENT_ACCOUNT_TYPE.CARD && a.cardNumber === b.cardNumber;
    default:
      return assertUnreachable(a);
  }
}
