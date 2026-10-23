"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toMoney } from "@/domain/money/money";
import { ROUTES } from "@/shared/lib/routes";
import { useTransferDraft } from "../../draft/draft-store";
import { useSubmissionStore } from "../../submission/submission-store";
import { SUBMISSION_STATUS } from "../../submission/types";
import { useTransferSubmission } from "../../submission/use-transfer-submission";
import { ProcessingDialog } from "../processing-dialog/processing-dialog";
import { ReviewStep } from "../review-step/review-step";
import { TransferOutcome } from "../transfer-outcome/transfer-outcome";

function resetOnUnmount() {
  if (useSubmissionStore.getState().state.status === SUBMISSION_STATUS.SUCCEEDED) {
    useTransferDraft.getState().reset();
  }

  useSubmissionStore.getState().reset();
}

export function TransferConfirmation() {
  const router = useRouter();
  const { state, submit, checkStatus, retry, dismiss } = useTransferSubmission();
  const amountInCents = useTransferDraft((draft) => draft.amountInCents);
  const recipient = useTransferDraft((draft) => draft.recipient);

  useEffect(() => resetOnUnmount, []);

  if (state.status === SUBMISSION_STATUS.FAILED) {
    return (
      <TransferOutcome
        outcome={state.outcome}
        onRetry={() => void retry()}
        onCheckStatus={() => void checkStatus()}
        onChangeAmount={() => {
          dismiss();
          router.push(ROUTES.TRANSFER_AMOUNT);
        }}
      />
    );
  }

  return (
    <>
      <ReviewStep onConfirm={(draft) => void submit(draft)} />
      {amountInCents !== null && recipient !== null ? (
        <ProcessingDialog status={state.status} amount={toMoney(amountInCents)} recipientName={recipient.name} />
      ) : null}
    </>
  );
}
