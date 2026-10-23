import type { ReactNode } from "react";
import { Alert } from "@/shared/ui/alert/alert";
import { ALERT_ROLE, ALERT_TONE } from "@/shared/ui/alert/types";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { SupportReference } from "@/shared/ui/support-reference/support-reference";
import styles from "./retry-alert.module.scss";

interface RetryAlertProps {
  title: ReactNode;
  retryLabel: ReactNode;
  onRetry: () => void;
  requestId?: string;
  children?: ReactNode;
}

export function RetryAlert({ title, retryLabel, onRetry, requestId, children }: RetryAlertProps) {
  return (
    <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
      <div className={styles["retry-alert"]}>
        <p className={styles["retry-alert__title"]}>{title}</p>
        {children}
        {requestId && <SupportReference requestId={requestId} />}
        <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onRetry} className={styles["retry-alert__button"]}>
          {retryLabel}
        </Button>
      </div>
    </Alert>
  );
}
