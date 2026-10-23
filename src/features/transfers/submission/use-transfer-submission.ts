import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toMoney } from "@/domain/money/money";
import { API_FAILURE_KIND, ApiFailureError, type ApiFailure } from "@/shared/lib/api/api-client";
import type { TransferView, WalletSummary } from "@/shared/lib/api/views";
import { walletQueryKeys } from "@/shared/lib/api/wallet-queries";
import { transferReceiptRoute } from "@/shared/lib/routes";
import { useCreateTransfer } from "../api/use-create-transfer";
import { useTransferLookup } from "../api/use-transfer-lookup";
import { selectValidDraft, useTransferDraft } from "../draft/draft-store";
import type { ValidTransferDraft } from "../draft/types";
import { usePreventUnload } from "../hooks/use-prevent-unload";
import { reportTransferOutcome, toLookupOutcome, toTransferOutcome } from "./outcome";
import { useSubmissionStore } from "./submission-store";
import { SUBMISSION_STATUS, TRANSFER_OUTCOME, type SubmissionState, type TransferOutcome } from "./types";

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailureError ? error.failure : { kind: API_FAILURE_KIND.UNKNOWN };
}

function isBusy(state: SubmissionState): boolean {
  return state.status === SUBMISSION_STATUS.PROCESSING || state.status === SUBMISSION_STATUS.CHECKING;
}

export interface TransferSubmission {
  state: SubmissionState;
  submit(draft: ValidTransferDraft): Promise<void>;
  checkStatus(): Promise<void>;
  retry(): Promise<void>;
  dismiss(): void;
}

export function useTransferSubmission(): TransferSubmission {
  const state = useSubmissionStore((store) => store.state);
  const setState = useSubmissionStore((store) => store.set);
  const queryClient = useQueryClient();
  const router = useRouter();
  const createTransfer = useCreateTransfer();
  const lookupTransfer = useTransferLookup();

  usePreventUnload(isBusy(state));

  function succeed(transfer: TransferView) {
    void queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    setState({ status: SUBMISSION_STATUS.SUCCEEDED, transfer });
    router.replace(transferReceiptRoute(transfer.id));
  }

  function fail(outcome: TransferOutcome) {
    if (outcome.kind === TRANSFER_OUTCOME.INSUFFICIENT_FUNDS && outcome.balance) {
      const balance = outcome.balance;

      queryClient.setQueryData<WalletSummary>(walletQueryKeys.summary(), (summary) =>
        summary ? { ...summary, balance } : summary,
      );
    }

    setState({ status: SUBMISSION_STATUS.FAILED, outcome });
  }

  async function submit(draft: ValidTransferDraft) {
    if (isBusy(useSubmissionStore.getState().state)) {
      return;
    }

    setState({ status: SUBMISSION_STATUS.PROCESSING });

    try {
      succeed(await createTransfer.mutateAsync(draft));
    } catch (error) {
      const failure = toFailure(error);
      const outcome = toTransferOutcome(failure, toMoney(draft.amountInCents));

      reportTransferOutcome(outcome, failure);
      fail(outcome);
    }
  }

  async function checkStatus() {
    const draft = selectValidDraft(useTransferDraft.getState());

    if (draft === null || isBusy(useSubmissionStore.getState().state)) {
      return;
    }

    setState({ status: SUBMISSION_STATUS.CHECKING });

    try {
      succeed(await lookupTransfer.mutateAsync(draft.idempotencyKey));
    } catch (error) {
      fail(toLookupOutcome(toFailure(error)));
    }
  }

  async function retry() {
    const draft = selectValidDraft(useTransferDraft.getState());

    if (draft !== null) {
      await submit(draft);
    }
  }

  function dismiss() {
    setState({ status: SUBMISSION_STATUS.IDLE });
  }

  return { state, submit, checkStatus, retry, dismiss };
}
