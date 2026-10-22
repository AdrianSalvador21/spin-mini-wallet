import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectDraftState, useTransferDraft } from "./draft-store";
import { resolveStepAccess, TRANSFER_STEP_ROUTE } from "./step-guard";
import type { TransferStep } from "./types";
import { useDraftHydration } from "./use-draft-hydration";

export function useStepGuard(step: TransferStep): boolean {
  const router = useRouter();
  const hydrated = useDraftHydration();
  const draft = useTransferDraft(useShallow(selectDraftState));
  const allowedStep = resolveStepAccess(step, draft);

  useEffect(() => {
    if (hydrated && allowedStep !== step) {
      router.replace(TRANSFER_STEP_ROUTE[allowedStep]);
    }
  }, [allowedStep, hydrated, router, step]);

  return hydrated && allowedStep === step;
}
