import { useMutation } from "@tanstack/react-query";
import { ApiFailureError, apiGet } from "@/shared/lib/api/api-client";
import { createRequestId } from "@/shared/lib/api/request-id";
import type { TransferView } from "@/shared/lib/api/views";
import { TRANSFER_TIMEOUT_MS, transferLookupPath } from "./transfer-requests";

async function lookupTransfer(idempotencyKey: string): Promise<TransferView> {
  const result = await apiGet<TransferView>(transferLookupPath(idempotencyKey), {
    timeoutMs: TRANSFER_TIMEOUT_MS,
    requestId: createRequestId(),
  });

  if (!result.ok) {
    throw new ApiFailureError(result.error);
  }

  return result.value;
}

export function useTransferLookup() {
  return useMutation<TransferView, ApiFailureError, string>({
    mutationFn: lookupTransfer,
    retry: false,
  });
}
