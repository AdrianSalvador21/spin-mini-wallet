import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
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
import { createFindTransferByKeyHandler } from "./find-transfer-by-key-handler";

const ORIGINAL_ENV = process.env;
const SECRET = "a".repeat(32);
const NOW = new Date("2026-10-21T12:00:00.000Z");
const VALID_KEY = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

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

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-find-transfer-"));
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: SECRET };
  mockCookieStore = createCookieStore();

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
    sleep: async () => {},
    createRequestId: () => "generated-id",
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
    allowScenarioOverride: true,
  };
}

function buildRequest(search: string): NextRequest {
  return new NextRequest(`https://smw.test/api/v1/transfers${search}`);
}

async function signIn(userId: UserId): Promise<void> {
  const { setSessionCookie } = await import("@/server/session/session");
  await setSessionCookie(userId);
}

describe("createFindTransferByKeyHandler", () => {
  it("answers 400 IDEMPOTENCY_KEY_REQUIRED without the query parameter", async () => {
    await signIn(marianaId);
    const handler = createFindTransferByKeyHandler(buildHttpDeps());

    const response = await handler(buildRequest(""), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual({ idempotencyKey: ["IDEMPOTENCY_KEY_REQUIRED"] });
  });

  it("answers 400 IDEMPOTENCY_KEY_INVALID for a malformed key", async () => {
    await signIn(marianaId);
    const handler = createFindTransferByKeyHandler(buildHttpDeps());

    const response = await handler(buildRequest("?idempotencyKey=not-a-uuid"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual({ idempotencyKey: ["IDEMPOTENCY_KEY_INVALID"] });
  });

  it("answers 404 before the transfer completes", async () => {
    await signIn(marianaId);
    const handler = createFindTransferByKeyHandler(buildHttpDeps());

    const response = await handler(buildRequest(`?idempotencyKey=${VALID_KEY}`), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(404);
  });

  it("answers 200 with the transfer once it completes", async () => {
    await signIn(marianaId);
    await services.transfer.create(
      marianaId,
      {
        amountInCents: (10_000) as Cents,
        recipient: {
          kind: "new",
          name: "Carlos Ruiz",
          account: { type: "phone", phone: "5523456789" },
          saveAsFavorite: false,
        },
      },
      VALID_KEY,
    );

    const handler = createFindTransferByKeyHandler(buildHttpDeps());
    const response = await handler(buildRequest(`?idempotencyKey=${VALID_KEY}`), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
  });
});
