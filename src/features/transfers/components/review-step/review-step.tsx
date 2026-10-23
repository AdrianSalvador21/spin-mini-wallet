"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toMoney, type Money } from "@/domain/money/money";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { TRANSFER_FEE } from "@/domain/transfer/fees";
import { TRANSFER_RULE_VIOLATION, validateTransfer, type TransferRuleViolation } from "@/domain/transfer/rules";
import { TRANSFER_RECIPIENT_KIND } from "@/domain/transfer/types";
import { useAccountLabel } from "@/shared/i18n/use-account-label";
import { useValidationMessage } from "@/shared/i18n/use-validation-message";
import { getRequestId } from "@/shared/lib/api/api-client";
import { formatMoney, splitMoney } from "@/shared/lib/format/money";
import { ROUTES } from "@/shared/lib/routes";
import { Alert } from "@/shared/ui/alert/alert";
import { ALERT_ROLE, ALERT_TONE } from "@/shared/ui/alert/types";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import { SummaryList, type SummaryListItem } from "@/shared/ui/summary-list/summary-list";
import { useTransferDraft } from "../../draft/draft-store";
import { TRANSFER_STEP_ROUTE } from "../../draft/step-guard";
import { TRANSFER_STEP, type DraftRecipient, type ValidTransferDraft } from "../../draft/types";
import { useStepGuard } from "../../draft/use-step-guard";
import { computeBalanceAfter, useTransferBalance } from "../../hooks/use-transfer-balance";
import { RetryAlert } from "../retry-alert/retry-alert";
import { WizardActions } from "../wizard-actions/wizard-actions";
import { WizardSkeleton } from "../wizard-skeleton/wizard-skeleton";
import { WIZARD_SKELETON_WIDTH } from "../wizard-skeleton/types";
import styles from "./review-step.module.scss";

interface ReviewStepProps {
  onConfirm: (draft: ValidTransferDraft) => void;
}

export function ReviewStep({ onConfirm }: ReviewStepProps) {
  const ready = useStepGuard(TRANSFER_STEP.REVIEW);
  const amountInCents = useTransferDraft((draft) => draft.amountInCents);
  const recipient = useTransferDraft((draft) => draft.recipient);

  if (!ready || amountInCents === null || recipient === null) {
    return <WizardSkeleton />;
  }

  return <ReviewContent amount={toMoney(amountInCents)} recipient={recipient} onConfirm={onConfirm} />;
}

function fixRouteFor(violation: TransferRuleViolation) {
  switch (violation) {
    case TRANSFER_RULE_VIOLATION.AMOUNT_NOT_POSITIVE:
    case TRANSFER_RULE_VIOLATION.INSUFFICIENT_FUNDS:
      return TRANSFER_STEP_ROUTE[TRANSFER_STEP.AMOUNT];
    case TRANSFER_RULE_VIOLATION.RECIPIENT_REQUIRED:
      return TRANSFER_STEP_ROUTE[TRANSFER_STEP.RECIPIENT];
    default:
      return assertUnreachable(violation);
  }
}

interface ReviewContentProps {
  amount: Money;
  recipient: DraftRecipient;
  onConfirm: (draft: ValidTransferDraft) => void;
}

function ReviewContent({ amount, recipient, onConfirm }: ReviewContentProps) {
  const t = useTranslations("transfers");
  const accountLabel = useAccountLabel();
  const validationMessage = useValidationMessage();
  const concept = useTransferDraft((draft) => draft.concept);
  const idempotencyKey = useTransferDraft((draft) => draft.idempotencyKey);
  const ensureIdempotencyKey = useTransferDraft((draft) => draft.ensureIdempotencyKey);
  const { summary, balance } = useTransferBalance();
  const { whole, cents } = splitMoney(amount);

  useEffect(() => {
    ensureIdempotencyKey();
  }, [ensureIdempotencyKey]);

  const validation = balance
    ? validateTransfer(
        { amount, recipient: { kind: TRANSFER_RECIPIENT_KIND.CONTACT, contactId: recipient.contactId } },
        balance,
      )
    : null;
  const violations = validation && !validation.ok ? validation.error : [];
  const canConfirm = Boolean(validation?.ok && idempotencyKey);

  function violationMessage(violation: TransferRuleViolation) {
    return violation === TRANSFER_RULE_VIOLATION.INSUFFICIENT_FUNDS && balance
      ? t("amount.insufficientFunds", { balance: formatMoney(balance) })
      : validationMessage(violation);
  }

  function balanceAfterValue() {
    if (balance) {
      return formatMoney(computeBalanceAfter(balance, amount.amountInCents));
    }

    return (
      <Skeleton
        shape={SKELETON_SHAPE.LINE}
        size={SKELETON_SIZE.MD}
        width={WIZARD_SKELETON_WIDTH.SUMMARY_VALUE}
        className={styles["review-step__value-skeleton"]}
      />
    );
  }

  const items: SummaryListItem[] = [
    { key: "to", label: t("review.to"), value: recipient.name },
    {
      key: "account",
      label: t("review.account"),
      value: (
        <>
          {accountLabel(recipient.account)}
          {recipient.account.bankName ? (
            <span className={styles["review-step__bank"]}>{recipient.account.bankName}</span>
          ) : null}
        </>
      ),
    },
  ];

  if (concept) {
    items.push({ key: "concept", label: t("review.concept"), value: concept });
  }

  items.push({ key: "fee", label: t("review.fee"), value: formatMoney(TRANSFER_FEE) });

  if (!summary.isError) {
    items.push({ key: "balanceAfter", label: t("review.balanceAfter"), value: balanceAfterValue() });
  }

  function confirm() {
    if (!validation?.ok || !idempotencyKey) {
      return;
    }

    onConfirm({ amountInCents: amount.amountInCents, concept, recipient, idempotencyKey });
  }

  return (
    <div className={styles["review-step"]}>
      <div className={styles["review-step__amount"]}>
        <p className={styles["review-step__label"]}>{t("review.sending")}</p>
        <p className={styles["review-step__value"]}>
          {whole}
          <span className={styles["review-step__cents"]}>{cents}</span>
        </p>
      </div>

      <SummaryList items={items} />

      {summary.isError ? (
        <RetryAlert
          title={t("amount.balanceError")}
          retryLabel={t("amount.retry")}
          onRetry={() => void summary.refetch()}
          requestId={getRequestId(summary.error)}
        />
      ) : null}

      {violations.length > 0 ? (
        <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
          <p className={styles["review-step__alert-title"]}>{t("review.ruleFailed")}</p>
          <ul className={styles["review-step__violations"]}>
            {violations.map((violation) => (
              <li key={violation}>
                {violationMessage(violation)}{" "}
                <Link href={fixRouteFor(violation)} className={styles["review-step__fix"]}>
                  {t("review.fix")}
                </Link>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <WizardActions backHref={ROUTES.TRANSFER_AMOUNT} backLabel={t("actions.edit")} backOnMobile>
        <Button variant={BUTTON_VARIANT.PRIMARY} type={BUTTON_TYPE.BUTTON} disabled={!canConfirm} onClick={confirm}>
          {t("actions.confirm")}
        </Button>
      </WizardActions>
    </div>
  );
}
