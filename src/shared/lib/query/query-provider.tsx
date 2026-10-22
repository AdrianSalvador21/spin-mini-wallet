"use client";

import { QueryCache, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { API_FAILURE_KIND, ApiFailureError } from "../api/api-client";
import { makeQueryClient } from "./query-client";

function handleQueryError(error: unknown): void {
  if (
    error instanceof ApiFailureError &&
    error.failure.kind === API_FAILURE_KIND.API &&
    error.failure.code === API_ERROR_CODE.UNAUTHORIZED
  ) {
    window.location.assign("/login");
  }
}

function createBrowserQueryClient() {
  return makeQueryClient({ queryCache: new QueryCache({ onError: handleQueryError }) });
}

export interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(createBrowserQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
