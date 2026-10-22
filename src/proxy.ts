import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { SESSION_COOKIE_NAME } from "@/server/session/session";
import { verifySessionToken } from "@/server/session/token";
import { getEnv } from "@/shared/config/env";
import { REQUEST_ID_HEADER } from "@/shared/lib/api/contract";
import { resolveRouteAccess, ROUTE_ACCESS } from "@/shared/lib/routes";

function hasValidSession(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token === undefined) {
    return false;
  }

  return verifySessionToken(token, getEnv().SESSION_SECRET, new Date()).ok;
}

export function proxy(request: NextRequest): NextResponse {
  const requestId = randomUUID();
  const access = resolveRouteAccess(request.nextUrl.pathname, hasValidSession(request));

  switch (access.action) {
    case ROUTE_ACCESS.NEXT: {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(REQUEST_ID_HEADER, requestId);

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set(REQUEST_ID_HEADER, requestId);

      return response;
    }
    case ROUTE_ACCESS.REDIRECT: {
      const response = NextResponse.redirect(new URL(access.to, request.url));
      response.headers.set(REQUEST_ID_HEADER, requestId);

      return response;
    }
    default:
      return assertUnreachable(access);
  }
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
};
