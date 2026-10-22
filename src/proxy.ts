import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_ID_HEADER } from "@/shared/lib/api/contract";

export function proxy(request: NextRequest): NextResponse {
  const requestId = randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);

  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
};
