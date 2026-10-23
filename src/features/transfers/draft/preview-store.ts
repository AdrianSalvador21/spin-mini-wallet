import { create } from "zustand";
import type { Cents } from "@/domain/money/money";
import type { DraftRecipient } from "./types";

interface DraftPreviewState {
  amountInCents: Cents | null | undefined;
  recipient: DraftRecipient | null | undefined;
  previewAmount(amountInCents: Cents | null | undefined): void;
  previewRecipient(recipient: DraftRecipient | null | undefined): void;
}

export const useDraftPreview = create<DraftPreviewState>()((set) => ({
  amountInCents: undefined,
  recipient: undefined,
  previewAmount(amountInCents) {
    set({ amountInCents });
  },
  previewRecipient(recipient) {
    set({ recipient });
  },
}));
