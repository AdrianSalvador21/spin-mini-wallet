import { describe, expect, it } from "vitest";
import { toMoney, type Cents } from "@/domain/money/money";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import type { ServiceError } from "../services/types";
import { errorResponse, toApiError } from "./api-error";

describe("toApiError", () => {
  it("maps VALIDATION_ERROR to 400 with details", () => {
    const error: ServiceError = {
      code: "VALIDATION_ERROR",
      details: { amount: ["AMOUNT_NOT_POSITIVE"] },
    };

    expect(toApiError(error)).toEqual({
      status: 400,
      code: API_ERROR_CODE.VALIDATION_ERROR,
      details: { amount: ["AMOUNT_NOT_POSITIVE"] },
    });
  });

  it("maps INSUFFICIENT_FUNDS to 422 with the balance", () => {
    const balance = toMoney(1000 as Cents);
    const error: ServiceError = { code: "INSUFFICIENT_FUNDS", balance };

    expect(toApiError(error)).toEqual({
      status: 422,
      code: API_ERROR_CODE.INSUFFICIENT_FUNDS,
      balance,
    });
  });

  it("maps NOT_FOUND to 404", () => {
    const error: ServiceError = { code: "NOT_FOUND" };

    expect(toApiError(error)).toEqual({ status: 404, code: API_ERROR_CODE.NOT_FOUND });
  });

  it("maps IDEMPOTENCY_CONFLICT to 409", () => {
    const error: ServiceError = { code: "IDEMPOTENCY_CONFLICT" };

    expect(toApiError(error)).toEqual({ status: 409, code: API_ERROR_CODE.IDEMPOTENCY_CONFLICT });
  });

  it("maps INVALID_CREDENTIALS to 401 UNAUTHORIZED", () => {
    const error: ServiceError = { code: "INVALID_CREDENTIALS" };

    expect(toApiError(error)).toEqual({ status: 401, code: API_ERROR_CODE.UNAUTHORIZED });
  });

  it("throws for an unknown ServiceError code", () => {
    const invalid = { code: "UNKNOWN" } as unknown as ServiceError;

    expect(() => toApiError(invalid)).toThrow(/Unreachable case/);
  });
});

describe("errorResponse", () => {
  it("builds the error envelope with the i18n message key", async () => {
    const response = errorResponse(
      { status: 404, code: API_ERROR_CODE.NOT_FOUND },
      "req-1",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: API_ERROR_CODE.NOT_FOUND, message: "errors.api.NOT_FOUND", requestId: "req-1" },
    });
  });

  it("includes details when present", async () => {
    const response = errorResponse(
      {
        status: 400,
        code: API_ERROR_CODE.VALIDATION_ERROR,
        details: { amount: ["AMOUNT_NOT_POSITIVE"] },
      },
      "req-2",
    );

    expect(await response.json()).toEqual({
      error: {
        code: API_ERROR_CODE.VALIDATION_ERROR,
        message: "errors.api.VALIDATION_ERROR",
        requestId: "req-2",
        details: { amount: ["AMOUNT_NOT_POSITIVE"] },
      },
    });
  });

  it("includes balance when present", async () => {
    const balance = toMoney(1000 as Cents);
    const response = errorResponse(
      { status: 422, code: API_ERROR_CODE.INSUFFICIENT_FUNDS, balance },
      "req-3",
    );

    expect(await response.json()).toEqual({
      error: {
        code: API_ERROR_CODE.INSUFFICIENT_FUNDS,
        message: "errors.api.INSUFFICIENT_FUNDS",
        requestId: "req-3",
        balance,
      },
    });
  });
});
