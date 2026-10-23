import { describe, expect, it } from "vitest";
import { API_FAILURE_KIND, ApiFailureError } from "../api/api-client";
import { makeQueryClient } from "./query-client";

describe("makeQueryClient", () => {
  it("sets a 30 second stale time by default", () => {
    const client = makeQueryClient();

    expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it("retries exactly once for a network failure", () => {
    const client = makeQueryClient();
    const retry = client.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;
    const networkError = new ApiFailureError({ kind: API_FAILURE_KIND.NETWORK });

    expect(retry(0, networkError)).toBe(true);
    expect(retry(1, networkError)).toBe(false);
  });

  it("never retries an api failure", () => {
    const client = makeQueryClient();
    const retry = client.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;
    const apiError = new ApiFailureError({
      kind: API_FAILURE_KIND.API,
      status: 503,
      code: "UPSTREAM_UNAVAILABLE",
      requestId: "req-1",
    });

    expect(retry(0, apiError)).toBe(false);
  });
});
