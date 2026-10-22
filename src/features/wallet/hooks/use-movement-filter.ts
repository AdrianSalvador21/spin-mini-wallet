"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { MOVEMENT_FILTER, parseMovementFilter, type MovementFilter } from "@/shared/lib/api/wallet-queries";

export function useMovementFilter(): [MovementFilter, (filter: MovementFilter) => void] {
  const searchParams = useSearchParams();
  const filter = parseMovementFilter(searchParams.get("direction"));

  const setFilter = useCallback(
    (next: MovementFilter) => {
      const params = new URLSearchParams(searchParams.toString());

      if (next === MOVEMENT_FILTER.ALL) {
        params.delete("direction");
      } else {
        params.set("direction", next);
      }

      const query = params.toString();

      window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [searchParams],
  );

  return [filter, setFilter];
}
