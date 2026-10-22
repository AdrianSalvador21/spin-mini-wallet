import "server-only";
import type { NextRequest } from "next/server";
import { API_ERROR_CODE } from "@/shared/lib/api/contract";

export interface CsrfViolation {
  status: 403 | 415;
  code: typeof API_ERROR_CODE.FORBIDDEN;
}

export function checkMutationRequest(request: NextRequest): CsrfViolation | null {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { status: 415, code: API_ERROR_CODE.FORBIDDEN };
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return { status: 403, code: API_ERROR_CODE.FORBIDDEN };
  }

  let originHost: string;

  try {
    originHost = new URL(origin).host;
  } catch {
    return { status: 403, code: API_ERROR_CODE.FORBIDDEN };
  }

  if (originHost !== request.headers.get("host")) {
    return { status: 403, code: API_ERROR_CODE.FORBIDDEN };
  }

  return null;
}
