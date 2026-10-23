"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useWalletSummary } from "@/features/wallet/hooks/use-wallet-summary";
import { SummaryError } from "@/features/wallet/components/summary-error/summary-error";
import { API_FAILURE_KIND, ApiFailureError } from "@/shared/lib/api/api-client";
import type { WalletSummary } from "@/shared/lib/api/views";
import { splitMoney } from "@/shared/lib/format/money";
import { writeBalanceHidden } from "@/shared/lib/preferences/balance-visibility";
import { ROUTES } from "@/shared/lib/routes";
import { BrandLogo } from "@/shared/ui/brand-logo/brand-logo";
import { BRAND_LOGO_SIZE } from "@/shared/ui/brand-logo/types";
import { BrandRings } from "@/shared/ui/brand-rings/brand-rings";
import { RINGS_PLACEMENT, RINGS_SIZE } from "@/shared/ui/brand-rings/types";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./balance-card.module.scss";

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

  const eyeButton = (
    <button
      type={BUTTON_TYPE.BUTTON}
      className={styles["balance-card__eye"]}
      aria-pressed={hidden}
      aria-label={hidden ? t("show") : t("hide")}
      onClick={toggleHidden}
    >
      <Icon name={hidden ? ICON_NAME.EYE_OFF : ICON_NAME.EYE} />
    </button>
  );

  return (
    <section className={styles["balance-card"]} aria-label={t("label")}>
      {data && !isError ? (
        <BrandPanel summary={data} hidden={hidden} eyeButton={eyeButton} />
      ) : (
        <div className={styles["balance-card__panel"]}>
          <div className={styles["balance-card__row"]}>
            <p className={styles["balance-card__label"]}>{t("label")}</p>
            {eyeButton}
          </div>
          {isPending ? (
            <div className={styles["balance-card__skeleton"]}>
              <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="60%" />
            </div>
          ) : (
            <SummaryError requestId={requestId} onRetry={() => refetch()} />
          )}
        </div>
      )}

      <Button variant={BUTTON_VARIANT.PRIMARY} href={ROUTES.TRANSFER_AMOUNT} block>
        <Icon name={ICON_NAME.SEND} />
        {t("send")}
      </Button>
    </section>
  );
}

interface BrandPanelProps {
  summary: WalletSummary;
  hidden: boolean;
  eyeButton: ReactNode;
}

function BrandPanel({ summary, hidden, eyeButton }: BrandPanelProps) {
  const t = useTranslations("home.balance");

  return (
    <div className={`${styles["balance-card__panel"]} ${styles["balance-card__panel--brand"]}`}>
      <BrandRings placement={RINGS_PLACEMENT.BOTTOM_RIGHT} size={RINGS_SIZE.MD} />
      <div className={styles["balance-card__row"]}>
        <p className={styles["balance-card__label"]}>{t("label")}</p>
        {eyeButton}
      </div>
      {hidden ? (
        <p className={styles["balance-card__amount"]} aria-label={t("hiddenLabel")}>
          {t("hiddenAmount")}
        </p>
      ) : (
        <BalanceAmount amount={summary.balance} />
      )}
      <div className={styles["balance-card__footer"]}>
        <p className={styles["balance-card__account"]}>{t("account", { masked: summary.user.maskedPhone })}</p>
        <BrandLogo onDark size={BRAND_LOGO_SIZE.XS} className={styles["balance-card__logo"]} />
      </div>
    </div>
  );
}

function BalanceAmount({ amount }: { amount: WalletSummary["balance"] }) {
  const { whole, cents } = splitMoney(amount);

  return (
    <p className={styles["balance-card__amount"]}>
      {whole}
      <span className={styles["balance-card__cents"]}>{cents}</span>
    </p>
  );
}
