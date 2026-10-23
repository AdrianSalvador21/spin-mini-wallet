import { useCallback, useSyncExternalStore } from "react";

export const MEDIA_QUERY = {
  LG: "(min-width: 1024px)",
} as const;

export type MediaQuery = (typeof MEDIA_QUERY)[keyof typeof MEDIA_QUERY];

function matches(query: MediaQuery): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

export function useMediaQuery(query: MediaQuery): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") {
        return () => undefined;
      }

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);

      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
}
