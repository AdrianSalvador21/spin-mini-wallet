import { describe, expect, it } from "vitest";
import { SECURITY_HEADER, securityHeaders } from "./security-headers";

function asRecord(isProduction: boolean): Record<string, string> {
  return Object.fromEntries(securityHeaders(isProduction).map(({ key, value }) => [key, value]));
}

describe("securityHeaders", () => {
  it("returns the base headers outside production", () => {
    expect(asRecord(false)).toEqual({
      [SECURITY_HEADER.CONTENT_TYPE_OPTIONS]: "nosniff",
      [SECURITY_HEADER.REFERRER_POLICY]: "strict-origin-when-cross-origin",
      [SECURITY_HEADER.FRAME_OPTIONS]: "DENY",
      [SECURITY_HEADER.PERMISSIONS_POLICY]: "camera=(), microphone=(), geolocation=(), payment=()",
    });
  });

  it("adds Strict-Transport-Security only in production", () => {
    expect(asRecord(true)[SECURITY_HEADER.STRICT_TRANSPORT_SECURITY]).toBe("max-age=63072000; includeSubDomains");
    expect(asRecord(false)).not.toHaveProperty(SECURITY_HEADER.STRICT_TRANSPORT_SECURITY);
  });
});
