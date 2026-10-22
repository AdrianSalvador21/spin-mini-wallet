import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleErrorReporter } from "@/shared/observability/error-reporter";
import { onRequestError } from "./instrumentation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onRequestError", () => {
  it("reports the error with source request-error and the request id from headers", async () => {
    const spy = vi.spyOn(consoleErrorReporter, "captureException").mockImplementation(() => {});
    const error = new Error("boom");

    await onRequestError(
      error,
      {
        path: "/api/v1/wallet/summary",
        method: "GET",
        headers: { "x-request-id": "req-1" },
      },
      {
        routerKind: "App Router",
        routePath: "/api/v1/wallet/summary",
        routeType: "route",
        renderSource: undefined,
        revalidateReason: undefined,
      },
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        source: "request-error",
        requestId: "req-1",
        path: "/api/v1/wallet/summary",
        method: "GET",
        routePath: "/api/v1/wallet/summary",
        routeType: "route",
      }),
    );
  });

  it("omits requestId when the header is missing", async () => {
    const spy = vi.spyOn(consoleErrorReporter, "captureException").mockImplementation(() => {});

    await onRequestError(
      new Error("boom"),
      { path: "/api/v1/wallet/summary", method: "GET", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/api/v1/wallet/summary",
        routeType: "route",
        renderSource: undefined,
        revalidateReason: undefined,
      },
    );

    const context = spy.mock.calls[0][1];
    expect(context.requestId).toBeUndefined();
  });
});
