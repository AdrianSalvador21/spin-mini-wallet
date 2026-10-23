import { describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import { ApiFailureError, type ApiFailure } from "@/shared/lib/api/api-client";
import type { ApiErrorCode } from "@/shared/lib/api/contract";
import { reportTransferOutcome, toLookupOutcome, toTransferOutcome } from "./outcome";

const AMOUNT = toMoney(35_000 as Cents);
const BALANCE = toMoney(20_000 as Cents);

function apiFailure(code: ApiErrorCode, extra: Partial<ApiFailure> = {}): ApiFailure {
  return { kind: "api", status: 500, code, requestId: "req-api", ...extra } as ApiFailure;
}

describe("toTransferOutcome", () => {
  it("maps a network failure to network_error with the sent reference", () => {
    expect(toTransferOutcome({ kind: "network", requestId: "req-1" }, AMOUNT)).toEqual({
      kind: "network_error",
      requestId: "req-1",
    });
  });

  it("maps a timeout to timeout with the sent reference", () => {
    expect(toTransferOutcome({ kind: "timeout", requestId: "req-2" }, AMOUNT)).toEqual({
      kind: "timeout",
      requestId: "req-2",
    });
  });

  it("maps UPSTREAM_UNAVAILABLE to network_error", () => {
    expect(toTransferOutcome(apiFailure("UPSTREAM_UNAVAILABLE"), AMOUNT)).toEqual({
      kind: "network_error",
      requestId: "req-api",
    });
  });

  it("maps INSUFFICIENT_FUNDS to insufficient_funds with the amount and the returned balance", () => {
    expect(toTransferOutcome(apiFailure("INSUFFICIENT_FUNDS", { balance: BALANCE }), AMOUNT)).toEqual({
      kind: "insufficient_funds",
      amount: AMOUNT,
      balance: BALANCE,
    });
  });

  it("keeps insufficient_funds without a balance when the server sends none", () => {
    const outcome = toTransferOutcome(apiFailure("INSUFFICIENT_FUNDS"), AMOUNT);

    expect(outcome).toEqual({ kind: "insufficient_funds", amount: AMOUNT });
  });

  it.each<ApiErrorCode>([
    "INTERNAL_ERROR",
    "VALIDATION_ERROR",
    "NOT_FOUND",
    "IDEMPOTENCY_CONFLICT",
    "FORBIDDEN",
    "UNAUTHORIZED",
  ])("maps %s to unknown_error with the reference", (code) => {
    expect(toTransferOutcome(apiFailure(code), AMOUNT)).toEqual({ kind: "unknown_error", requestId: "req-api" });
  });

  it("maps an unknown failure to unknown_error", () => {
    expect(toTransferOutcome({ kind: "unknown", status: 502, requestId: "req-3" }, AMOUNT)).toEqual({
      kind: "unknown_error",
      requestId: "req-3",
    });
  });

  it("throws for an unknown failure kind", () => {
    expect(() => toTransferOutcome({ kind: "teleport" } as unknown as ApiFailure, AMOUNT)).toThrow(
      /Unreachable case/,
    );
  });

  it("throws for an unknown api error code", () => {
    expect(() => toTransferOutcome(apiFailure("TELEPORT" as ApiErrorCode), AMOUNT)).toThrow(/Unreachable case/);
  });
});

describe("toLookupOutcome", () => {
  it.each<[string, ApiFailure]>([
    ["a 404", apiFailure("NOT_FOUND", { status: 404, requestId: "req-l" })],
    ["another api code", apiFailure("INTERNAL_ERROR", { requestId: "req-l" })],
    ["a network failure", { kind: "network", requestId: "req-l" }],
    ["a timeout", { kind: "timeout", requestId: "req-l" }],
    ["an unknown failure", { kind: "unknown", requestId: "req-l" }],
  ])("maps %s to not_found_yet with the reference", (_label, failure) => {
    expect(toLookupOutcome(failure)).toEqual({ kind: "not_found_yet", requestId: "req-l" });
  });

  it("throws for an unknown failure kind", () => {
    expect(() => toLookupOutcome({ kind: "teleport" } as unknown as ApiFailure)).toThrow(/Unreachable case/);
  });
});

describe("reportTransferOutcome", () => {
  it("reports an unknown_error once with the browser source, the request id and the code", () => {
    const reporter = { captureException: vi.fn() };
    const failure = apiFailure("INTERNAL_ERROR", { requestId: "req-u" });

    reportTransferOutcome(toTransferOutcome(failure, AMOUNT), failure, reporter);

    expect(reporter.captureException).toHaveBeenCalledTimes(1);
    expect(reporter.captureException).toHaveBeenCalledWith(expect.any(ApiFailureError), {
      source: "browser",
      requestId: "req-u",
      code: "INTERNAL_ERROR",
    });
  });

  it("reports the failure kind as the code for an unknown failure", () => {
    const reporter = { captureException: vi.fn() };
    const failure: ApiFailure = { kind: "unknown", status: 502, requestId: "req-x" };

    reportTransferOutcome(toTransferOutcome(failure, AMOUNT), failure, reporter);

    expect(reporter.captureException).toHaveBeenCalledWith(expect.any(ApiFailureError), {
      source: "browser",
      requestId: "req-x",
      code: "unknown",
    });
  });

  it.each<ApiFailure>([
    { kind: "network", requestId: "req-1" },
    { kind: "timeout", requestId: "req-2" },
    apiFailure("UPSTREAM_UNAVAILABLE"),
    apiFailure("INSUFFICIENT_FUNDS", { balance: BALANCE }),
  ])("does not report a recognized outcome (%o)", (failure) => {
    const reporter = { captureException: vi.fn() };

    reportTransferOutcome(toTransferOutcome(failure, AMOUNT), failure, reporter);

    expect(reporter.captureException).not.toHaveBeenCalled();
  });

  it("uses the default reporter when none is given", () => {
    const failure = apiFailure("INTERNAL_ERROR");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportTransferOutcome(toTransferOutcome(failure, AMOUNT), failure);

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
