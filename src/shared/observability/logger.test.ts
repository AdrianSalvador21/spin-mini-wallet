import { afterEach, describe, expect, it, vi } from "vitest";
import { LOG_LEVEL, log, logger, type LogLevel } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes exactly one parseable JSON line to console.log for info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("hello");

    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: LOG_LEVEL.INFO, message: "hello" });
    expect(typeof line.timestamp).toBe("string");
  });

  it("writes exactly one parseable JSON line to console.log for warn", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.warn("careful");

    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.level).toBe(LOG_LEVEL.WARN);
  });

  it("writes exactly one parseable JSON line to console.error for error", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("boom");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line.level).toBe(LOG_LEVEL.ERROR);
  });

  it("includes requestId at the top level when provided", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("hello", { requestId: "req-1" });

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.requestId).toBe("req-1");
    expect(line.context).toBeUndefined();
  });

  it("puts the remaining fields under a redacted context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("api_request", { requestId: "req-1", method: "GET", email: "a@b.mx" });

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.requestId).toBe("req-1");
    expect(line.context).toEqual({ method: "GET", email: "[REDACTED]" });
  });

  it("omits context entirely when no extra fields are given", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("hello", {});

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.context).toBeUndefined();
    expect(line.requestId).toBeUndefined();
  });

  it("throws for an unknown level", () => {
    const invalidLevel = "critical" as unknown as LogLevel;

    expect(() => log(invalidLevel, "hello")).toThrow(/Unreachable case/);
  });
});
