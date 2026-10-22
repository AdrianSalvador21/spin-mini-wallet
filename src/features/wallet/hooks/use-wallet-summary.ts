"use client";

import { useQuery } from "@tanstack/react-query";
import { walletSummaryQueryOptions } from "@/shared/lib/api/wallet-queries";

export function useWalletSummary() {
  return useQuery(walletSummaryQueryOptions());
}
