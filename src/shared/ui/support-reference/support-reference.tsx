"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import styles from "./support-reference.module.scss";
import { COPY_FEEDBACK, COPY_FEEDBACK_MS, type CopyFeedback } from "./types";

interface SupportReferenceProps {
  requestId: string;
  className?: string;
}

export function SupportReference({ requestId, className }: SupportReferenceProps) {
  const t = useTranslations("common.supportReference");
  const [feedback, setFeedback] = useState<CopyFeedback>(COPY_FEEDBACK.IDLE);

  useEffect(() => {
    if (feedback === COPY_FEEDBACK.IDLE) {
      return;
    }

    const timer = setTimeout(() => setFeedback(COPY_FEEDBACK.IDLE), COPY_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [feedback]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(requestId);
      setFeedback(COPY_FEEDBACK.COPIED);
    } catch {
      setFeedback(COPY_FEEDBACK.FAILED);
    }
  }

  const copied = feedback === COPY_FEEDBACK.COPIED;
  const failed = feedback === COPY_FEEDBACK.FAILED;

  return (
    <div className={[styles["support-reference"], className].filter(Boolean).join(" ")}>
      <p className={styles["support-reference__text"]}>
        {t("label")} <code className={styles["support-reference__code"]}>{requestId}</code>
      </p>
      <button
        type={BUTTON_TYPE.BUTTON}
        aria-label={t("copyLabel")}
        onClick={copy}
        className={styles["support-reference__copy"]}
      >
        <Icon name={copied ? ICON_NAME.CHECK : ICON_NAME.COPY} size={ICON_SIZE.SM} />
        {copied ? t("copied") : t("copy")}
      </button>
      <span
        role="status"
        className={[styles["support-reference__status"], !failed && styles["support-reference__status--hidden"]]
          .filter(Boolean)
          .join(" ")}
      >
        {copied && t("copied")}
        {failed && t("copyFailed")}
      </span>
    </div>
  );
}
