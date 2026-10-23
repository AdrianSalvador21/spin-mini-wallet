import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { isRequestId } from "@/shared/lib/api/request-id";
import { buildTransfer, buildValidDraft, DRAFT_IDEMPOTENCY_KEY } from "@/test/factories/transfers";
import { server } from "@/test/msw/server";
import { useCreateTransfer } from "./use-create-transfer";

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useCreateTransfer(), { wrapper }).result;
}

function captureRequests(): Request[] {
  const requests: Request[] = [];
  server.use(
    http.post("/api/v1/transfers", ({ request }) => {
      requests.push(request.clone());

      return HttpResponse.json(buildTransfer(), { status: 201 });
    }),
  );

  return requests;
}

describe("useCreateTransfer", () => {
  it("posts the payload with the draft's Idempotency-Key and a UUID request id, and returns the transfer", async () => {
    const requests = captureRequests();
    const result = setup();

    const transfer = await act(() => result.current.mutateAsync(buildValidDraft()));

    expect(transfer).toEqual(buildTransfer());
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get("Idempotency-Key")).toBe(DRAFT_IDEMPOTENCY_KEY);
    expect(isRequestId(requests[0].headers.get("x-request-id"))).toBe(true);
    expect(await requests[0].json()).toEqual({
      amountInCents: 10_000,
      recipient: { contactId: "ctc_carlos" },
      concept: "Comida",
    });
  });

  it("keeps the same Idempotency-Key and uses a fresh request id on every call", async () => {
    const requests = captureRequests();
    const result = setup();

    await act(() => result.current.mutateAsync(buildValidDraft()));
    await act(() => result.current.mutateAsync(buildValidDraft()));

    expect(requests.map((request) => request.headers.get("Idempotency-Key"))).toEqual([
      DRAFT_IDEMPOTENCY_KEY,
      DRAFT_IDEMPOTENCY_KEY,
    ]);
    expect(requests[0].headers.get("x-request-id")).not.toBe(requests[1].headers.get("x-request-id"));
  });

  it("throws an ApiFailureError with the failure and does not retry", async () => {
    let calls = 0;
    server.use(
      http.post("/api/v1/transfers", () => {
        calls += 1;

        return HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "errors.api.INTERNAL_ERROR", requestId: "req-5" } },
          { status: 500 },
        );
      }),
    );
    const result = setup();

    act(() => {
      result.current.mutate(buildValidDraft());
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.failure).toMatchObject({ kind: "api", code: "INTERNAL_ERROR", requestId: "req-5" });
    expect(calls).toBe(1);
  });
});
