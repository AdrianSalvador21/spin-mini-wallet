import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleErrorReporter } from "@/shared/observability/error-reporter";
import "./instrumentation-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("instrumentation-client", () => {
  it("reports window error events with source browser", () => {
    const spy = vi.spyOn(consoleErrorReporter, "captureException").mockImplementation(() => {});
    const error = new Error("boom");

    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));

    expect(spy).toHaveBeenCalledWith(error, expect.objectContaining({ source: "browser" }));
  });

  it("reports unhandledrejection events with source browser", () => {
    const spy = vi.spyOn(consoleErrorReporter, "captureException").mockImplementation(() => {});
    const reason = new Error("rejected");
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: reason });

    window.dispatchEvent(event);

    expect(spy).toHaveBeenCalledWith(reason, expect.objectContaining({ source: "browser" }));
  });
});
