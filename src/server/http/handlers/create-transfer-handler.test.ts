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
import { createCreateTransferHandler } from "./create-transfer-handler";

const ORIGINAL_ENV = process.env;
const SECRET = "a".repeat(32);
const NOW = new Date("2026-10-21T12:00:00.000Z");
const VALID_KEY = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const OTHER_KEY = "0b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7e";

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
let sleepCalls: number[];

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-create-transfer-"));
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: SECRET };
  mockCookieStore = createCookieStore();
  sleepCalls = [];

  const db = createJsonDatabase(join(tempDir, "db.json"), () => createSeed(NOW));
  let idCounter = 0;
  const deps: ServiceDependencies = {
    db,
    now: () => NOW,
    random: () => 0.4,
    createId: () => `id${idCounter++}`,
  };

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
});

afterEach(async () => {
  process.env = ORIGINAL_ENV;
  vi.resetModules();
  await rm(tempDir, { recursive: true, force: true });
});

function buildHttpDeps(): HttpDependencies {
  return {
    services,
    random: () => 0.4,
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
    },
    createRequestId: () => "generated-id",
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
    allowScenarioOverride: true,
  };
}

function buildRequest(options: { body?: string; idempotencyKey?: string; cookie?: string } = {}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin: "https://smw.test",
    host: "smw.test",
  };

  if (options.idempotencyKey !== undefined) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  return new NextRequest("https://smw.test/api/v1/transfers", {
    method: "POST",
    headers,
    body: options.body,
  });
}

function transferPayload(amountInCents = 10_000) {
  return JSON.stringify({
    amountInCents,
    recipient: {
      kind: "new",
      name: "Carlos Ruiz",
      account: { type: "phone", phone: "5523456789" },
      saveAsFavorite: false,
    },
  });
}

async function signIn(userId: UserId): Promise<void> {
  const { setSessionCookie } = await import("@/server/session/session");
  await setSessionCookie(userId);
}

async function getBalance(): Promise<number> {
  const result = await services.wallet.getSummary(marianaId);
  return result.ok ? result.value.balance.amountInCents : NaN;
}

describe("createCreateTransferHandler", () => {
  it("answers 400 IDEMPOTENCY_KEY_REQUIRED when the header is missing", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());

    const response = await handler(buildRequest({ body: transferPayload() }), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual({ idempotencyKey: ["IDEMPOTENCY_KEY_REQUIRED"] });
  });

  it("answers 400 IDEMPOTENCY_KEY_INVALID for a malformed key", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());

    const response = await handler(
      buildRequest({ body: transferPayload(), idempotencyKey: "not-a-uuid" }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual({ idempotencyKey: ["IDEMPOTENCY_KEY_INVALID"] });
  });

  it("under success, debits and answers 201", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());
    const balanceBefore = await getBalance();

    const response = await handler(
      buildRequest({ body: transferPayload(10_000), idempotencyKey: VALID_KEY, cookie: "mock_scenario=success" }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(await getBalance()).toBe(balanceBefore - 10_000);
  });

  it("under success, an amount above the balance answers 422 INSUFFICIENT_FUNDS from the service", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());
    const balanceBefore = await getBalance();

    const response = await handler(
      buildRequest({
        body: transferPayload(balanceBefore + 100),
        idempotencyKey: VALID_KEY,
        cookie: "mock_scenario=success",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect(body.error.balance.amountInCents).toBe(balanceBefore);
    expect(await getBalance()).toBe(balanceBefore);
  });

  it("under forced network_error, answers 503 and leaves the balance unchanged", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());
    const balanceBefore = await getBalance();

    const response = await handler(
      buildRequest({
        body: transferPayload(),
        idempotencyKey: VALID_KEY,
        cookie: "mock_scenario=network_error",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(await getBalance()).toBe(balanceBefore);
  });

  it("under forced insufficient_funds, answers 422 with the real balance and leaves it unchanged", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());
    const balanceBefore = await getBalance();

    const response = await handler(
      buildRequest({
        body: transferPayload(),
        idempotencyKey: VALID_KEY,
        cookie: "mock_scenario=insufficient_funds",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect(body.error.balance.amountInCents).toBe(balanceBefore);
    expect(await getBalance()).toBe(balanceBefore);
  });

  it("under forced unknown_error, answers 500 and leaves the balance unchanged, without reporting it", async () => {
    await signIn(marianaId);
    const deps = buildHttpDeps();
    const handler = createCreateTransferHandler(deps);
    const balanceBefore = await getBalance();

    const response = await handler(
      buildRequest({
        body: transferPayload(),
        idempotencyKey: VALID_KEY,
        cookie: "mock_scenario=unknown_error",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
    expect(await getBalance()).toBe(balanceBefore);
    expect(deps.reporter.captureException).not.toHaveBeenCalled();
  });

  it("under forced timeout, sleeps 12000ms before debiting and answers 201", async () => {
    await signIn(marianaId);
    const deps = buildHttpDeps();
    const events: string[] = [];
    deps.sleep = async (ms: number) => {
      events.push(`sleep:${ms}`);
    };
    const realCreate = services.transfer.create.bind(services.transfer);
    services.transfer.create = async (...args: Parameters<typeof realCreate>) => {
      events.push("create:called");
      return realCreate(...args);
    };

    const handler = createCreateTransferHandler(deps);
    const balanceBefore = await getBalance();

    const response = await handler(
      buildRequest({ body: transferPayload(10_000), idempotencyKey: VALID_KEY, cookie: "mock_scenario=timeout" }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(events).toEqual(["sleep:12000", "create:called"]);
    expect(await getBalance()).toBe(balanceBefore - 10_000);
  });

  it("replays a completed transfer and skips the scenario", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());

    const first = await handler(
      buildRequest({ body: transferPayload(10_000), idempotencyKey: VALID_KEY, cookie: "mock_scenario=success" }),
      { params: Promise.resolve({}) },
    );
    const firstBody = await first.json();
    const balanceAfterFirst = await getBalance();

    const second = await handler(
      buildRequest({
        body: transferPayload(10_000),
        idempotencyKey: VALID_KEY,
        cookie: "mock_scenario=network_error",
      }),
      { params: Promise.resolve({}) },
    );

    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody.id).toBe(firstBody.id);
    expect(await getBalance()).toBe(balanceAfterFirst);
  });

  it("answers 409 IDEMPOTENCY_CONFLICT for the same key with a different payload", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());

    await handler(
      buildRequest({ body: transferPayload(10_000), idempotencyKey: VALID_KEY, cookie: "mock_scenario=success" }),
      { params: Promise.resolve({}) },
    );

    const second = await handler(
      buildRequest({ body: transferPayload(20_000), idempotencyKey: VALID_KEY, cookie: "mock_scenario=success" }),
      { params: Promise.resolve({}) },
    );

    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("uses a different key for an unrelated transfer", async () => {
    await signIn(marianaId);
    const handler = createCreateTransferHandler(buildHttpDeps());

    await handler(
      buildRequest({ body: transferPayload(10_000), idempotencyKey: VALID_KEY, cookie: "mock_scenario=success" }),
      { params: Promise.resolve({}) },
    );

    const second = await handler(
      buildRequest({ body: transferPayload(5_000), idempotencyKey: OTHER_KEY, cookie: "mock_scenario=success" }),
      { params: Promise.resolve({}) },
    );

    expect(second.status).toBe(201);
  });
});
