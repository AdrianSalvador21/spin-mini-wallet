"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { useAccountLabel } from "@/shared/i18n/use-account-label";
import type { TransferView } from "@/shared/lib/api/views";
import { formatReceiptDate } from "@/shared/lib/format/date";
import { formatMoney } from "@/shared/lib/format/money";
import { ROUTES } from "@/shared/lib/routes";
import { ActionBar } from "@/shared/ui/action-bar/action-bar";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import { SummaryList, type SummaryListItem } from "@/shared/ui/summary-list/summary-list";
import { SHARE_FEEDBACK, useShareReceipt, type ShareFeedback } from "../../hooks/use-share-receipt";
import styles from "./transfer-receipt.module.scss";

interface TransferReceiptProps {
  transfer: TransferView;
}

export function TransferReceipt({ transfer }: TransferReceiptProps) {
  const t = useTranslations("transfers.receipt");
  const accountLabel = useAccountLabel();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { feedback, share } = useShareReceipt(transfer);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function feedbackMessage(value: ShareFeedback): string | null {
    switch (value) {
      case SHARE_FEEDBACK.IDLE:
        return null;
      case SHARE_FEEDBACK.COPIED:
        return t("shared");
      case SHARE_FEEDBACK.FAILED:
        return t("shareFailed");
      default:
        return assertUnreachable(value);
    }
  }

  const { account } = transfer.recipient;
  const items: SummaryListItem[] = [
    { key: "to", label: t("to"), value: transfer.recipient.name },
    {
      key: "account",
      label: t("account"),
      value: (
        <>
          {accountLabel(account)}
          {account.bankName ? <span className={styles["transfer-receipt__bank"]}>{account.bankName}</span> : null}
        </>
      ),
    },
  ];

  if (transfer.concept) {
    items.push({ key: "concept", label: t("concept"), value: transfer.concept });
  }

  items.push(
    { key: "folio", label: t("folio"), value: transfer.folio },
    { key: "trackingKey", label: t("trackingKey"), value: transfer.trackingKey },
  );

  return (
    <div className={styles["transfer-receipt"]}>
      <section className={styles["transfer-receipt__card"]}>
        <div className={styles["transfer-receipt__head"]}>
          <span className={styles["transfer-receipt__icon"]}>
            <Icon name={ICON_NAME.CHECK} size={ICON_SIZE.XL} />
          </span>
          <div role="status">
            <h1 ref={titleRef} tabIndex={-1} className={styles["transfer-receipt__title"]}>
              {t("title")}
            </h1>
          </div>
          <p className={styles["transfer-receipt__amount"]}>{formatMoney(transfer.amount)}</p>
          <p className={styles["transfer-receipt__date"]}>{formatReceiptDate(transfer.createdAt)}</p>
        </div>
        <SummaryList items={items} className={styles["transfer-receipt__rows"]} />
        <p role="status" className={styles["transfer-receipt__feedback"]}>
          {feedbackMessage(feedback)}
        </p>
      </section>

      <ActionBar className={styles["transfer-receipt__actions"]}>
        <Button variant={BUTTON_VARIANT.SECONDARY} block onClick={() => void share()}>
          <Icon name={ICON_NAME.SHARE} size={ICON_SIZE.SM} />
          <span className={styles["transfer-receipt__share-full"]}>{t("share")}</span>
          <span className={styles["transfer-receipt__share-short"]}>{t("shareShort")}</span>
        </Button>
        <Button variant={BUTTON_VARIANT.PRIMARY} block href={ROUTES.HOME}>
          {t("home")}
        </Button>
      </ActionBar>
    </div>
  );
}
