import { useEffect, useSyncExternalStore } from "react";
import { useTransferDraft } from "./draft-store";

function subscribe(onChange: () => void): () => void {
  return useTransferDraft.persist.onFinishHydration(onChange);
}

function getSnapshot(): boolean {
  return useTransferDraft.persist.hasHydrated();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useDraftHydration(): boolean {
  const hydrated = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!useTransferDraft.persist.hasHydrated()) {
      void useTransferDraft.persist.rehydrate();
    }
  }, []);

  return hydrated;
}
