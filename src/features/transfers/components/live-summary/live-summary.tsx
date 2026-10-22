"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { toMoney, type Cents } from "@/domain/money/money";
import { TRANSFER_FEE } from "@/domain/transfer/fees";
import { useAccountLabel } from "@/shared/i18n/use-account-label";
import { formatMoney, splitMoney } from "@/shared/lib/format/money";
import { Alert } from "@/shared/ui/alert/alert";
import { ALERT_TONE } from "@/shared/ui/alert/types";
import { SummaryList, type SummaryListItem } from "@/shared/ui/summary-list/summary-list";
import { useTransferDraft } from "../../draft/draft-store";
import { TRANSFER_STEP, type TransferStep } from "../../draft/types";
import { useTransferBalance } from "../../hooks/use-transfer-balance";
import styles from "./live-summary.module.scss";

interface LiveSummaryProps {
  step: Exclude<TransferStep, typeof TRANSFER_STEP.REVIEW>;
}

export function LiveSummary({ step }: LiveSummaryProps) {
  const t = useTranslations("transfers");
  const titleId = useId();
  const accountLabel = useAccountLabel();
  const amountInCents = useTransferDraft((draft) => draft.amountInCents);
  const recipient = useTransferDraft((draft) => draft.recipient);
  const { balanceAfter } = useTransferBalance();
  const { whole, cents } = splitMoney(toMoney(amountInCents ?? (0 as Cents)));

  const items: SummaryListItem[] = [];

  if (step === TRANSFER_STEP.RECIPIENT && recipient) {
    items.push(
      { key: "to", label: t("review.to"), value: recipient.name },
      { key: "account", label: t("review.account"), value: accountLabel(recipient.account) },
    );
  }

  items.push({ key: "fee", label: t("review.fee"), value: formatMoney(TRANSFER_FEE) });

  if (balanceAfter) {
    items.push({ key: "balanceAfter", label: t("review.balanceAfter"), value: formatMoney(balanceAfter) });
  }

  return (
    <aside className={styles["live-summary"]} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles["live-summary__title"]}>
        {t("summary.title")}
      </h2>
      <p className={styles["live-summary__label"]}>{t("review.sending")}</p>
      <p className={styles["live-summary__amount"]}>
        {whole}
        <span className={styles["live-summary__cents"]}>{cents}</span>
      </p>
      <SummaryList items={items} className={styles["live-summary__list"]} />
      <Alert tone={ALERT_TONE.INFO} className={styles["live-summary__note"]}>
        {t("summary.note")}
      </Alert>
    </aside>
  );
}
