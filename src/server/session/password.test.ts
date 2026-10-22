import "server-only";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password against its hash", async () => {
    const hash = await hashPassword("Spin2026");

    expect(await verifyPassword("Spin2026", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Spin2026");

    expect(await verifyPassword("spin2026", hash)).toBe(false);
  });

  it("rejects a tampered hash", async () => {
    const hash = await hashPassword("Spin2026");
    const [scheme, salt, storedHash] = hash.split("$");
    const tamperedHash = storedHash.slice(0, -4) + (storedHash.slice(-4) === "AAAA" ? "BBBB" : "AAAA");

    expect(await verifyPassword("Spin2026", `${scheme}$${salt}$${tamperedHash}`)).toBe(false);
  });

  it("produces a different hash each time due to the random salt", async () => {
    const first = await hashPassword("Spin2026");
    const second = await hashPassword("Spin2026");

    expect(first).not.toBe(second);
  });

  it("rejects a value with an unknown scheme", async () => {
    expect(await verifyPassword("Spin2026", "plain$abc$def")).toBe(false);
  });

  it("rejects a value missing the salt or hash segment", async () => {
    expect(await verifyPassword("Spin2026", "scrypt$")).toBe(false);
  });
});
