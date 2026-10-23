"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE, type MovementType } from "@/domain/wallet/types";
import type { AccountView, MovementView } from "@/shared/lib/api/views";
import { DATE_GROUP_KIND, formatDayAndTime, formatTime, getDateGroup } from "@/shared/lib/format/date";
import { formatSignedMoney } from "@/shared/lib/format/money";
import { transferReceiptRoute } from "@/shared/lib/routes";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, type IconName } from "@/shared/ui/icon/types";
import styles from "./movement-row.module.scss";

export type Translator = (key: string, values?: Record<string, string | number>) => string;

export function getMovementIcon(type: MovementType): IconName {
  switch (type) {
    case MOVEMENT_TYPE.TRANSFER_OUT:
      return ICON_NAME.SEND;
    case MOVEMENT_TYPE.TRANSFER_IN:
      return ICON_NAME.ARROW_IN;
    case MOVEMENT_TYPE.CASH_DEPOSIT:
      return ICON_NAME.ARROW_IN;
    case MOVEMENT_TYPE.QR_PAYMENT:
      return ICON_NAME.STORE;
    default:
      return assertUnreachable(type);
  }
}

export function getMovementTitle(
  t: Translator,
  movement: Pick<MovementView, "type" | "counterpartyName" | "merchantName">,
): string {
  switch (movement.type) {
    case MOVEMENT_TYPE.TRANSFER_OUT:
      return movement.counterpartyName
        ? t("titles.transferOut", { name: movement.counterpartyName })
        : t("fallbackTitles.transferOut");
    case MOVEMENT_TYPE.TRANSFER_IN:
      return movement.counterpartyName
        ? t("titles.transferIn", { name: movement.counterpartyName })
        : t("fallbackTitles.transferIn");
    case MOVEMENT_TYPE.CASH_DEPOSIT:
      return movement.merchantName
        ? t("titles.cashDeposit", { merchant: movement.merchantName })
        : t("fallbackTitles.cashDeposit");
    case MOVEMENT_TYPE.QR_PAYMENT:
      return movement.merchantName
        ? t("titles.qrPayment", { merchant: movement.merchantName })
        : t("fallbackTitles.qrPayment");
    default:
      return assertUnreachable(movement.type);
  }
}

export function getAccountTypeLabel(tCommon: Translator, type: AccountView["type"]): string {
  switch (type) {
    case RECIPIENT_ACCOUNT_TYPE.PHONE:
      return tCommon("account.phone");
    case RECIPIENT_ACCOUNT_TYPE.CLABE:
      return tCommon("account.clabe");
    case RECIPIENT_ACCOUNT_TYPE.CARD:
      return tCommon("account.card");
    default:
      return assertUnreachable(type);
  }
}

export function getMovementDetail(
  t: Translator,
  tCommon: Translator,
  movement: Pick<MovementView, "type" | "counterpartyAccount">,
): string | undefined {
  switch (movement.type) {
    case MOVEMENT_TYPE.TRANSFER_OUT:
    case MOVEMENT_TYPE.TRANSFER_IN:
      return movement.counterpartyAccount
        ? `${getAccountTypeLabel(tCommon, movement.counterpartyAccount.type)} ${movement.counterpartyAccount.masked}`
        : undefined;
    case MOVEMENT_TYPE.CASH_DEPOSIT:
      return t("details.cash");
    case MOVEMENT_TYPE.QR_PAYMENT:
      return t("details.store");
    default:
      return assertUnreachable(movement.type);
  }
}

export function getMovementDate(createdAt: string, now: string): string {
  const group = getDateGroup(createdAt, now);

  switch (group.kind) {
    case DATE_GROUP_KIND.TODAY:
    case DATE_GROUP_KIND.YESTERDAY:
      return formatTime(createdAt);
    case DATE_GROUP_KIND.THIS_WEEK:
    case DATE_GROUP_KIND.MONTH:
      return formatDayAndTime(createdAt);
    default:
      return assertUnreachable(group);
  }
}

interface MovementRowProps {
  movement: MovementView;
  now: string;
}

export function MovementRow({ movement, now }: MovementRowProps) {
  const t = useTranslations("home.movements") as Translator;
  const tCommon = useTranslations("common") as Translator;
  const isCredit = movement.direction === MOVEMENT_DIRECTION.CREDIT;
  const title = getMovementTitle(t, movement);
  const detail = getMovementDetail(t, tCommon, movement);
  const date = getMovementDate(movement.createdAt, now);
  const toneClass = isCredit ? "credit" : "debit";
  const receiptId = movement.type === MOVEMENT_TYPE.TRANSFER_OUT ? movement.transferId : undefined;

  const content = (
    <>
      <span className={[styles["movement-row__icon"], styles[`movement-row__icon--${toneClass}`]].join(" ")}>
        <Icon name={getMovementIcon(movement.type)} />
      </span>
      <div className={styles["movement-row__main"]}>
        <p className={styles["movement-row__title"]}>{title}</p>
        <p className={styles["movement-row__meta"]}>{detail ? `${date} · ${detail}` : date}</p>
      </div>
      <span className={styles["movement-row__date"]}>{date}</span>
      <span className={[styles["movement-row__amount"], styles[`movement-row__amount--${toneClass}`]].join(" ")}>
        {formatSignedMoney(movement.amount, movement.direction)}
      </span>
    </>
  );

  return (
    <li className={styles["movement-row"]}>
      {receiptId ? (
        <Link
          href={transferReceiptRoute(receiptId)}
          className={[styles["movement-row__content"], styles["movement-row__content--link"]].join(" ")}
        >
          {content}
        </Link>
      ) : (
        <div className={styles["movement-row__content"]}>{content}</div>
      )}
    </li>
  );
}
