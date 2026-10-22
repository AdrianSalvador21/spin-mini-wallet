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
import type { ContactsList } from "@/shared/lib/api/views";
import { createCreateContactHandler } from "./create-contact-handler";
import { createListContactsHandler } from "./list-contacts-handler";

const ORIGINAL_ENV = process.env;
const SECRET = "a".repeat(32);
const NOW = new Date("2026-10-21T12:00:00.000Z");
const VALID_CLABE = "002123456789012343";
const CARLOS_PHONE = "5523456789";

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
let marianaPhone: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-create-contact-"));
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: SECRET };
  mockCookieStore = createCookieStore();

  const db = createJsonDatabase(join(tempDir, "db.json"), () => createSeed(NOW));
  const deps: ServiceDependencies = { db, now: () => NOW, random: () => 0, createId: () => `id${Math.random()}` };

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
  marianaPhone = mariana.phone;
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
    sleep: async () => {},
    createRequestId: () => "generated-id",
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reporter: { captureException: vi.fn() },
    allowScenarioOverride: true,
  };
}

function buildRequest(body?: string): NextRequest {
  return new NextRequest("https://smw.test/api/v1/contacts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://smw.test",
      host: "smw.test",
    },
    body,
  });
}

async function signIn(userId: UserId): Promise<void> {
  const { setSessionCookie } = await import("@/server/session/session");
  await setSessionCookie(userId);
}

async function listFavoriteNames(): Promise<string[]> {
  const handler = createListContactsHandler(buildHttpDeps());
  const response = await handler(new NextRequest("https://smw.test/api/v1/contacts"), { params: Promise.resolve({}) });
  const body = (await response.json()) as ContactsList;

  return body.items.map((contact) => contact.name);
}

describe("createCreateContactHandler", () => {
  it("answers 201 with a masked account for a valid CLABE contact", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(
      buildRequest(JSON.stringify({ name: "Luis Pérez", account: { type: "clabe", clabe: VALID_CLABE }, saveAsFavorite: true })),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.account.masked).not.toContain(VALID_CLABE);
    expect(body.account.masked.replace(/\D/g, "").length).toBeLessThanOrEqual(4);
  });

  it("answers 400 with field codes for an invalid CLABE", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(
      buildRequest(
        JSON.stringify({ name: "Luis Pérez", account: { type: "clabe", clabe: "123" }, saveAsFavorite: true }),
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details["account.clabe"]).toEqual(["CLABE_INVALID_LENGTH"]);
  });

  it("answers 200 with the same contact for an account that already exists", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());
    const payload = JSON.stringify({
      name: "Luis Pérez",
      account: { type: "clabe", clabe: VALID_CLABE },
      saveAsFavorite: true,
    });

    const first = await handler(buildRequest(payload), { params: Promise.resolve({}) });
    const firstBody = await first.json();

    const second = await handler(buildRequest(payload), { params: Promise.resolve({}) });
    const secondBody = await second.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(secondBody.id).toBe(firstBody.id);
  });

  it("answers 200 and upgrades an existing non-favorite to a favorite", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());
    const account = { type: "clabe", clabe: VALID_CLABE };

    const first = await handler(buildRequest(JSON.stringify({ name: "Luis Pérez", account, saveAsFavorite: false })), {
      params: Promise.resolve({}),
    });
    const second = await handler(buildRequest(JSON.stringify({ name: "Luis Pérez", account, saveAsFavorite: true })), {
      params: Promise.resolve({}),
    });
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody.id).toBe((await first.json()).id);
    expect(secondBody.isFavorite).toBe(true);
    expect(await listFavoriteNames()).toContain("Luis Pérez");
  });

  it("does not downgrade an existing favorite saved without the favorite flag", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(
      buildRequest(JSON.stringify({ name: "Carlos Ruiz", account: { type: "phone", phone: CARLOS_PHONE }, saveAsFavorite: false })),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).isFavorite).toBe(true);
    expect(await listFavoriteNames()).toContain("Carlos Ruiz");
  });

  it("answers 400 RECIPIENT_IS_SELF for the user's own phone", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(
      buildRequest(JSON.stringify({ name: "Mariana López", account: { type: "phone", phone: marianaPhone }, saveAsFavorite: true })),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual({ account: ["RECIPIENT_IS_SELF"] });
  });

  it("answers 201 for a new favorite and the next GET includes it", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(
      buildRequest(JSON.stringify({ name: "Luis Pérez", account: { type: "clabe", clabe: VALID_CLABE }, saveAsFavorite: true })),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect((await response.json()).isFavorite).toBe(true);
    expect(await listFavoriteNames()).toContain("Luis Pérez");
  });

  it("answers 201 for a new non-favorite and the next GET does not include it", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(
      buildRequest(JSON.stringify({ name: "Luis Pérez", account: { type: "clabe", clabe: VALID_CLABE }, saveAsFavorite: false })),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect((await response.json()).isFavorite).toBe(false);
    expect(await listFavoriteNames()).not.toContain("Luis Pérez");
  });

  it("answers 400 BODY_INVALID_JSON for a malformed body", async () => {
    await signIn(marianaId);
    const handler = createCreateContactHandler(buildHttpDeps());

    const response = await handler(buildRequest("{not-json"), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual({ body: ["BODY_INVALID_JSON"] });
  });
});
