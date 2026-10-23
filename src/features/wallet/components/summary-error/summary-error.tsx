"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { SupportReference } from "@/shared/ui/support-reference/support-reference";
import styles from "./summary-error.module.scss";

interface SummaryErrorProps {
  requestId?: string;
  onRetry: () => void;
}

export function SummaryError({ requestId, onRetry }: SummaryErrorProps) {
  const t = useTranslations("home.balance.error");

  return (
    <div className={styles["summary-error"]} role="alert">
      <p className={styles["summary-error__title"]}>{t("title")}</p>
      <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onRetry}>
        {t("retry")}
      </Button>
      {requestId && <SupportReference requestId={requestId} />}
    </div>
  );
}
