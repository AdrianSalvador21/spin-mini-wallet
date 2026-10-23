"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import type { Money } from "@/domain/money/money";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { formatMoney } from "@/shared/lib/format/money";
import { getFirstName } from "@/shared/lib/format/name";
import { BrandLogo } from "@/shared/ui/brand-logo/brand-logo";
import { BRAND_LOGO_SIZE } from "@/shared/ui/brand-logo/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import { SUBMISSION_STATUS, type SubmissionStatus } from "../../submission/types";
import styles from "./processing-dialog.module.scss";

interface ProcessingDialogProps {
  status: SubmissionStatus;
  amount: Money;
  recipientName: string;
}

function isOpen(status: SubmissionStatus): boolean {
  switch (status) {
    case SUBMISSION_STATUS.PROCESSING:
    case SUBMISSION_STATUS.CHECKING:
    case SUBMISSION_STATUS.SUCCEEDED:
      return true;
    case SUBMISSION_STATUS.IDLE:
    case SUBMISSION_STATUS.FAILED:
      return false;
    default:
      return assertUnreachable(status);
  }
}

export function ProcessingDialog({ status, amount, recipientName }: ProcessingDialogProps) {
  const t = useTranslations("transfers.processing");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = isOpen(status);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const title =
    status === SUBMISSION_STATUS.CHECKING
      ? t("checking")
      : t("sending", { amount: formatMoney(amount), name: getFirstName(recipientName) });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-busy="true"
      className={styles["processing-dialog"]}
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles["processing-dialog__content"]}>
        <div className={styles["processing-dialog__orbit"]} role="progressbar" aria-label={t("progress")}>
          <svg className={styles["processing-dialog__arcs"]} viewBox="0 0 132 132" fill="none" aria-hidden="true">
            <path d="M22 50 A48 48 0 0 1 96 24" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            <circle cx="108" cy="34" r="9" fill="currentColor" />
            <path d="M110 82 A48 48 0 0 1 36 108" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          </svg>
          <span className={styles["processing-dialog__core"]}>
            <Icon name={ICON_NAME.SEND} size={ICON_SIZE.XL} />
          </span>
        </div>
        <p id={titleId} className={styles["processing-dialog__title"]}>
          {title}
        </p>
        <p className={styles["processing-dialog__text"]}>{t("text")}</p>
        <BrandLogo size={BRAND_LOGO_SIZE.SM} className={styles["processing-dialog__logo"]} />
      </div>
    </dialog>
  );
}
