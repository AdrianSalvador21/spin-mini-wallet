import type { Route } from "next";
import type { TransferId } from "@/domain/transfer/types";

export const ROUTES = {
  ROOT: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  HOME: "/home",
  TRANSFERS: "/transfers",
  TRANSFER_AMOUNT: "/transfers/new/amount",
  TRANSFER_RECIPIENT: "/transfers/new/recipient",
  TRANSFER_REVIEW: "/transfers/new/review",
} as const;

export function transferReceiptRoute(transferId: TransferId): Route {
  return `${ROUTES.TRANSFERS}/${transferId}` as Route;
}

export const ROUTE_ACCESS = {
  NEXT: "next",
  REDIRECT: "redirect",
} as const;

export type RouteAccess =
  | { action: typeof ROUTE_ACCESS.NEXT }
  | { action: typeof ROUTE_ACCESS.REDIRECT; to: string };

const PUBLIC_ONLY_PATHS: readonly string[] = [ROUTES.LOGIN, ROUTES.REGISTER];
const PRIVATE_PATH_PREFIXES: readonly string[] = [ROUTES.HOME, ROUTES.TRANSFERS];

function isWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function redirectTo(to: string): RouteAccess {
  return { action: ROUTE_ACCESS.REDIRECT, to };
}

const NEXT: RouteAccess = { action: ROUTE_ACCESS.NEXT };

export function resolveRouteAccess(pathname: string, hasSession: boolean): RouteAccess {
  if (pathname === ROUTES.ROOT) {
    return redirectTo(hasSession ? ROUTES.HOME : ROUTES.LOGIN);
  }
  if (PUBLIC_ONLY_PATHS.includes(pathname)) {
    return hasSession ? redirectTo(ROUTES.HOME) : NEXT;
  }
  if (PRIVATE_PATH_PREFIXES.some((prefix) => isWithin(pathname, prefix))) {
    return hasSession ? NEXT : redirectTo(ROUTES.LOGIN);
  }
  return NEXT;
}
