import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { API_FAILURE_KIND, ApiFailureError } from "../api/api-client";

const STALE_TIME_MS = 30_000;
const MAX_NETWORK_RETRIES = 1;

function isRetriableFailure(error: unknown): boolean {
  return error instanceof ApiFailureError && error.failure.kind === API_FAILURE_KIND.NETWORK;
}

export interface MakeQueryClientOptions {
  queryCache?: QueryCache;
  mutationCache?: MutationCache;
}

export function makeQueryClient(options: MakeQueryClientOptions = {}): QueryClient {
  return new QueryClient({
    queryCache: options.queryCache,
    mutationCache: options.mutationCache,
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: (failureCount, error) => failureCount < MAX_NETWORK_RETRIES && isRetriableFailure(error),
      },
    },
  });
}
