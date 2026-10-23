"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import type { Money } from "@/domain/money/money";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { formatMoney } from "@/shared/lib/format/money";
import { getFirstName } from "@/shared/lib/format/name";
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
        <span className={styles["processing-dialog__ring"]} role="progressbar" aria-label={t("progress")} />
        <p id={titleId} className={styles["processing-dialog__title"]}>
          {title}
        </p>
        <p className={styles["processing-dialog__text"]}>{t("text")}</p>
      </div>
    </dialog>
  );
}
