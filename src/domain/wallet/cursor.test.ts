import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";
import type { MovementId } from "./types";

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("movement cursor", () => {
  it("round-trips createdAt and id", () => {
    const cursor = { createdAt: "2026-10-01T12:00:00.000Z", id: "mov_123" as MovementId };

    const encoded = encodeCursor(cursor);

    expect(decodeCursor(encoded)).toEqual({ ok: true, value: cursor });
  });

  it("returns CURSOR_INVALID for a string with no separator", () => {
    expect(decodeCursor("not-a-cursor")).toEqual({ ok: false, error: "CURSOR_INVALID" });
  });

  it("returns CURSOR_INVALID when createdAt is empty", () => {
    const encoded = toBase64Url("|mov_123");

    expect(decodeCursor(encoded)).toEqual({ ok: false, error: "CURSOR_INVALID" });
  });

  it("returns CURSOR_INVALID when id is empty", () => {
    const encoded = toBase64Url("2026-10-01T12:00:00.000Z|");

    expect(decodeCursor(encoded)).toEqual({ ok: false, error: "CURSOR_INVALID" });
  });

  it("returns CURSOR_INVALID when the input cannot be base64-decoded", () => {
    expect(decodeCursor("!!!")).toEqual({ ok: false, error: "CURSOR_INVALID" });
  });
});
