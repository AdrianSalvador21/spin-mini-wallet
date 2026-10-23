"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { movementsInfiniteQueryOptions, type MovementFilter } from "@/shared/lib/api/wallet-queries";

export function useMovements(filter: MovementFilter) {
  const query = useInfiniteQuery(movementsInfiniteQueryOptions(filter));
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return { ...query, items };
}
