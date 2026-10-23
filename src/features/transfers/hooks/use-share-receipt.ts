import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAccountLabel } from "@/shared/i18n/use-account-label";
import type { TransferView } from "@/shared/lib/api/views";
import { formatReceiptDate } from "@/shared/lib/format/date";
import { formatMoney } from "@/shared/lib/format/money";

export const SHARE_FEEDBACK = {
  IDLE: "idle",
  COPIED: "copied",
  FAILED: "failed",
} as const;

export type ShareFeedback = (typeof SHARE_FEEDBACK)[keyof typeof SHARE_FEEDBACK];

const ABORT_ERROR = "AbortError";

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === ABORT_ERROR;
}

export function useShareReceipt(transfer: TransferView) {
  const t = useTranslations("transfers.receipt");
  const accountLabel = useAccountLabel();
  const [feedback, setFeedback] = useState<ShareFeedback>(SHARE_FEEDBACK.IDLE);

  const text = t("shareText", {
    amount: formatMoney(transfer.amount),
    name: transfer.recipient.name,
    account: accountLabel(transfer.recipient.account),
    date: formatReceiptDate(transfer.createdAt),
    folio: transfer.folio,
    trackingKey: transfer.trackingKey,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(SHARE_FEEDBACK.COPIED);
    } catch {
      setFeedback(SHARE_FEEDBACK.FAILED);
    }
  }

  async function share() {
    setFeedback(SHARE_FEEDBACK.IDLE);

    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }

    try {
      await navigator.share({ title: t("shareTitle"), text });
    } catch (error) {
      if (!isAbort(error)) {
        await copy();
      }
    }
  }

  return { text, feedback, share };
}
