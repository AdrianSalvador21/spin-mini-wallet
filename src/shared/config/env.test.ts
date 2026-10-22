import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;
const VALID_SECRET = "a".repeat(32);

afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.resetModules();
});

describe("getEnv", () => {
  it("parses valid environment variables with the documented defaults", async () => {
    process.env = { ...ORIGINAL_ENV, SESSION_SECRET: VALID_SECRET };
    delete process.env.MOCK_DB_PATH;
    delete process.env.MOCK_ALLOW_SCENARIO_OVERRIDE;
    delete process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS;

    const { getEnv } = await import("./env");
    const env = getEnv();

    expect(env).toEqual({
      SESSION_SECRET: VALID_SECRET,
      MOCK_DB_PATH: ".data/db.json",
      MOCK_ALLOW_SCENARIO_OVERRIDE: false,
      NEXT_PUBLIC_ENABLE_DEV_TOOLS: false,
    });
  });

  it("throws naming SESSION_SECRET when it is missing", async () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SESSION_SECRET;

    const { getEnv } = await import("./env");

    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
  });

  it("throws naming SESSION_SECRET when it is shorter than 32 characters", async () => {
    process.env = { ...ORIGINAL_ENV, SESSION_SECRET: "too-short" };

    const { getEnv } = await import("./env");

    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
  });

  it("throws when MOCK_DB_PATH is an empty string", async () => {
    process.env = { ...ORIGINAL_ENV, SESSION_SECRET: VALID_SECRET, MOCK_DB_PATH: "" };

    const { getEnv } = await import("./env");

    expect(() => getEnv()).toThrow(/MOCK_DB_PATH/);
  });

  it("parses MOCK_DB_PATH and the boolean flags when provided", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      SESSION_SECRET: VALID_SECRET,
      MOCK_DB_PATH: "custom/db.json",
      MOCK_ALLOW_SCENARIO_OVERRIDE: "true",
      NEXT_PUBLIC_ENABLE_DEV_TOOLS: "true",
    };

    const { getEnv } = await import("./env");
    const env = getEnv();

    expect(env.MOCK_DB_PATH).toBe("custom/db.json");
    expect(env.MOCK_ALLOW_SCENARIO_OVERRIDE).toBe(true);
    expect(env.NEXT_PUBLIC_ENABLE_DEV_TOOLS).toBe(true);
  });

  it("rejects an invalid value for a boolean flag", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      SESSION_SECRET: VALID_SECRET,
      MOCK_ALLOW_SCENARIO_OVERRIDE: "yes",
    };

    const { getEnv } = await import("./env");

    expect(() => getEnv()).toThrow(/MOCK_ALLOW_SCENARIO_OVERRIDE/);
  });

  it("caches the parsed result across calls", async () => {
    process.env = { ...ORIGINAL_ENV, SESSION_SECRET: VALID_SECRET };

    const { getEnv } = await import("./env");
    const first = getEnv();
    process.env.MOCK_DB_PATH = "changed/db.json";
    const second = getEnv();

    expect(second).toBe(first);
  });
});
