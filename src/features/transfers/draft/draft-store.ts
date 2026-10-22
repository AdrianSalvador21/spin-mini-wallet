import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { onClientSessionClear, safeSessionStorage, SESSION_STORAGE_KEY } from "@/shared/lib/session-storage/client-session";
import type { DraftRecipient, TransferDraftState, TransferDraftStore } from "./types";

export const DRAFT_STORAGE_VERSION = 1;

export const EMPTY_DRAFT: TransferDraftState = {
  ownerId: null,
  amountInCents: null,
  concept: "",
  recipient: null,
  idempotencyKey: null,
};

function sameRecipient(a: DraftRecipient | null, b: DraftRecipient): boolean {
  return a !== null && a.contactId === b.contactId;
}

export function selectDraftState({
  ownerId,
  amountInCents,
  concept,
  recipient,
  idempotencyKey,
}: TransferDraftState): TransferDraftState {
  return { ownerId, amountInCents, concept, recipient, idempotencyKey };
}

export const useTransferDraft = create<TransferDraftStore>()(
  persist<TransferDraftStore, [], [], TransferDraftState>(
    (set, get) => ({
      ...EMPTY_DRAFT,
      claim(ownerId) {
        const current = get().ownerId;

        if (current === ownerId) {
          return;
        }

        set(current === null ? { ownerId } : { ...EMPTY_DRAFT, ownerId });
      },
      setAmount(amountInCents, concept) {
        const draft = get();
        const unchanged = draft.amountInCents === amountInCents && draft.concept === concept;

        set({ amountInCents, concept, idempotencyKey: unchanged ? draft.idempotencyKey : null });
      },
      setRecipient(recipient) {
        const draft = get();

        set({ recipient, idempotencyKey: sameRecipient(draft.recipient, recipient) ? draft.idempotencyKey : null });
      },
      ensureIdempotencyKey() {
        const stored = get().idempotencyKey;

        if (stored) {
          return stored;
        }

        const idempotencyKey = crypto.randomUUID();
        set({ idempotencyKey });

        return idempotencyKey;
      },
      reset() {
        set(EMPTY_DRAFT);
      },
    }),
    {
      name: SESSION_STORAGE_KEY.TRANSFER_DRAFT,
      storage: createJSONStorage(() => safeSessionStorage),
      version: DRAFT_STORAGE_VERSION,
      skipHydration: true,
      partialize: selectDraftState,
      migrate: () => EMPTY_DRAFT,
    },
  ),
);

onClientSessionClear(() => {
  useTransferDraft.setState(EMPTY_DRAFT);
});
