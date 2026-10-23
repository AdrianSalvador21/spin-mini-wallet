import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { isRequestId } from "@/shared/lib/api/request-id";
import { buildTransfer, DRAFT_IDEMPOTENCY_KEY } from "@/test/factories/transfers";
import { server } from "@/test/msw/server";
import { useTransferLookup } from "./use-transfer-lookup";

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useTransferLookup(), { wrapper }).result;
}

describe("useTransferLookup", () => {
  it("looks the transfer up by idempotency key with a UUID request id", async () => {
    let lookedUp: Request | undefined;
    server.use(
      http.get("/api/v1/transfers", ({ request }) => {
        lookedUp = request;

        return HttpResponse.json(buildTransfer());
      }),
    );
    const result = setup();

    const transfer = await act(() => result.current.mutateAsync(DRAFT_IDEMPOTENCY_KEY));

    expect(transfer).toEqual(buildTransfer());
    expect(new URL(lookedUp!.url).searchParams.get("idempotencyKey")).toBe(DRAFT_IDEMPOTENCY_KEY);
    expect(isRequestId(lookedUp!.headers.get("x-request-id"))).toBe(true);
  });

  it("throws the 404 as an ApiFailureError", async () => {
    const result = setup();

    act(() => {
      result.current.mutate(DRAFT_IDEMPOTENCY_KEY);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.failure).toMatchObject({ kind: "api", status: 404, code: "NOT_FOUND" });
  });
});
