import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_SOURCE, consoleErrorReporter, getErrorReporter } from "./error-reporter";

describe("consoleErrorReporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the error name, message and stack through logger.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("something broke");

    consoleErrorReporter.captureException(error, {
      source: ERROR_SOURCE.ROUTE_HANDLER,
      requestId: "req-1",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.message).toBe("something broke");
    expect(line.requestId).toBe("req-1");
    expect(line.context).toMatchObject({ source: ERROR_SOURCE.ROUTE_HANDLER, name: "Error" });
    expect(line.context.stack).toContain("Error: something broke");
  });

  it("handles a thrown value that is not an Error instance", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    consoleErrorReporter.captureException("plain string failure", {
      source: ERROR_SOURCE.BROWSER,
    });

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.message).toBe("plain string failure");
    expect(line.context.name).toBe("UnknownError");
  });
});

describe("getErrorReporter", () => {
  it("returns the console reporter", () => {
    expect(getErrorReporter()).toBe(consoleErrorReporter);
  });
});
