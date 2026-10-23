import { create } from "zustand";
import { onClientSessionClear } from "@/shared/lib/session-storage/client-session";
import { SUBMISSION_STATUS, type SubmissionState } from "./types";

export const IDLE_SUBMISSION: SubmissionState = { status: SUBMISSION_STATUS.IDLE };

interface SubmissionStore {
  state: SubmissionState;
  set(state: SubmissionState): void;
  reset(): void;
}

export const useSubmissionStore = create<SubmissionStore>()((set) => ({
  state: IDLE_SUBMISSION,
  set(state) {
    set({ state });
  },
  reset() {
    set({ state: IDLE_SUBMISSION });
  },
}));

onClientSessionClear(() => {
  useSubmissionStore.getState().reset();
});
