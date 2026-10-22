import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("proxy", () => {
  it("sets a generated UUID as the response's x-request-id header", () => {
    const request = new NextRequest("https://smw.test/api/v1/wallet/summary");
    const response = proxy(request);

    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("forwards the same generated UUID as x-request-id on the request", () => {
    const request = new NextRequest("https://smw.test/api/v1/wallet/summary");
    const response = proxy(request);

    const forwarded = response.headers.get("x-middleware-request-x-request-id");
    expect(forwarded).toBe(response.headers.get("x-request-id"));
  });

  it("overwrites a spoofed incoming x-request-id on both the request and the response", () => {
    const request = new NextRequest("https://smw.test/api/v1/wallet/summary", {
      headers: { "x-request-id": "spoofed" },
    });

    const response = proxy(request);

    expect(response.headers.get("x-request-id")).not.toBe("spoofed");
    expect(response.headers.get("x-middleware-request-x-request-id")).not.toBe("spoofed");
  });

  it("generates a different id for each request", () => {
    const first = proxy(new NextRequest("https://smw.test/api/v1/wallet/summary"));
    const second = proxy(new NextRequest("https://smw.test/api/v1/wallet/summary"));

    expect(first.headers.get("x-request-id")).not.toBe(second.headers.get("x-request-id"));
  });

  it("uses node:crypto randomUUID to generate the id", () => {
    proxy(new NextRequest("https://smw.test/api/v1/wallet/summary"));

    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
