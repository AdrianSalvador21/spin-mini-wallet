"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { toMoney, type Cents } from "@/domain/money/money";
import { TRANSFER_FEE } from "@/domain/transfer/fees";
import { useAccountLabel } from "@/shared/i18n/use-account-label";
import { formatMoney, splitMoney } from "@/shared/lib/format/money";
import { Alert } from "@/shared/ui/alert/alert";
import { ALERT_TONE } from "@/shared/ui/alert/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import { SummaryList, type SummaryListItem } from "@/shared/ui/summary-list/summary-list";
import { useTransferDraft } from "../../draft/draft-store";
import { useDraftPreview } from "../../draft/preview-store";
import { TRANSFER_STEP, type TransferStep } from "../../draft/types";
import { computeBalanceAfter, useTransferBalance } from "../../hooks/use-transfer-balance";
import { WIZARD_SKELETON_WIDTH } from "../wizard-skeleton/types";
import styles from "./live-summary.module.scss";

interface LiveSummaryProps {
  step: Exclude<TransferStep, typeof TRANSFER_STEP.REVIEW>;
}

export function LiveSummary({ step }: LiveSummaryProps) {
  const t = useTranslations("transfers");
  const titleId = useId();
  const accountLabel = useAccountLabel();
  const draftAmount = useTransferDraft((draft) => draft.amountInCents);
  const draftRecipient = useTransferDraft((draft) => draft.recipient);
  const previewAmount = useDraftPreview((preview) => preview.amountInCents);
  const previewRecipient = useDraftPreview((preview) => preview.recipient);
  const amountInCents = previewAmount === undefined ? draftAmount : previewAmount;
  const recipient = previewRecipient === undefined ? draftRecipient : previewRecipient;
  const { summary, balance } = useTransferBalance();
  const shownAmount = amountInCents ?? (0 as Cents);
  const { whole, cents } = splitMoney(toMoney(shownAmount));

  function balanceAfterValue() {
    if (balance) {
      return formatMoney(computeBalanceAfter(balance, shownAmount));
    }

    return (
      <Skeleton
        shape={SKELETON_SHAPE.LINE}
        size={SKELETON_SIZE.MD}
        width={WIZARD_SKELETON_WIDTH.SUMMARY_VALUE}
        className={styles["live-summary__value-skeleton"]}
      />
    );
  }

  const items: SummaryListItem[] = [];

  if (step === TRANSFER_STEP.RECIPIENT && recipient) {
    items.push(
      { key: "to", label: t("review.to"), value: recipient.name },
      { key: "account", label: t("review.account"), value: accountLabel(recipient.account) },
    );
  }

  items.push({ key: "fee", label: t("review.fee"), value: formatMoney(TRANSFER_FEE) });

  if (!summary.isError) {
    items.push({ key: "balanceAfter", label: t("review.balanceAfter"), value: balanceAfterValue() });
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
