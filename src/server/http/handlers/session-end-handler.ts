import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/shared/lib/routes";
import { SESSION_COOKIE_NAME } from "../../session/session";

export function createSessionEndHandler() {
  return async (request: NextRequest): Promise<Response> => {
    const response = NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));

    response.cookies.delete(SESSION_COOKIE_NAME);
    response.headers.set("Cache-Control", "no-store");

    return response;
  };
}
