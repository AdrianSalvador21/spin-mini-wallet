import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import type { TransferId } from "@/domain/transfer/types";
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
import { createGetTransferHandler } from "./get-transfer-handler";

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

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-get-transfer-"));
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
    random: () => 0.4,
    sleep: async () => {},
    createRequestId: () => "generated-id",
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
    allowScenarioOverride: true,
  };
}

function buildRequest(transferId: string): NextRequest {
  return new NextRequest(`https://smw.test/api/v1/transfers/${transferId}`);
}

async function signIn(userId: UserId): Promise<void> {
  const { setSessionCookie } = await import("@/server/session/session");
  await setSessionCookie(userId);
}

describe("createGetTransferHandler", () => {
  it("answers 200 with the receipt for the sender", async () => {
    await signIn(marianaId);
    const created = await services.transfer.create(
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
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    );

    if (!created.ok) {
      throw new Error("expected the transfer to be created");
    }

    const handler = createGetTransferHandler(buildHttpDeps());
    const response = await handler(buildRequest(created.value.id), {
      params: Promise.resolve({ transferId: created.value.id }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe(created.value.id);
  });

  it("answers 404 for an unknown transfer id", async () => {
    await signIn(marianaId);
    const handler = createGetTransferHandler(buildHttpDeps());

    const response = await handler(buildRequest("trf_unknown"), {
      params: Promise.resolve({ transferId: "trf_unknown" as TransferId }),
    });

    expect(response.status).toBe(404);
  });

  it("answers 404 for a transfer that belongs to another user", async () => {
    await signIn(marianaId);
    const created = await services.transfer.create(
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
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    );

    if (!created.ok) {
      throw new Error("expected the transfer to be created");
    }

    await signIn(diegoId);
    const handler = createGetTransferHandler(buildHttpDeps());
    const response = await handler(buildRequest(created.value.id), {
      params: Promise.resolve({ transferId: created.value.id }),
    });

    expect(response.status).toBe(404);
  });
});
