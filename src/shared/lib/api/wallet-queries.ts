import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { MovementDirection } from "@/domain/wallet/types";
import { apiGet, ApiFailureError } from "./api-client";
import type { MovementsPage, WalletSummary } from "./views";

export const MOVEMENT_FILTER = {
  ALL: "all",
  DEBIT: "debit",
  CREDIT: "credit",
} as const;

export type MovementFilter = (typeof MOVEMENT_FILTER)[keyof typeof MOVEMENT_FILTER];

export function parseMovementFilter(value: string | null): MovementFilter {
  if (value === MOVEMENT_FILTER.DEBIT || value === MOVEMENT_FILTER.CREDIT) {
    return value;
  }

  return MOVEMENT_FILTER.ALL;
}

export const walletQueryKeys = {
  all: ["wallet"] as const,
  summary: () => [...walletQueryKeys.all, "summary"] as const,
  movements: (filter: MovementFilter) => [...walletQueryKeys.all, "movements", filter] as const,
};

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const result = await apiGet<T>(path, { signal });

  if (!result.ok) {
    throw new ApiFailureError(result.error);
  }

  return result.value;
}

function movementDirectionParam(filter: MovementFilter): MovementDirection | undefined {
  return filter === MOVEMENT_FILTER.ALL ? undefined : filter;
}

export function walletSummaryQueryOptions() {
  return queryOptions({
    queryKey: walletQueryKeys.summary(),
    queryFn: ({ signal }) => fetchJson<WalletSummary>("/api/v1/wallet/summary", signal),
  });
}

export function movementsInfiniteQueryOptions(filter: MovementFilter) {
  return infiniteQueryOptions({
    queryKey: walletQueryKeys.movements(filter),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams();
      const direction = movementDirectionParam(filter);

      if (direction) {
        params.set("direction", direction);
      }

      if (pageParam) {
        params.set("cursor", pageParam);
      }

      const query = params.toString();

      return fetchJson<MovementsPage>(`/api/v1/wallet/movements${query ? `?${query}` : ""}`, signal);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page: MovementsPage) => page.nextCursor,
  });
}
