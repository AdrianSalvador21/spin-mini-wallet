import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import type { UserId } from "@/domain/user/types";
import { createJsonDatabase } from "../db/json-database";
import { createSeed } from "../db/seed";
import { createContactService, type ContactService } from "./contact-service";
import type { ServiceDependencies } from "./types";

const NOW = new Date("2026-10-21T12:00:00.000Z");
let tempDir: string;
let service: ContactService;
let marianaId: UserId;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "spin-mini-wallet-contacts-"));
  const dbPath = join(tempDir, "db.json");
  const db = createJsonDatabase(dbPath, () => createSeed(NOW));
  const deps: ServiceDependencies = { db, now: () => NOW, random: () => 0.5, createId: () => "newid" };
  service = createContactService(deps);

  const snapshot = await createSeed(NOW);
  const mariana = snapshot.users.find((user) => user.fullName === "Mariana López");

  if (!mariana) {
    throw new Error("Seed is missing Mariana");
  }

  marianaId = mariana.id;
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("listFavorites", () => {
  it("returns Mariana's 4 favorites sorted by name with masked accounts", async () => {
    const favorites = await service.listFavorites(marianaId);

    expect(favorites).toHaveLength(4);
    expect(favorites.map((contact) => contact.name)).toEqual(
      [...favorites.map((contact) => contact.name)].sort((a, b) => a.localeCompare(b)),
    );
    expect(favorites.every((contact) => (contact.account.masked.match(/\d/g) ?? []).length <= 4)).toBe(true);

    const ana = favorites.find((contact) => contact.name === "Ana Torres");
    expect(ana?.account.bankName).toBe("Banamex");
  });
});

describe("create", () => {
  const NEW_PHONE = { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5599999999" } as const;
  const CARLOS_PHONE = { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5523456789" } as const;

  it("creates a new favorite that the next list includes", async () => {
    const result = await service.create(marianaId, { name: "Nuevo Contacto", account: NEW_PHONE, saveAsFavorite: true });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.created).toBe(true);
    expect(result.ok && result.value.contact.name).toBe("Nuevo Contacto");
    expect(result.ok && result.value.contact.isFavorite).toBe(true);

    const favorites = await service.listFavorites(marianaId);
    expect(favorites).toHaveLength(5);
  });

  it("creates a non-favorite that the next list does not include", async () => {
    const result = await service.create(marianaId, {
      name: "Nuevo Contacto",
      account: NEW_PHONE,
      saveAsFavorite: false,
    });

    expect(result.ok && result.value.created).toBe(true);
    expect(result.ok && result.value.contact.isFavorite).toBe(false);

    const favorites = await service.listFavorites(marianaId);
    expect(favorites.map((contact) => contact.name)).not.toContain("Nuevo Contacto");
  });

  it("reuses the existing contact for a duplicate account and keeps its stored name", async () => {
    const before = await service.listFavorites(marianaId);
    const carlosBefore = before.find((contact) => contact.name === "Carlos Ruiz");

    const result = await service.create(marianaId, { name: "Otro Nombre", account: CARLOS_PHONE, saveAsFavorite: true });

    const after = await service.listFavorites(marianaId);

    expect(after).toHaveLength(before.length);
    expect(result).toEqual({
      ok: true,
      value: { contact: { ...carlosBefore, name: "Carlos Ruiz" }, created: false },
    });
  });

  it("upgrades an existing non-favorite when saved as a favorite", async () => {
    const first = await service.create(marianaId, { name: "Nuevo Contacto", account: NEW_PHONE, saveAsFavorite: false });
    const second = await service.create(marianaId, { name: "Nuevo Contacto", account: NEW_PHONE, saveAsFavorite: true });

    expect(second.ok && second.value.created).toBe(false);
    expect(second.ok && second.value.contact.id).toBe(first.ok && first.value.contact.id);
    expect(second.ok && second.value.contact.isFavorite).toBe(true);

    const favorites = await service.listFavorites(marianaId);
    expect(favorites.map((contact) => contact.name)).toContain("Nuevo Contacto");
  });

  it("never downgrades an existing favorite", async () => {
    const result = await service.create(marianaId, { name: "Carlos Ruiz", account: CARLOS_PHONE, saveAsFavorite: false });

    expect(result.ok && result.value.contact.isFavorite).toBe(true);

    const favorites = await service.listFavorites(marianaId);
    expect(favorites.map((contact) => contact.name)).toContain("Carlos Ruiz");
  });

  it("rejects the user's own phone with RECIPIENT_IS_SELF and stores nothing", async () => {
    const snapshot = await createSeed(NOW);
    const ownPhone = snapshot.users.find((user) => user.id === marianaId)?.phone ?? "";

    const result = await service.create(marianaId, {
      name: "Mariana López",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: ownPhone },
      saveAsFavorite: true,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", details: { account: ["RECIPIENT_IS_SELF"] } },
    });
    expect(await service.listFavorites(marianaId)).toHaveLength(4);
  });

  it("answers NOT_FOUND for a user that does not exist", async () => {
    const result = await service.create("usr_missing" as UserId, {
      name: "Nuevo Contacto",
      account: NEW_PHONE,
      saveAsFavorite: true,
    });

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });
});
