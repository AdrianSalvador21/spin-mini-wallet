import { assertUnreachable } from "../shared/assert-unreachable";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "./types";

function maskDigits(digits: string): string {
  return `•••• ${digits.slice(-4)}`;
}

export function maskAccount(account: RecipientAccount): string {
  switch (account.type) {
    case RECIPIENT_ACCOUNT_TYPE.PHONE:
      return maskDigits(account.phone);
    case RECIPIENT_ACCOUNT_TYPE.CLABE:
      return maskDigits(account.clabe);
    case RECIPIENT_ACCOUNT_TYPE.CARD:
      return maskDigits(account.cardNumber);
    default:
      return assertUnreachable(account);
  }
}
