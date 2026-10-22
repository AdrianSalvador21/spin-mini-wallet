import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/domain/user/types";
import type { Services } from "@/server/container";
import { createJsonDatabase } from "@/server/db/json-database";
import { createSeed } from "@/server/db/seed";
import type { HttpDependencies } from "@/server/http/route-handler";
import { createAuthService } from "@/server/services/auth-service";
import { createContactService } from "@/server/services/contact-service";
import { createTransferService } from "@/server/services/transfer-service";
import type { ServiceDependencies } from "@/server/services/types";
import { createWalletService } from "@/server/services/wallet-service";
import { createListContactsHandler } from "./list-contacts-handler";

const ORIGINAL_ENV = process.env;
const SECRET = "a".repeat(32);
const NOW = new Date("2026-10-21T12:00:00.000Z");

interface MockCookie {
  name: string;
  value: string;
}

function createCookieStore(initial?: MockCookie) {
  const store = new Map<string, string>();

  if (initial) {
    store.set(initial.name, initial.value);
  }

  return {
    get: vi.fn((name: string) => (store.has(name) ? { name, value: store.get(name) as string } : undefined)),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
  };
}

let mockCookieStore: ReturnType<typeof createCookieStore>;

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

let tempDir: string;
let services: Services;
let marianaId: UserId;
let diegoId: UserId;
let sleepCalls: number[];

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-list-contacts-"));
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: SECRET };
  mockCookieStore = createCookieStore();
  sleepCalls = [];

  const db = createJsonDatabase(join(tempDir, "db.json"), () => createSeed(NOW));
  const deps: ServiceDependencies = { db, now: () => NOW, random: () => 0, createId: () => "id" };

  services = {
    auth: createAuthService(deps),
    wallet: createWalletService(deps),
    contact: createContactService(deps),
    transfer: createTransferService(deps),
  };

  const snapshot = await createSeed(NOW);
  const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");
  const diego = snapshot.users.find((user) => user.fullName === "Diego Ramírez");

  if (!mariana || !diego) {
    throw new Error("Seed is missing an expected user");
  }

  marianaId = mariana.id;
  diegoId = diego.id;
});

afterEach(async () => {
  process.env = ORIGINAL_ENV;
  vi.resetModules();
  await rm(tempDir, { recursive: true, force: true });
});

function buildHttpDeps(): HttpDependencies {
  return {
    services,
    random: () => 0,
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
    },
    createRequestId: () => "generated-id",
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
    allowScenarioOverride: true,
  };
}

function buildRequest(cookie?: string): NextRequest {
  return new NextRequest("https://smw.test/api/v1/contacts", {
    headers: cookie ? { cookie } : {},
  });
}

async function signIn(userId: UserId): Promise<void> {
  const { setSessionCookie } = await import("@/server/session/session");
  await setSessionCookie(userId);
}

describe("createListContactsHandler", () => {
  it("answers 200 with Mariana's favorites", async () => {
    await signIn(marianaId);
    const handler = createListContactsHandler(buildHttpDeps());

    const response = await handler(buildRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("answers 200 with an empty list for Diego", async () => {
    await signIn(diegoId);
    const handler = createListContactsHandler(buildHttpDeps());

    const response = await handler(buildRequest(), { params: Promise.resolve({}) });

    expect(await response.json()).toEqual({ items: [] });
  });

  it("answers 200 after the slow latency under the slow read scenario", async () => {
    await signIn(marianaId);
    const handler = createListContactsHandler(buildHttpDeps());

    const response = await handler(buildRequest("mock_read_scenario=slow"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(sleepCalls).toEqual([3000]);
  });

  it("answers 503 UPSTREAM_UNAVAILABLE under the error read scenario", async () => {
    await signIn(marianaId);
    const handler = createListContactsHandler(buildHttpDeps());

    const response = await handler(buildRequest("mock_read_scenario=error"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(503);
  });
});
