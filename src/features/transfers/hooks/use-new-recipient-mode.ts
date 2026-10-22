"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const RECIPIENT_MODE_PARAM = "mode";

export const RECIPIENT_MODE = {
  NEW: "new",
} as const;

export function useNewRecipientMode() {
  const searchParams = useSearchParams();
  const isNew = searchParams.get(RECIPIENT_MODE_PARAM) === RECIPIENT_MODE.NEW;

  const open = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(RECIPIENT_MODE_PARAM, RECIPIENT_MODE.NEW);
    window.history.pushState(null, "", `?${params.toString()}`);
  }, [searchParams]);

  return { isNew, open };
}
