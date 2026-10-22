"use client";

import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useWalletSummary } from "@/features/wallet/hooks/use-wallet-summary";
import { SummaryError } from "@/features/wallet/components/summary-error/summary-error";
import { API_FAILURE_KIND, ApiFailureError } from "@/shared/lib/api/api-client";
import { splitMoney } from "@/shared/lib/format/money";
import { writeBalanceHidden } from "@/shared/lib/preferences/balance-visibility";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./balance-card.module.scss";

const TRANSFER_AMOUNT_ROUTE = "/transfers/new/amount" as Route;

interface BalanceCardProps {
  initialHidden: boolean;
}

export function BalanceCard({ initialHidden }: BalanceCardProps) {
  const t = useTranslations("home.balance");
  const { data, isPending, isError, error, refetch } = useWalletSummary();
  const [hidden, setHidden] = useState(initialHidden);

  function toggleHidden() {
    const next = !hidden;

    setHidden(next);
    writeBalanceHidden(next);
  }

  const requestId =
    error instanceof ApiFailureError && error.failure.kind === API_FAILURE_KIND.API
      ? error.failure.requestId
      : undefined;

  return (
    <section className={styles["balance-card"]} aria-label={t("label")}>
      <div className={styles["balance-card__row"]}>
        <p className={styles["balance-card__label"]}>{t("label")}</p>
        <button
          type={BUTTON_TYPE.BUTTON}
          className={styles["balance-card__eye"]}
          aria-pressed={hidden}
          aria-label={hidden ? t("show") : t("hide")}
          onClick={toggleHidden}
        >
          <Icon name={hidden ? ICON_NAME.EYE_OFF : ICON_NAME.EYE} />
        </button>
      </div>

      {isPending ? (
        <div className={styles["balance-card__skeleton"]}>
          <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="60%" />
        </div>
      ) : isError || !data ? (
        <SummaryError requestId={requestId} onRetry={() => refetch()} />
      ) : hidden ? (
        <p className={styles["balance-card__amount"]} aria-label={t("hiddenLabel")}>
          {t("hiddenAmount")}
        </p>
      ) : (
        <BalanceAmount amount={data.balance} />
      )}

      <Button variant={BUTTON_VARIANT.PRIMARY} href={TRANSFER_AMOUNT_ROUTE} block>
        <Icon name={ICON_NAME.SEND} />
        {t("send")}
      </Button>
    </section>
  );
}

function BalanceAmount({ amount }: { amount: Parameters<typeof splitMoney>[0] }) {
  const { whole, cents } = splitMoney(amount);

  return (
    <p className={styles["balance-card__amount"]}>
      {whole}
      <span className={styles["balance-card__cents"]}>{cents}</span>
    </p>
  );
}
