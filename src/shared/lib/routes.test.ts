import { describe, expect, it } from "vitest";
import type { TransferId } from "@/domain/transfer/types";
import { resolveRouteAccess, ROUTE_ACCESS, ROUTES, transferReceiptRoute } from "./routes";

describe("transferReceiptRoute", () => {
  it("builds the receipt path for a transfer id", () => {
    expect(transferReceiptRoute("trf_x" as TransferId)).toBe("/transfers/trf_x");
  });
});

const next = { action: ROUTE_ACCESS.NEXT };
const toLogin = { action: ROUTE_ACCESS.REDIRECT, to: ROUTES.LOGIN };
const toHome = { action: ROUTE_ACCESS.REDIRECT, to: ROUTES.HOME };

describe("resolveRouteAccess", () => {
  it.each([
    ["/", false, toLogin],
    ["/", true, toHome],
    ["/login", false, next],
    ["/login", true, toHome],
    ["/register", false, next],
    ["/register", true, toHome],
    ["/home", false, toLogin],
    ["/home", true, next],
    ["/home/x", false, toLogin],
    ["/home/x", true, next],
    ["/transfers", false, toLogin],
    ["/transfers", true, next],
    ["/transfers/new/amount", false, toLogin],
    ["/transfers/new/amount", true, next],
    ["/api/v1/wallet/summary", false, next],
    ["/api/v1/wallet/summary", true, next],
    ["/favicon.ico", false, next],
    ["/favicon.ico", true, next],
    ["/session/end", false, next],
    ["/session/end", true, next],
  ])("resolves %s with session=%s", (pathname, hasSession, expected) => {
    expect(resolveRouteAccess(pathname, hasSession)).toEqual(expected);
  });

  it("does not treat a path that only shares a prefix as private", () => {
    expect(resolveRouteAccess("/homepage", false)).toEqual(next);
    expect(resolveRouteAccess("/transfers-history", false)).toEqual(next);
  });
});
