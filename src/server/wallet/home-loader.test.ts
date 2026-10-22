import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/domain/user/types";
import { READ_LATENCY_MS, SLOW_READ_MS } from "../mock/scenarios";
import { createJsonDatabase } from "../db/json-database";
import { createSeed } from "../db/seed";
import { createAuthService } from "../services/auth-service";
import { createContactService } from "../services/contact-service";
import { createTransferService } from "../services/transfer-service";
import type { ServiceDependencies } from "../services/types";
import { createWalletService } from "../services/wallet-service";
import type { Services } from "../container";
import { createHomeLoader, HOME_LOAD_FAILURE, type HomeLoader } from "./home-loader";

const NOW = new Date("2026-10-21T12:00:00.000Z");

let tempDir: string;
let services: Services;
let marianaId: UserId;
let sleepCalls: number[];
let warnCalls: Array<{ message: string; fields?: Record<string, unknown> }>;

function buildLoader(allowScenarioOverride: boolean): HomeLoader {
  return createHomeLoader({
    services,
    random: () => 0,
    sleep: async (ms) => {
      sleepCalls.push(ms);
    },
    allowScenarioOverride,
    logger: {
      info: vi.fn(),
      warn: (message, fields) => warnCalls.push({ message, fields }),
      error: vi.fn(),
    },
  });
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-home-loader-"));
  const db = createJsonDatabase(join(tempDir, "db.json"), () => createSeed(NOW));
  const deps: ServiceDependencies = { db, now: () => NOW, random: () => 0.5, createId: () => "id" };

  services = {
    auth: createAuthService(deps),
    wallet: createWalletService(deps),
    contact: createContactService(deps),
    transfer: createTransferService(deps),
  };

  const snapshot = await createSeed(NOW);
  const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");

  if (!mariana) {
    throw new Error("Seed is missing an expected user");
  }

  marianaId = mariana.id;
  sleepCalls = [];
  warnCalls = [];
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("createHomeLoader", () => {
  it("loads the summary within the ok read latency range", async () => {
    const loader = buildLoader(true);

    const result = await loader.loadSummary({ userId: marianaId, requestId: "req-1" });

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ balance: expect.anything() }) });
    expect(sleepCalls).toHaveLength(1);
    expect(sleepCalls[0]).toBeGreaterThanOrEqual(READ_LATENCY_MS[0]);
    expect(sleepCalls[0]).toBeLessThanOrEqual(READ_LATENCY_MS[1]);
  });

  it("waits 3000ms under the slow scenario", async () => {
    const loader = buildLoader(true);

    const result = await loader.loadSummary({
      userId: marianaId,
      requestId: "req-2",
      scenarioCookie: "slow",
    });

    expect(result.ok).toBe(true);
    expect(sleepCalls).toEqual([SLOW_READ_MS]);
  });

  it("returns unavailable for the summary under the error scenario", async () => {
    const loader = buildLoader(true);

    const result = await loader.loadSummary({
      userId: marianaId,
      requestId: "req-3",
      scenarioCookie: "error",
    });

    expect(result).toEqual({ ok: false, error: { kind: HOME_LOAD_FAILURE.UNAVAILABLE } });
  });

  it("returns unavailable for the movements under movements_error but loads the summary", async () => {
    const loader = buildLoader(true);

    const summary = await loader.loadSummary({
      userId: marianaId,
      requestId: "req-4",
      scenarioCookie: "movements_error",
    });
    const movements = await loader.loadMovements({
      userId: marianaId,
      requestId: "req-4",
      scenarioCookie: "movements_error",
    });

    expect(summary.ok).toBe(true);
    expect(movements).toEqual({ ok: false, error: { kind: HOME_LOAD_FAILURE.UNAVAILABLE } });
  });

  it("ignores the scenario cookie when the override is not allowed", async () => {
    const loader = buildLoader(false);

    const result = await loader.loadSummary({
      userId: marianaId,
      requestId: "req-5",
      scenarioCookie: "error",
    });

    expect(result.ok).toBe(true);
  });

  it("returns unavailable when the underlying service reports NOT_FOUND", async () => {
    const loader = buildLoader(true);

    const result = await loader.loadSummary({
      userId: "usr_unknown" as UserId,
      requestId: "req-6",
    });

    expect(result).toEqual({ ok: false, error: { kind: HOME_LOAD_FAILURE.UNAVAILABLE } });
  });

  it("logs the resource, scenario and request id, and no user data", async () => {
    const loader = buildLoader(true);

    await loader.loadSummary({ userId: marianaId, requestId: "req-7", scenarioCookie: "error" });

    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0]).toEqual({
      message: "home_load",
      fields: { resource: "summary", scenario: "error", requestId: "req-7" },
    });
    expect(JSON.stringify(warnCalls[0])).not.toContain(marianaId);
  });
});
