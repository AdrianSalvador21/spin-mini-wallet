"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import type { Money } from "@/domain/money/money";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { formatMoney } from "@/shared/lib/format/money";
import { ROUTES } from "@/shared/lib/routes";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT, type ButtonVariant } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE, type IconName } from "@/shared/ui/icon/types";
import { SupportReference } from "@/shared/ui/support-reference/support-reference";
import { TRANSFER_OUTCOME, type TransferOutcome as Outcome } from "../../submission/types";
import styles from "./transfer-outcome.module.scss";
import { OUTCOME_TONE, type OutcomeTone } from "./types";

interface TransferOutcomeProps {
  outcome: Outcome;
  onRetry: () => void;
  onCheckStatus: () => void;
  onChangeAmount: () => void;
}

interface OutcomeView {
  icon: IconName;
  tone: OutcomeTone;
  title: string;
  text: string;
  primary: ReactNode;
  secondary?: ReactNode;
  footer?: ReactNode;
  requestId?: string;
}

type Translate = ReturnType<typeof useTranslations<"transfers.outcomes">>;

function insufficientFundsText(t: Translate, amount: Money, balance?: Money): string {
  if (!balance) {
    return t("insufficientFunds.generic");
  }

  if (balance.amountInCents < amount.amountInCents) {
    return t("insufficientFunds.changed", { balance: formatMoney(balance), amount: formatMoney(amount) });
  }

  return t("insufficientFunds.simulated", { balance: formatMoney(balance) });
}

export function TransferOutcome({ outcome, onRetry, onCheckStatus, onChangeAmount }: TransferOutcomeProps) {
  const t = useTranslations("transfers.outcomes");
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [outcome.kind]);

  function action(variant: ButtonVariant, label: string, onClick: () => void) {
    return (
      <Button variant={variant} block onClick={onClick}>
        {label}
      </Button>
    );
  }

  function home(variant: ButtonVariant) {
    return (
      <Button variant={variant} block href={ROUTES.HOME}>
        {t("actions.home")}
      </Button>
    );
  }

  function view(): OutcomeView {
    switch (outcome.kind) {
      case TRANSFER_OUTCOME.NETWORK_ERROR:
        return {
          icon: ICON_NAME.WIFI,
          tone: OUTCOME_TONE.DANGER,
          title: t("networkError.title"),
          text: t("networkError.text"),
          primary: action(BUTTON_VARIANT.PRIMARY, t("actions.retry"), onRetry),
          secondary: home(BUTTON_VARIANT.GHOST),
          requestId: outcome.requestId,
        };
      case TRANSFER_OUTCOME.INSUFFICIENT_FUNDS:
        return {
          icon: ICON_NAME.WALLET,
          tone: OUTCOME_TONE.DANGER,
          title: t("insufficientFunds.title"),
          text: insufficientFundsText(t, outcome.amount, outcome.balance),
          primary: action(BUTTON_VARIANT.PRIMARY, t("actions.changeAmount"), onChangeAmount),
          secondary: home(BUTTON_VARIANT.GHOST),
        };
      case TRANSFER_OUTCOME.TIMEOUT:
        return {
          icon: ICON_NAME.CLOCK,
          tone: OUTCOME_TONE.WARNING,
          title: t("timeout.title"),
          text: t("timeout.text"),
          primary: action(BUTTON_VARIANT.PRIMARY, t("actions.checkStatus"), onCheckStatus),
          secondary: home(BUTTON_VARIANT.GHOST),
          requestId: outcome.requestId,
        };
      case TRANSFER_OUTCOME.NOT_FOUND_YET:
        return {
          icon: ICON_NAME.CLOCK,
          tone: OUTCOME_TONE.WARNING,
          title: t("notFoundYet.title"),
          text: t("notFoundYet.text"),
          primary: action(BUTTON_VARIANT.PRIMARY, t("actions.checkAgain"), onCheckStatus),
          secondary: action(BUTTON_VARIANT.SECONDARY, t("actions.retry"), onRetry),
          footer: home(BUTTON_VARIANT.GHOST),
          requestId: outcome.requestId,
        };
      case TRANSFER_OUTCOME.UNKNOWN_ERROR:
        return {
          icon: ICON_NAME.ALERT,
          tone: OUTCOME_TONE.DANGER,
          title: t("unknownError.title"),
          text: t("unknownError.text"),
          primary: home(BUTTON_VARIANT.PRIMARY),
          requestId: outcome.requestId,
        };
      default:
        return assertUnreachable(outcome);
    }
  }

  const { icon, tone, title, text, primary, secondary, footer, requestId } = view();

  return (
    <div className={styles["transfer-outcome"]} role="alert">
      <span className={[styles["transfer-outcome__icon"], styles[`transfer-outcome__icon--${tone}`]].join(" ")}>
        <Icon name={icon} size={ICON_SIZE.XL} />
      </span>
      <h1 ref={titleRef} tabIndex={-1} className={styles["transfer-outcome__title"]}>
        {title}
      </h1>
      <p className={styles["transfer-outcome__text"]}>{text}</p>
      <div
        className={[styles["transfer-outcome__actions"], !secondary && styles["transfer-outcome__actions--single"]]
          .filter(Boolean)
          .join(" ")}
      >
        {primary}
        {secondary}
      </div>
      {footer ? <div className={styles["transfer-outcome__footer"]}>{footer}</div> : null}
      {requestId ? (
        <SupportReference requestId={requestId} className={styles["transfer-outcome__reference"]} />
      ) : null}
    </div>
  );
}
