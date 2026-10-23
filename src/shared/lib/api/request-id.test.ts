import { describe, expect, it } from "vitest";
import { createRequestId, isRequestId } from "./request-id";

const UUID = "3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b";

describe("isRequestId", () => {
  it.each([UUID, UUID.toUpperCase()])("accepts the UUID %s", (value) => {
    expect(isRequestId(value)).toBe(true);
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["free text", "abc"],
    ["a UUID with a trailing newline", `${UUID}\n`],
    ["a UUID with a leading space", ` ${UUID}`],
    ["a UUID without dashes", UUID.replaceAll("-", "")],
    ["a UUID with a non-hex character", UUID.replace("3", "g")],
  ])("rejects %s", (_label, value) => {
    expect(isRequestId(value)).toBe(false);
  });
});

describe("createRequestId", () => {
  it("returns a valid, different id on each call", () => {
    const first = createRequestId();
    const second = createRequestId();

    expect(isRequestId(first)).toBe(true);
    expect(first).not.toBe(second);
  });
});
