import "server-only";
import { cookies } from "next/headers";
import type { UserId } from "@/domain/user/types";
import { getEnv } from "@/shared/config/env";
import { UnauthorizedError } from "../errors";
import { signSessionToken, verifySessionToken, type SessionPayload } from "./token";

export const SESSION_COOKIE_NAME = "smw_session";
const SESSION_TTL_SECONDS = 1800;

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!cookie) {
    return null;
  }

  const result = verifySessionToken(cookie.value, getEnv().SESSION_SECRET, new Date());

  return result.ok ? result.value : null;
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}

export async function setSessionCookie(userId: UserId): Promise<void> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_SECONDS * 1000);
  const payload: SessionPayload = {
    userId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const token = signSessionToken(payload, getEnv().SESSION_SECRET);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}
