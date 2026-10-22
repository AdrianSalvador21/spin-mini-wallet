import "server-only";
import { describe, expect, it } from "vitest";
import type { UserId } from "@/domain/user/types";
import { signSessionToken, verifySessionToken, type SessionPayload } from "./token";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-10-21T12:00:00.000Z");

function buildPayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    userId: "usr_1" as UserId,
    issuedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function flipLastCharacter(value: string): string {
  const lastChar = value.at(-1);
  const replacement = lastChar === "a" ? "b" : "a";

  return value.slice(0, -1) + replacement;
}

describe("session token", () => {
  it("round-trips a valid payload", () => {
    const payload = buildPayload();
    const token = signSessionToken(payload, SECRET);

    expect(verifySessionToken(token, SECRET, NOW)).toEqual({ ok: true, value: payload });
  });

  it("returns INVALID when the payload segment is tampered", () => {
    const token = signSessionToken(buildPayload(), SECRET);
    const [encodedPayload, signature] = token.split(".");
    const tamperedToken = `${flipLastCharacter(encodedPayload)}.${signature}`;

    expect(verifySessionToken(tamperedToken, SECRET, NOW)).toEqual({ ok: false, error: "INVALID" });
  });

  it("returns INVALID when the signature segment is tampered", () => {
    const token = signSessionToken(buildPayload(), SECRET);
    const [encodedPayload, signature] = token.split(".");
    const tamperedToken = `${encodedPayload}.${flipLastCharacter(signature)}`;

    expect(verifySessionToken(tamperedToken, SECRET, NOW)).toEqual({ ok: false, error: "INVALID" });
  });

  it("returns EXPIRED for a token older than 30 minutes", () => {
    const token = signSessionToken(buildPayload(), SECRET);
    const afterExpiry = new Date(NOW.getTime() + 31 * 60 * 1000);

    expect(verifySessionToken(token, SECRET, afterExpiry)).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("returns INVALID for a malformed string", () => {
    expect(verifySessionToken("not-a-token", SECRET, NOW)).toEqual({ ok: false, error: "INVALID" });
  });
});
