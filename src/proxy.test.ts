import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/domain/user/types";
import { SESSION_COOKIE_NAME } from "@/server/session/session";
import { signSessionToken } from "@/server/session/token";
import { REQUEST_ID_HEADER } from "@/shared/lib/api/contract";
import { resolveRouteAccess, ROUTES, type RouteAccess } from "@/shared/lib/routes";
import { proxy } from "./proxy";

const SECRET = "a".repeat(32);
const ORIGIN = "https://smw.test";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPORARY_REDIRECT = 307;

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

vi.mock("@/shared/lib/routes", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/routes")>("@/shared/lib/routes");
  return { ...actual, resolveRouteAccess: vi.fn(actual.resolveRouteAccess) };
});

beforeAll(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.clearAllMocks();
});

function sessionToken(expiresInMs: number, secret = SECRET): string {
  const issuedAt = new Date();

  return signSessionToken(
    {
      userId: "usr_mariana" as UserId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + expiresInMs).toISOString(),
    },
    secret,
  );
}

function request(path: string, token?: string): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: token === undefined ? {} : { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });
}

const VALID = () => sessionToken(30 * 60 * 1000);

describe("proxy request id", () => {
  it("sets a generated UUID as the response's x-request-id header", () => {
    const response = proxy(request("/api/v1/wallet/summary"));

    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });

  it("forwards the same generated UUID as x-request-id on the request", () => {
    const response = proxy(request("/api/v1/wallet/summary"));

    const forwarded = response.headers.get("x-middleware-request-x-request-id");
    expect(forwarded).toBe(response.headers.get(REQUEST_ID_HEADER));
  });

  it("overwrites a spoofed incoming x-request-id on both the request and the response", () => {
    const spoofed = new NextRequest(`${ORIGIN}/api/v1/wallet/summary`, {
      headers: { [REQUEST_ID_HEADER]: "spoofed" },
    });

    const response = proxy(spoofed);

    expect(response.headers.get(REQUEST_ID_HEADER)).not.toBe("spoofed");
    expect(response.headers.get("x-middleware-request-x-request-id")).not.toBe("spoofed");
  });

  it("generates a different id for each request", () => {
    const first = proxy(request("/api/v1/wallet/summary"));
    const second = proxy(request("/api/v1/wallet/summary"));

    expect(first.headers.get(REQUEST_ID_HEADER)).not.toBe(second.headers.get(REQUEST_ID_HEADER));
  });

  it("uses node:crypto randomUUID to generate the id", () => {
    proxy(request("/api/v1/wallet/summary"));

    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});

describe("proxy route guard", () => {
  it("redirects /home without a cookie to /login with x-request-id", () => {
    const response = proxy(request(ROUTES.HOME));

    expect(response.status).toBe(TEMPORARY_REDIRECT);
    expect(response.headers.get("location")).toBe(`${ORIGIN}${ROUTES.LOGIN}`);
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });

  it("redirects a nested transfers page without a session to /login", () => {
    const response = proxy(request("/transfers/new/amount"));

    expect(response.headers.get("location")).toBe(`${ORIGIN}${ROUTES.LOGIN}`);
  });

  it("redirects /login with a valid cookie to /home", () => {
    const response = proxy(request(ROUTES.LOGIN, VALID()));

    expect(response.status).toBe(TEMPORARY_REDIRECT);
    expect(response.headers.get("location")).toBe(`${ORIGIN}${ROUTES.HOME}`);
  });

  it("lets /home through with a valid cookie", () => {
    const response = proxy(request(ROUTES.HOME, VALID()));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    ["tampered", `${VALID()}x`],
    ["signed with another secret", sessionToken(30 * 60 * 1000, "b".repeat(32))],
    ["expired", sessionToken(-1000)],
    ["malformed", "not-a-token"],
  ])("treats a %s cookie as no session", (_label, token) => {
    const response = proxy(request(ROUTES.HOME, token));

    expect(response.headers.get("location")).toBe(`${ORIGIN}${ROUTES.LOGIN}`);
  });

  it.each([
    [undefined, ROUTES.LOGIN],
    ["valid", ROUTES.HOME],
  ])("redirects / with session=%s to %s", (session, target) => {
    const response = proxy(request(ROUTES.ROOT, session === undefined ? undefined : VALID()));

    expect(response.headers.get("location")).toBe(`${ORIGIN}${target}`);
  });

  it("passes /api/v1/wallet/summary through without a session", () => {
    const response = proxy(request("/api/v1/wallet/summary"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("throws for an unknown access action", () => {
    vi.mocked(resolveRouteAccess).mockReturnValueOnce({ action: "teleport" } as unknown as RouteAccess);

    expect(() => proxy(request(ROUTES.HOME))).toThrow(/Unreachable case/);
  });
});
