import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserId } from "@/domain/user/types";
import { err, ok, type Result } from "@/domain/shared/result";

export interface SessionPayload {
  userId: UserId;
  issuedAt: string;
  expiresAt: string;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signSessionToken(payload: SessionPayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now: Date,
): Result<SessionPayload, "INVALID" | "EXPIRED"> {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return err("INVALID");
  }

  const expectedSignature = Buffer.from(sign(encodedPayload, secret));
  const providedSignature = Buffer.from(signature);

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return err("INVALID");
  }

  let payload: SessionPayload;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return err("INVALID");
  }

  if (now.getTime() >= new Date(payload.expiresAt).getTime()) {
    return err("EXPIRED");
  }

  return ok(payload);
}
