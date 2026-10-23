import { useMutation } from "@tanstack/react-query";
import { ApiFailureError, apiPost } from "@/shared/lib/api/api-client";
import { createRequestId } from "@/shared/lib/api/request-id";
import type { TransferView } from "@/shared/lib/api/views";
import type { ValidTransferDraft } from "../draft/types";
import { buildTransferPayload, TRANSFER_TIMEOUT_MS, TRANSFERS_PATH } from "./transfer-requests";

async function createTransfer(draft: ValidTransferDraft): Promise<TransferView> {
  const result = await apiPost<TransferView>(TRANSFERS_PATH, buildTransferPayload(draft), {
    timeoutMs: TRANSFER_TIMEOUT_MS,
    idempotencyKey: draft.idempotencyKey,
    requestId: createRequestId(),
  });

  if (!result.ok) {
    throw new ApiFailureError(result.error);
  }

  return result.value;
}

export function useCreateTransfer() {
  return useMutation<TransferView, ApiFailureError, ValidTransferDraft>({
    mutationFn: createTransfer,
    retry: false,
  });
}
