import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";
import { checkMutationRequest } from "./csrf";

function buildRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://smw.test/api/v1/transfers", {
    method: "POST",
    headers,
  });
}

describe("checkMutationRequest", () => {
  it("returns 415 FORBIDDEN when Content-Type is not application/json", () => {
    const request = buildRequest({
      "content-type": "text/plain",
      origin: "https://smw.test",
      host: "smw.test",
    });

    expect(checkMutationRequest(request)).toEqual({ status: 415, code: API_ERROR_CODE.FORBIDDEN });
  });

  it("accepts application/json with a charset suffix", () => {
    const request = buildRequest({
      "content-type": "application/json; charset=utf-8",
      origin: "https://smw.test",
      host: "smw.test",
    });

    expect(checkMutationRequest(request)).toBeNull();
  });

  it("returns 403 FORBIDDEN when Origin is missing", () => {
    const request = buildRequest({
      "content-type": "application/json",
      host: "smw.test",
    });

    expect(checkMutationRequest(request)).toEqual({ status: 403, code: API_ERROR_CODE.FORBIDDEN });
  });

  it("returns 403 FORBIDDEN when Origin's host differs from Host", () => {
    const request = buildRequest({
      "content-type": "application/json",
      origin: "https://evil.test",
      host: "smw.test",
    });

    expect(checkMutationRequest(request)).toEqual({ status: 403, code: API_ERROR_CODE.FORBIDDEN });
  });

  it("returns 403 FORBIDDEN when Origin is not a valid URL", () => {
    const request = buildRequest({
      "content-type": "application/json",
      origin: "not-a-url",
      host: "smw.test",
    });

    expect(checkMutationRequest(request)).toEqual({ status: 403, code: API_ERROR_CODE.FORBIDDEN });
  });

  it("returns null when Content-Type and Origin are both valid", () => {
    const request = buildRequest({
      "content-type": "application/json",
      origin: "https://smw.test",
      host: "smw.test",
    });

    expect(checkMutationRequest(request)).toBeNull();
  });
});
