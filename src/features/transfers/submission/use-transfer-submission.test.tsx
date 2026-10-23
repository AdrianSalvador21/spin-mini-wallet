import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { WalletSummary } from "@/shared/lib/api/views";
import { walletQueryKeys } from "@/shared/lib/api/wallet-queries";
import { clearClientSession } from "@/shared/lib/session-storage/client-session";
import { buildTransfer, buildValidDraft, DRAFT_IDEMPOTENCY_KEY } from "@/test/factories/transfers";
import { buildWalletSummary } from "@/test/factories/wallet";
import { server } from "@/test/msw/server";
import { EMPTY_DRAFT, useTransferDraft } from "../draft/draft-store";
import { IDLE_SUBMISSION, useSubmissionStore } from "./submission-store";
import { useTransferSubmission } from "./use-transfer-submission";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const timeout = vi.hoisted(() => ({ ms: 8000 }));

vi.mock("../api/transfer-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/transfer-requests")>();

  return {
    ...actual,
    get TRANSFER_TIMEOUT_MS() {
      return timeout.ms;
    },
  };
});

const SHORT_TIMEOUT_MS = 40;

function errorBody(code: string, requestId: string, extra: object = {}) {
  return { error: { code, message: `errors.api.${code}`, requestId, ...extra } };
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(walletQueryKeys.summary(), buildWalletSummary());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useTransferSubmission(), { wrapper });

  return { queryClient, result };
}

function recordTransferPosts(respond: (attempt: number) => Response | Promise<Response>): Request[] {
  const requests: Request[] = [];
  server.use(
    http.post("/api/v1/transfers", ({ request }) => {
      requests.push(request);

      return respond(requests.length);
    }),
  );

  return requests;
}

beforeEach(() => {
  replaceMock.mockReset();
  useSubmissionStore.setState({ state: IDLE_SUBMISSION });
  const draft = buildValidDraft();
  useTransferDraft.setState({ ...EMPTY_DRAFT, ...draft });
});

afterEach(() => {
  timeout.ms = 8000;
  useTransferDraft.setState(EMPTY_DRAFT);
});

describe("useTransferSubmission", () => {
  it("on success invalidates the wallet queries, stores the transfer and replaces to the receipt", async () => {
    const { queryClient, result } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.submit(buildValidDraft()));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wallet"] });
    expect(result.current.state).toEqual({ status: "succeeded", transfer: buildTransfer() });
    expect(replaceMock).toHaveBeenCalledWith("/transfers/trf_1");
  });

  it("is processing while the request is pending and ignores a second submit", async () => {
    const pending = Promise.withResolvers<void>();
    const requests = recordTransferPosts(async () => {
      await pending.promise;

      return HttpResponse.json(buildTransfer(), { status: 201 });
    });
    const { result } = setup();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.submit(buildValidDraft());
    });

    expect(result.current.state).toEqual({ status: "processing" });

    await act(() => result.current.submit(buildValidDraft()));
    await waitFor(() => expect(requests).toHaveLength(1));

    pending.resolve();
    await act(() => first);

    expect(requests).toHaveLength(1);
    expect(result.current.state.status).toBe("succeeded");
  });

  it("maps a 503 to network_error and retry resends the same key with a new request id", async () => {
    const requests = recordTransferPosts((attempt) =>
      attempt === 1
        ? HttpResponse.json(errorBody("UPSTREAM_UNAVAILABLE", "req-1"), { status: 503 })
        : HttpResponse.json(buildTransfer(), { status: 201 }),
    );
    const { result } = setup();

    await act(() => result.current.submit(buildValidDraft()));

    expect(result.current.state).toEqual({
      status: "failed",
      outcome: { kind: "network_error", requestId: "req-1" },
    });

    await act(() => result.current.retry());

    expect(requests.map((request) => request.headers.get("Idempotency-Key"))).toEqual([
      DRAFT_IDEMPOTENCY_KEY,
      DRAFT_IDEMPOTENCY_KEY,
    ]);
    expect(requests[0].headers.get("x-request-id")).not.toBe(requests[1].headers.get("x-request-id"));
    expect(result.current.state.status).toBe("succeeded");
  });

  it("does nothing on retry without a confirmable draft", async () => {
    const requests = recordTransferPosts(() => HttpResponse.json(buildTransfer(), { status: 201 }));
    useTransferDraft.setState(EMPTY_DRAFT);
    const { result } = setup();

    await act(() => result.current.retry());

    expect(requests).toHaveLength(0);
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("writes the returned balance into the summary cache on insufficient_funds", async () => {
    const balance = toMoney(20_000 as Cents);
    recordTransferPosts(() =>
      HttpResponse.json(errorBody("INSUFFICIENT_FUNDS", "req-2", { balance }), { status: 422 }),
    );
    const { queryClient, result } = setup();

    await act(() => result.current.submit(buildValidDraft()));

    expect(result.current.state).toEqual({
      status: "failed",
      outcome: { kind: "insufficient_funds", amount: toMoney(10_000 as Cents), balance },
    });
    expect(queryClient.getQueryData<WalletSummary>(walletQueryKeys.summary())?.balance).toEqual(balance);
  });

  it("reports an unknown_error with its reference", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    recordTransferPosts(() => HttpResponse.json(errorBody("INTERNAL_ERROR", "req-3"), { status: 500 }));
    const { result } = setup();

    await act(() => result.current.submit(buildValidDraft()));

    expect(result.current.state).toEqual({
      status: "failed",
      outcome: { kind: "unknown_error", requestId: "req-3" },
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toContain("req-3");
    consoleError.mockRestore();
  });

  it("goes from a timeout to not_found_yet on a 404 lookup, and to success on a 200 lookup", async () => {
    timeout.ms = SHORT_TIMEOUT_MS;
    recordTransferPosts(async () => {
      await delay("infinite");

      return HttpResponse.json(buildTransfer(), { status: 201 });
    });
    const { result } = setup();

    await act(() => result.current.submit(buildValidDraft()));

    expect(result.current.state).toMatchObject({ status: "failed", outcome: { kind: "timeout" } });

    await act(() => result.current.checkStatus());

    expect(result.current.state).toMatchObject({
      status: "failed",
      outcome: { kind: "not_found_yet", requestId: "req-msw-lookup" },
    });

    let lookupKey: string | null = null;
    server.use(
      http.get("/api/v1/transfers", ({ request }) => {
        lookupKey = new URL(request.url).searchParams.get("idempotencyKey");

        return HttpResponse.json(buildTransfer());
      }),
    );

    await act(() => result.current.checkStatus());

    expect(lookupKey).toBe(DRAFT_IDEMPOTENCY_KEY);
    expect(result.current.state).toEqual({ status: "succeeded", transfer: buildTransfer() });
    expect(replaceMock).toHaveBeenCalledWith("/transfers/trf_1");
  });

  it("is checking while the lookup is pending", async () => {
    const pending = Promise.withResolvers<void>();
    server.use(
      http.get("/api/v1/transfers", async () => {
        await pending.promise;

        return HttpResponse.json(buildTransfer());
      }),
    );
    const { result } = setup();

    let lookup: Promise<void> = Promise.resolve();
    act(() => {
      lookup = result.current.checkStatus();
    });

    expect(result.current.state).toEqual({ status: "checking" });

    pending.resolve();
    await act(() => lookup);

    expect(result.current.state.status).toBe("succeeded");
  });

  it("dismiss returns to idle", async () => {
    recordTransferPosts(() => HttpResponse.json(errorBody("INTERNAL_ERROR", "req-4"), { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup();

    await act(() => result.current.submit(buildValidDraft()));
    act(() => result.current.dismiss());

    expect(result.current.state).toEqual({ status: "idle" });
    vi.restoreAllMocks();
  });

  it("guards beforeunload only while processing", async () => {
    const pending = Promise.withResolvers<void>();
    recordTransferPosts(async () => {
      await pending.promise;

      return HttpResponse.json(buildTransfer(), { status: 201 });
    });
    const { result } = setup();

    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);

    let submission: Promise<void> = Promise.resolve();
    act(() => {
      submission = result.current.submit(buildValidDraft());
    });

    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);

    pending.resolve();
    await act(() => submission);

    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
  });

  it("empties the store when the client session is cleared", async () => {
    recordTransferPosts(() => HttpResponse.json(errorBody("UPSTREAM_UNAVAILABLE", "req-5"), { status: 503 }));
    const { result } = setup();

    await act(() => result.current.submit(buildValidDraft()));
    expect(result.current.state.status).toBe("failed");

    act(() => clearClientSession());

    expect(result.current.state).toEqual({ status: "idle" });
  });
});
