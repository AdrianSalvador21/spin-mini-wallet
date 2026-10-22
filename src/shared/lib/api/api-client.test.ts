import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPost } from "./api-client";

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
});
