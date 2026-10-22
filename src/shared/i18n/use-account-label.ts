import { useTranslations } from "next-intl";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import type { AccountView } from "@/shared/lib/api/views";

export function useAccountLabel(): (account: AccountView) => string {
  const t = useTranslations("common.account");

  return (account) => {
    switch (account.type) {
      case RECIPIENT_ACCOUNT_TYPE.PHONE:
        return `${t("phone")} ${account.masked}`;
      case RECIPIENT_ACCOUNT_TYPE.CLABE:
        return `${t("clabe")} ${account.masked}`;
      case RECIPIENT_ACCOUNT_TYPE.CARD:
        return `${t("card")} ${account.masked}`;
      default:
        return assertUnreachable(account.type);
    }
  };
}
