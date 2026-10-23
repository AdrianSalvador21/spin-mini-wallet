"use client";

import { MutationCache, QueryCache, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { ROUTES } from "@/shared/lib/routes";
import { API_FAILURE_KIND, ApiFailureError } from "../api/api-client";
import { clearClientSession } from "../session-storage/client-session";
import { makeQueryClient } from "./query-client";

function handleQueryError(error: unknown): void {
  if (
    error instanceof ApiFailureError &&
    error.failure.kind === API_FAILURE_KIND.API &&
    error.failure.code === API_ERROR_CODE.UNAUTHORIZED
  ) {
    clearClientSession();
    window.location.replace(ROUTES.SESSION_END);
  }
}

function createBrowserQueryClient() {
  return makeQueryClient({
    queryCache: new QueryCache({ onError: handleQueryError }),
    mutationCache: new MutationCache({ onError: handleQueryError }),
  });
}

export interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(createBrowserQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
