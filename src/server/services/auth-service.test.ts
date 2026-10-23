import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOGIN_METHOD } from "@/domain/user/schemas";
import type { UserId } from "@/domain/user/types";
import { createJsonDatabase } from "../db/json-database";
import { SCHEMA_VERSION, type DatabaseSnapshot } from "../db/schema";
import { createAuthService } from "./auth-service";
import type { ServiceDependencies } from "./types";

let tempDir: string;
let dbPath: string;
let deps: ServiceDependencies;
let idCounter: number;

function buildStubSeed(): DatabaseSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    users: [],
    wallets: [],
    movements: [],
    contacts: [],
    transfers: [],
    idempotencyKeys: [],
  };
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-auth-"));
  dbPath = join(tempDir, "db.json");
  idCounter = 0;
  deps = {
    db: createJsonDatabase(dbPath, buildStubSeed),
    now: () => new Date("2026-10-21T12:00:00.000Z"),
    random: () => 0.5,
    createId: () => `id${idCounter++}`,
  };
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const VALID_REGISTRATION = {
  fullName: "Nueva Usuaria",
  phone: "5500000000",
  email: "nueva@spin.test",
  password: "Spin2026",
  passwordConfirmation: "Spin2026",
};

describe("AuthService.register", () => {
  it("creates a user with a $1,000.00 balance and no movements", async () => {
    const service = createAuthService(deps);

    const result = await service.register(VALID_REGISTRATION);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.fullName).toBe("Nueva Usuaria");

    const wallet = await deps.db.read((repositories) => repositories.wallets.findByUserId(result.value.id));
    expect(wallet?.balance.amountInCents).toBe(100_000);

    const movements = await deps.db.read((repositories) => repositories.movements.listByUserId(result.value.id));
    expect(movements).toHaveLength(0);
  });

  it("reports PHONE_ALREADY_REGISTERED for a duplicate phone", async () => {
    const service = createAuthService(deps);
    await service.register(VALID_REGISTRATION);

    const result = await service.register({ ...VALID_REGISTRATION, email: "otra@spin.test" });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { phone: ["PHONE_ALREADY_REGISTERED"] } },
    });
  });

  it("reports EMAIL_ALREADY_REGISTERED for a duplicate email", async () => {
    const service = createAuthService(deps);
    await service.register(VALID_REGISTRATION);

    const result = await service.register({ ...VALID_REGISTRATION, phone: "5511111111" });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { email: ["EMAIL_ALREADY_REGISTERED"] } },
    });
  });
});

describe("AuthService.verifyCredentials", () => {
  it("logs in by phone", async () => {
    const service = createAuthService(deps);
    await service.register(VALID_REGISTRATION);

    const result = await service.verifyCredentials({
      method: LOGIN_METHOD.PHONE,
      phone: VALID_REGISTRATION.phone,
      password: VALID_REGISTRATION.password,
    });

    expect(result.ok).toBe(true);
  });

  it("logs in by email", async () => {
    const service = createAuthService(deps);
    await service.register(VALID_REGISTRATION);

    const result = await service.verifyCredentials({
      method: LOGIN_METHOD.EMAIL,
      email: VALID_REGISTRATION.email,
      password: VALID_REGISTRATION.password,
    });

    expect(result.ok).toBe(true);
  });

  it("returns INVALID_CREDENTIALS for a wrong password", async () => {
    const service = createAuthService(deps);
    await service.register(VALID_REGISTRATION);

    const result = await service.verifyCredentials({
      method: LOGIN_METHOD.PHONE,
      phone: VALID_REGISTRATION.phone,
      password: "WrongPass1",
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
  });

  it("returns INVALID_CREDENTIALS for an unknown user", async () => {
    const service = createAuthService(deps);

    const result = await service.verifyCredentials({
      method: LOGIN_METHOD.EMAIL,
      email: "nadie@spin.test",
      password: "Spin2026",
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
  });
});

describe("AuthService.exists", () => {
  it("is true for a registered user and false for a missing one", async () => {
    const service = createAuthService(deps);
    const registered = await service.register(VALID_REGISTRATION);

    expect(registered.ok && (await service.exists(registered.value.id))).toBe(true);
    expect(await service.exists("usr_missing" as UserId)).toBe(false);
  });
});
