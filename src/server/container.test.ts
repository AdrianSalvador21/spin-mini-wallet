import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;
let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-container-"));
  process.env = {
    ...ORIGINAL_ENV,
    SESSION_SECRET: "a".repeat(32),
    MOCK_DB_PATH: join(tempDir, "db.json"),
  };
});

afterEach(async () => {
  process.env = ORIGINAL_ENV;
  vi.resetModules();
  await rm(tempDir, { recursive: true, force: true });
});

describe("getServices", () => {
  it("builds all four services backed by the configured MOCK_DB_PATH", async () => {
    const { getServices } = await import("./container");
    const services = getServices();

    const result = await services.auth.register({
      fullName: "Test User",
      phone: "5500000002",
      email: "test@spin.test",
      password: "Spin2026",
      passwordConfirmation: "Spin2026",
    });

    expect(result.ok).toBe(true);
  });

  it("returns the same services instance on repeated calls", async () => {
    const { getServices } = await import("./container");

    expect(getServices()).toBe(getServices());
  });
});

describe("getHttpDependencies", () => {
  it("builds the HTTP dependencies backed by the same services instance", async () => {
    const { getServices, getHttpDependencies } = await import("./container");

    expect(getHttpDependencies().services).toBe(getServices());
  });

  it("returns the same instance on repeated calls", async () => {
    const { getHttpDependencies } = await import("./container");

    expect(getHttpDependencies()).toBe(getHttpDependencies());
  });

  it("reads allowScenarioOverride from the environment", async () => {
    process.env = { ...process.env, MOCK_ALLOW_SCENARIO_OVERRIDE: "true" };

    const { getHttpDependencies } = await import("./container");

    expect(getHttpDependencies().allowScenarioOverride).toBe(true);
  });
});
