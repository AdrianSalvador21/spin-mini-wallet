import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailureError, apiGet, apiPost, getRequestId } from "./api-client";

const REQUEST_ID = "3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b";
const TIMEOUT_MS = 8000;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiGet", () => {
  it("returns ok with the parsed body for a 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ balance: { amountInCents: 100, currency: "MXN" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const result = await apiGet<{ balance: { amountInCents: number } }>("/api/v1/wallet/summary");

    expect(result).toEqual({ ok: true, value: { balance: { amountInCents: 100, currency: "MXN" } } });
  });

  it("turns a 503 error envelope into an api failure with code and requestId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-1" },
            }),
            { status: 503, headers: { "x-request-id": "req-1" } },
          ),
      ),
    );

    const result = await apiGet("/api/v1/wallet/movements");

    expect(result).toEqual({
      ok: false,
      error: { kind: "api", status: 503, code: "UPSTREAM_UNAVAILABLE", requestId: "req-1" },
    });
  });

  it("turns a 500 HTML body into an unknown failure with the header's requestId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>oops</html>", {
            status: 500,
            headers: { "content-type": "text/html", "x-request-id": "req-2" },
          }),
      ),
    );

    const result = await apiGet("/api/v1/wallet/summary");

    expect(result).toEqual({ ok: false, error: { kind: "unknown", status: 500, requestId: "req-2" } });
  });

  it("turns a rejected fetch into a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const result = await apiGet("/api/v1/wallet/summary");

    expect(result).toEqual({ ok: false, error: { kind: "network" } });
  });
});

describe("getRequestId", () => {
  it("reads the reference of an api or unknown failure", () => {
    expect(
      getRequestId(new ApiFailureError({ kind: "api", status: 503, code: "UPSTREAM_UNAVAILABLE", requestId: "req-1" })),
    ).toBe("req-1");
    expect(getRequestId(new ApiFailureError({ kind: "unknown", status: 500, requestId: "req-2" }))).toBe("req-2");
  });

  it("reads the sent reference of a network or timeout failure", () => {
    expect(getRequestId(new ApiFailureError({ kind: "network", requestId: "req-3" }))).toBe("req-3");
    expect(getRequestId(new ApiFailureError({ kind: "timeout", requestId: "req-4" }))).toBe("req-4");
  });

  it("has no reference for a failure without one or another error", () => {
    expect(getRequestId(new ApiFailureError({ kind: "network" }))).toBeUndefined();
    expect(getRequestId(new ApiFailureError({ kind: "timeout" }))).toBeUndefined();
    expect(getRequestId(new Error("boom"))).toBeUndefined();
  });
});

describe("apiPost", () => {
  it("sends the body as JSON with its content type and returns the parsed 201 body", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "ctc_1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiPost<{ id: string }>("/api/v1/contacts", { name: "Ana" });

    expect(result).toEqual({ ok: true, value: { id: "ctc_1" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana" }),
      signal: undefined,
      credentials: "same-origin",
    });
  });

  it("sends the request id and the idempotency key as headers", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/v1/transfers", {}, { requestId: REQUEST_ID, idempotencyKey: "key-1" });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      "x-request-id": REQUEST_ID,
      "Idempotency-Key": "key-1",
    });
  });

  it("maps a 400 envelope to an api failure with its details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "errors.api.VALIDATION_ERROR",
                requestId: "req-3",
                details: { account: ["RECIPIENT_IS_SELF"] },
              },
            }),
            { status: 400 },
          ),
      ),
    );

    const result = await apiPost("/api/v1/contacts", {});

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "api",
        status: 400,
        code: "VALIDATION_ERROR",
        requestId: "req-3",
        details: { account: ["RECIPIENT_IS_SELF"] },
      },
    });
  });

  it("turns a rejected fetch into a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    expect(await apiPost("/api/v1/contacts", {})).toEqual({ ok: false, error: { kind: "network" } });
  });

  it("echoes the sent request id on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    expect(await apiPost("/api/v1/transfers", {}, { requestId: REQUEST_ID })).toEqual({
      ok: false,
      error: { kind: "network", requestId: REQUEST_ID },
    });
  });
});

function fetchUntilAborted() {
  return vi.fn(
    (_path: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const rejectAborted = () => reject(new DOMException("Aborted", "AbortError"));

        if (init.signal?.aborted) {
          rejectAborted();
        }

        init.signal?.addEventListener("abort", rejectAborted);
      }),
  );
}

describe("request timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns a response that does not arrive within timeoutMs into a timeout with the sent request id", async () => {
    vi.stubGlobal("fetch", fetchUntilAborted());

    const pending = apiPost("/api/v1/transfers", {}, { timeoutMs: TIMEOUT_MS, requestId: REQUEST_ID });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, error: { kind: "timeout", requestId: REQUEST_ID } });
  });

  it("omits the request id on a timeout when none was sent", async () => {
    vi.stubGlobal("fetch", fetchUntilAborted());

    const pending = apiGet("/api/v1/transfers?idempotencyKey=key-1", { timeoutMs: TIMEOUT_MS });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    expect(await pending).toEqual({ ok: false, error: { kind: "timeout" } });
  });

  it("clears the timer once a response arrives before the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "trf_1" }), { status: 201 })));

    const result = await apiPost("/api/v1/transfers", {}, { timeoutMs: TIMEOUT_MS });

    expect(result).toEqual({ ok: true, value: { id: "trf_1" } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("turns an abort by the caller's signal into a network failure", async () => {
    vi.stubGlobal("fetch", fetchUntilAborted());
    const controller = new AbortController();

    const pending = apiPost(
      "/api/v1/transfers",
      {},
      { timeoutMs: TIMEOUT_MS, requestId: REQUEST_ID, signal: controller.signal },
    );
    controller.abort();

    expect(await pending).toEqual({ ok: false, error: { kind: "network", requestId: REQUEST_ID } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats a caller signal that is already aborted as a network failure", async () => {
    vi.stubGlobal("fetch", fetchUntilAborted());
    const controller = new AbortController();
    controller.abort();

    const pending = apiGet("/api/v1/transfers?idempotencyKey=key-1", {
      timeoutMs: TIMEOUT_MS,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(await pending).toEqual({ ok: false, error: { kind: "network" } });
  });
});
